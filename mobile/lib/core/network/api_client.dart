import 'dart:io' show HttpDate;
import 'dart:math' show Random;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;

import '../config/env.dart';
import '../storage/secure_store.dart';

/// Parses a `Retry-After` value into a wait, clamped to [0, cap].
/// Seconds form, HTTP-date form, garbage (→ 1 s default), and missing
/// (→ 1 s default) are all handled without throwing.
@visibleForTesting
Duration parseRetryAfter(String? raw, {DateTime? now, Duration cap = const Duration(seconds: 30)}) {
  const Duration fallback = Duration(seconds: 1);
  if (raw == null || raw.trim().isEmpty) return fallback;
  final int? secs = int.tryParse(raw.trim());
  if (secs != null) {
    if (secs <= 0) return Duration.zero;
    return Duration(seconds: secs > cap.inSeconds ? cap.inSeconds : secs);
  }
  try {
    final DateTime date = HttpDate.parse(raw.trim()).toUtc();
    final DateTime base = (now ?? DateTime.now()).toUtc();
    final int diff = date.difference(base).inSeconds;
    if (diff <= 0) return Duration.zero;
    return Duration(seconds: diff > cap.inSeconds ? cap.inSeconds : diff);
  } catch (_) {
    return fallback;
  }
}

/// Small random spread so a fleet coming off one limit does not re-hit the
/// server in lockstep (thundering-herd guard).
Duration _rateJitter() => Duration(milliseconds: 100 + Random().nextInt(400));

/// Dio with token attach + single-flight retry via refresh rotation.
/// Backend remains source of truth: revoked sessions fail closed here.
///
/// Single-flight: N concurrent 401s share ONE /auth/refresh call instead of
/// N. Without this, rotation invalidates the token the second refresh
/// presents → the whole session family is revoked → random silent logouts.
/// On refresh failure local tokens are cleared so BootstrapGate does not
/// treat a dead refresh token as a live session.
Dio createApiClient({required SecureStore store, String baseUrl = Env.apiBaseUrl}) {
  final Dio dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  // Shared in-flight refresh. All 401 waiters await the same future.
  Future<String?>? refreshInFlight;

  Future<String?> doRefresh() async {
    final String? refresh = await store.readRefreshToken();
    if (refresh == null) return null;
    // A 429/503 on rotation itself gets one honored retry (Rush hour must
    // not log users out just because the refresh endpoint is briefly hot).
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final Dio plain = Dio(
          BaseOptions(
            // Ikuti base URL aktif (bisa diubah runtime lewat ServerSettings),
            // bukan nilai compile-time.
            baseUrl: dio.options.baseUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 15),
            headers: {'Content-Type': 'application/json'},
          ),
        );
        // Share the transport so tests with a fake HttpClientAdapter also
        // cover the refresh call; in production both are the default IO
        // adapter, so behavior is unchanged.
        plain.httpClientAdapter = dio.httpClientAdapter;
        final Response res = await plain.post(
          '/auth/refresh',
          data: {'refreshToken': refresh},
        );
        final Object? data = res.data;
        if (data is! Map) return null;
        final Object? access = data['accessToken'];
        final Object? nextRefresh = data['refreshToken'];
        if (access is! String ||
            access.isEmpty ||
            nextRefresh is! String ||
            nextRefresh.isEmpty) {
          return null;
        }
        await store.writeTokens(access, nextRefresh);
        return access;
      } on DioException catch (e) {
        final int? status = e.response?.statusCode;
        if (attempt == 0 &&
            (status == 429 || status == 503) &&
            e.type != DioExceptionType.cancel) {
          final Duration wait = parseRetryAfter(e.response?.headers.value('retry-after'));
          if (wait <= const Duration(seconds: 5)) {
            await Future.delayed(wait + _rateJitter());
            continue;
          }
        }
        // Dead token (rejected 4xx) → drop the local session. Transient
        // states (429/5xx/no response) keep the tokens so the next attempt —
        // e.g. the outbox flush when the network returns — can retry.
        if (status != null && status != 429 && status < 500) {
          await store.clearTokens();
        }
        return null;
      } catch (_) {
        return null;
      }
    }
    // Unreachable: every path above returns. Kept for exhaustiveness.
    return null;
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (RequestOptions options, RequestInterceptorHandler handler) async {
        final String? token = await store.readAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (DioException err, ErrorInterceptorHandler handler) async {
        final RequestOptions req = err.requestOptions;
        if (err.response?.statusCode == 401 && req.extra['retried'] != true) {
          refreshInFlight ??= doRefresh().whenComplete(() => refreshInFlight = null);
          final String? access = await refreshInFlight;
          if (access != null) {
            req.headers['Authorization'] = 'Bearer $access';
            req.extra['retried'] = true;
            try {
              final Response retry = await dio.fetch(req);
              return handler.resolve(retry);
            } catch (_) {
              // Retry failed — fall through to the original 401.
            }
          }
        }
        // Rush-hour smoothing: one honored retry on 429/503 with a short
        // server-provided wait (+ jitter). Waits over 5 s are NOT slept in
        // the foreground — the error propagates and the attendance outbox
        // (or the user's retry) handles it instead of hanging the UI.
        final int? status = err.response?.statusCode;
        if ((status == 429 || status == 503) &&
            req.extra['rateRetried'] != true &&
            err.type != DioExceptionType.cancel) {
          final Duration wait = parseRetryAfter(err.response?.headers.value('retry-after'));
          if (wait <= const Duration(seconds: 5)) {
            req.extra['rateRetried'] = true;
            await Future.delayed(wait + _rateJitter());
            try {
              final Response retry = await dio.fetch(req);
              return handler.resolve(retry);
            } catch (_) {
              // Still limited — fall through to the original error.
            }
          }
        }
        handler.next(err);
      },
    ),
  );

  return dio;
}
