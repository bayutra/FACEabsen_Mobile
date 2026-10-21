import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

/// On-device face detection (ML Kit, offline after first model fetch).
class FaceDetectorService {
  /// Set [classification] for eye-open probabilities (liveness, STEP 10) and
  /// [contours] for eye outline geometry.
  ///
  /// Classification is **Android-only** in ML Kit; on iOS
  /// `leftEyeOpenProbability` is always null. Contours ARE available on both,
  /// so enabling them keeps blink liveness workable on iOS via
  /// `eye_geometry.dart` (see docs/IOS_SETUP.md).
  FaceDetectorService({
    bool classification = false,
    bool contours = false,
    bool landmarks = false,
    FaceDetectorMode performanceMode = FaceDetectorMode.accurate,
    double minFaceSize = 0.10,
    void Function(String message)? onError,
  })  : _onError = onError,
        _detector = FaceDetector(
          options: FaceDetectorOptions(
            enableClassification: classification,
            enableLandmarks: landmarks,
            enableContours: contours,
            performanceMode: performanceMode,
            minFaceSize: minFaceSize,
          ),
        );

  final FaceDetector _detector;
  final void Function(String message)? _onError;

  /// Throws [StateError] with a user-actionable message when ML Kit is
  /// unavailable (no/outdated Google Play Services, model not yet
  /// downloaded). Callers surface this instead of a generic failure.
  Future<List<Face>> detect(String filePath) async {
    try {
      return await _detector.processImage(InputImage.fromFilePath(filePath));
    } catch (e) {
      final String cause = e.toString().split('\n').first;
      final String short = cause.length <= 100 ? cause : '${cause.substring(0, 97)}...';
      final String message = 'Deteksi wajah tidak tersedia di HP ini. Perbarui Google Play '
          'Services, hubungkan internet sekali untuk unduh model, lalu coba lagi. ($short)';
      // The passive scan loop swallows frame errors, so surface the reason here
      // or the user only ever sees "face not detected" with no explanation.
      _onError?.call(message);
      if (kDebugMode) {
        debugPrint('[FaceDetectorService] $message');
      }
      throw StateError(message);
    }
  }

  void dispose() => _detector.close();
}
