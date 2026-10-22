import 'dart:io' show HttpDate;
import 'dart:math' show Random;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show visibleForTesting;

import '../config/env.dart';
import '../storage/secure_store.dart';




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



Duration _rateJitter() => Duration(milliseconds: 100 + Random().nextInt(400));









Dio createApiClient({required SecureStore store, String baseUrl = Env.apiBaseUrl}) {
  final Dio dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  
  Future<String?>? refreshInFlight;

  Future<String?> doRefresh() async {
    final String? refresh = await store.readRefreshToken();
    if (refresh == null) return null;
    
    
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final Dio plain = Dio(
          BaseOptions(
            
            
            baseUrl: dio.options.baseUrl,
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 15),
            headers: {'Content-Type': 'application/json'},
          ),
        );
        
        
        
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
        
        
        
        if (status != null && status != 429 && status < 500) {
          await store.clearTokens();
        }
        return null;
      } catch (_) {
        return null;
      }
    }
    
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
              
            }
          }
        }
        
        
        
        
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
              
            }
          }
        }
        handler.next(err);
      },
    ),
  );

  return dio;
}
