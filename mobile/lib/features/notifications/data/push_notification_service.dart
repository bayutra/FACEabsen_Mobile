import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../../device/data/device_repository.dart';
import '../domain/push_destination.dart';
import 'push_repository.dart';

/// Harus sama dengan `channelId` di `FcmClient` backend.
const String pushChannelId = 'face_absen_notifications';
const String pushChannelName = 'Notifikasi Face Absen';
const String pushChannelDescription =
    'Pemberitahuan koreksi presensi, cuti, dan perangkat.';

/// Handler isolate background. FCM sudah menampilkan pesan bertipe
/// `notification` sendiri saat aplikasi di background/terminated; handler ini
/// memastikan Firebase siap agar pesan `data` tidak dibuang.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (Firebase.apps.isEmpty) {
    try {
      await Firebase.initializeApp();
    } catch (_) {
      // Konfigurasi Firebase belum dipasang; biarkan pesan diabaikan.
    }
  }
}

class PushNotificationService {
  PushNotificationService({
    required PushRepository push,
    required DeviceRepository devices,
  })  : _push = push,
        _devices = devices;

  final PushRepository _push;
  final DeviceRepository _devices;
  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  final StreamController<PushDestination> _taps =
      StreamController<PushDestination>.broadcast();

  FirebaseMessaging? _messaging;
  StreamSubscription<RemoteMessage>? _foregroundSub;
  StreamSubscription<RemoteMessage>? _openedSub;
  StreamSubscription<String>? _refreshSub;
  PushDestination? _pendingTap;
  String? _token;
  bool _initialized = false;
  bool _initializing = false;
  bool _disabled = false;
  String? _installationId;

  static bool _bootstrapStarted = false;

  /// Tap notifikasi (foreground, background, maupun cold start).
  Stream<PushDestination> get taps => _taps.stream;

  /// Inisialisasi Firebase sekali di awal aplikasi. Aman dipanggil walau
  /// `google-services.json` masih placeholder: aplikasi tetap jalan tanpa push.
  static Future<bool> bootstrapFirebase() async {
    if (_bootstrapStarted) return Firebase.apps.isNotEmpty;
    _bootstrapStarted = true;
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      return true;
    } catch (error) {
      debugPrint('FCM tidak tersedia: $error');
      return false;
    }
  }

  Future<void> initialize() async {
    if (_initialized || _initializing || _disabled) return;
    _initializing = true;
    try {
      if (!await bootstrapFirebase()) {
        _disabled = true;
        return;
      }
      await _prepareLocalNotifications();
      final FirebaseMessaging messaging = FirebaseMessaging.instance;
      _messaging = messaging;
      await _requestPermission(messaging);

      _foregroundSub ??= FirebaseMessaging.onMessage.listen(_showForeground);
      _openedSub ??=
          FirebaseMessaging.onMessageOpenedApp.listen(_handleMessage);
      _refreshSub ??= messaging.onTokenRefresh.listen(_onTokenRefresh);
      _initialized = true;

      final RemoteMessage? initial = await messaging.getInitialMessage();
      if (initial != null) _handleMessage(initial);
    } catch (error) {
      debugPrint('Inisialisasi notifikasi gagal: $error');
    } finally {
      _initializing = false;
    }
  }

  /// Mendaftarkan token perangkat aktif. Dipanggil setiap HomeShell tampil dan
  /// saat aplikasi resume supaya registrasi yang tertunda (mis. perangkat baru
  /// menunggu persetujuan admin) ikut terkirim.
  Future<void> registerToken({String? installationId}) async {
    if (installationId != null) _installationId = installationId;
    if (_disabled) return;
    if (!_initialized) await initialize();
    final FirebaseMessaging? messaging = _messaging;
    if (_disabled || messaging == null) return;

    try {
      final String installId =
          _installationId ?? await _devices.installationId();
      final String? token = await messaging.getToken();
      if (token == null || token.isEmpty) return;
      await _push.registerToken(token: token, installationId: installId);
      _token = token;
    } catch (error) {
      // 404 saat perangkat belum ACTIVE, atau jaringan bermasalah. Dicoba lagi
      // saat aplikasi dibuka/resume berikutnya.
      debugPrint('Registrasi token FCM ditunda: $error');
    }
  }

  /// Melepas token saat logout agar notifikasi akun sebelumnya berhenti.
  Future<void> unregisterToken() async {
    final String? token = _token ?? await _currentToken();
    if (token != null && token.isNotEmpty) {
      try {
        await _push.unregisterToken(token);
      } catch (_) {
        // Sesi mungkin sudah dicabut; token tetap dihapus dari perangkat.
      }
    }
    _token = null;
    try {
      await _messaging?.deleteToken();
    } catch (_) {}
  }

  /// Tap yang datang sebelum HomeShell siap (cold start) diambil sekali di sini.
  PushDestination? takePendingTap() {
    final PushDestination? destination = _pendingTap;
    _pendingTap = null;
    return destination;
  }

  Future<String?> _currentToken() async {
    try {
      return await _messaging?.getToken();
    } catch (_) {
      return null;
    }
  }

  Future<void> _prepareLocalNotifications() async {
    const AndroidInitializationSettings android =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const DarwinInitializationSettings darwin = DarwinInitializationSettings();
    await _local.initialize(
      const InitializationSettings(android: android, iOS: darwin),
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );
    final AndroidFlutterLocalNotificationsPlugin? androidImpl = _local
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        pushChannelId,
        pushChannelName,
        description: pushChannelDescription,
        importance: Importance.high,
      ),
    );
  }

  Future<void> _requestPermission(FirebaseMessaging messaging) async {
    try {
      await messaging.requestPermission(alert: true, badge: true, sound: true);
      // Android 13+ also exposes POST_NOTIFICATIONS through the local plugin.
      await _local
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.requestNotificationsPermission();
    } catch (error) {
      debugPrint('Izin notifikasi tidak tersedia: $error');
    }
  }

  Future<void> _showForeground(RemoteMessage message) async {
    final RemoteNotification? notification = message.notification;
    if (notification == null) return;
    await _local.show(
      notification.hashCode,
      notification.title,
      notification.body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          pushChannelId,
          pushChannelName,
          channelDescription: pushChannelDescription,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: DarwinNotificationDetails(),
      ),
      payload: jsonEncode(message.data),
    );
  }

  void _onLocalNotificationTap(NotificationResponse response) {
    final String? payload = response.payload;
    if (payload == null || payload.isEmpty) return;
    try {
      final Object? decoded = jsonDecode(payload);
      if (decoded is Map) {
        _emit(PushDestination.fromData(Map<String, dynamic>.from(decoded)));
      }
    } catch (_) {}
  }

  void _handleMessage(RemoteMessage message) {
    _emit(PushDestination.fromData(message.data));
  }

  void _onTokenRefresh(String token) {
    _token = token;
    unawaited(_registerTokenValue(token));
  }

  Future<void> _registerTokenValue(String token) async {
    try {
      final String installationId =
          _installationId ?? await _devices.installationId();
      _installationId = installationId;
      await _push.registerToken(
        token: token,
        installationId: installationId,
      );
    } catch (error) {
      debugPrint('Refresh token FCM gagal didaftarkan: $error');
    }
  }

  void _emit(PushDestination destination) {
    if (destination.target == PushTarget.unknown) return;
    _pendingTap = destination;
    if (_taps.hasListener) {
      _taps.add(destination);
      _pendingTap = null;
    }
  }
}
