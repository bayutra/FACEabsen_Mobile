import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../storage/secure_store.dart';
import 'env.dart';








String? normalizeBaseUrl(String raw) {
  String value = raw.trim();
  if (value.isEmpty) return null;
  if (!value.contains('://')) value = 'https://$value';

  final Uri? uri = Uri.tryParse(value);
  if (uri == null) return null;
  if (uri.scheme != 'http' && uri.scheme != 'https') return null;
  if (uri.host.isEmpty) return null;

  
  
  final String path = (uri.path.isEmpty || uri.path == '/') ? '/api/v1' : uri.path;
  String normalized = uri.replace(path: path, query: null, fragment: null).toString();
  while (normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  return normalized;
}







class ServerSettings extends ChangeNotifier {
  ServerSettings({required SecureStore store, required Dio dio})
      : _store = store,
        _dio = dio;

  final SecureStore _store;
  final Dio _dio;

  
  String get baseUrl => _dio.options.baseUrl;

  
  String get hostLabel {
    final Uri? uri = Uri.tryParse(baseUrl);
    return uri?.host.isNotEmpty == true ? uri!.host : baseUrl;
  }

  
  String get defaultBaseUrl => Env.apiBaseUrl;

  
  
  Future<void> restore() async {
    final String? saved = await _store.readApiBaseUrl();
    if (saved == null || saved.isEmpty) return;
    if (normalizeBaseUrl(saved) == null) {
      
      await _store.clearApiBaseUrl();
      return;
    }
    _dio.options.baseUrl = saved;
  }

  
  
  Future<String> apply(String raw) async {
    if (raw.trim().isEmpty) {
      await _store.clearApiBaseUrl();
      _dio.options.baseUrl = Env.apiBaseUrl;
      notifyListeners();
      return Env.apiBaseUrl;
    }

    final String? next = normalizeBaseUrl(raw);
    if (next == null) {
      throw const FormatException('Alamat server tidak valid.');
    }

    await _store.writeApiBaseUrl(next);
    _dio.options.baseUrl = next;
    notifyListeners();
    return next;
  }
}
