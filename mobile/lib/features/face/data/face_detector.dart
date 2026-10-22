import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;


class FaceDetectorService {
  
  
  
  
  
  
  
  FaceDetectorService({
    bool classification = false,
    bool contours = false,
    bool landmarks = false,
    FaceDetectorMode performanceMode = FaceDetectorMode.accurate,
    double minFaceSize = 0.05,
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

  
  
  
  Future<List<Face>> detect(String filePath) async {
    try {
      
      final List<Face> first = await _detector.processImage(
        InputImage.fromFilePath(filePath),
      );
      if (first.isNotEmpty) return first;

      
      
      
      final File file = File(filePath);
      final Uint8List bytes = await file.readAsBytes();
      final img.Image? decoded = img.decodeImage(bytes);
      if (decoded == null) return first;
      final img.Image upright = img.bakeOrientation(decoded);
      final File tmp = File(
        '${Directory.systemTemp.path}/upright_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      await tmp.writeAsBytes(img.encodeJpg(upright, quality: 92));
      try {
        final List<Face> second = await _detector.processImage(
          InputImage.fromFilePath(tmp.path),
        );
        return second.isNotEmpty ? second : first;
      } finally {
        try {
          await tmp.delete();
        } catch (_) {}
      }
    } catch (e) {
      final String cause = e.toString().split('\n').first;
      final String short = cause.length <= 100 ? cause : '${cause.substring(0, 97)}...';
      final String message = 'Deteksi wajah tidak tersedia di HP ini. Perbarui Google Play '
          'Services, hubungkan internet sekali untuk unduh model, lalu coba lagi. ($short)';
      _onError?.call(message);
      if (kDebugMode) {
        debugPrint('[FaceDetectorService] $message');
      }
      throw StateError(message);
    }
  }

  void dispose() => _detector.close();
}
