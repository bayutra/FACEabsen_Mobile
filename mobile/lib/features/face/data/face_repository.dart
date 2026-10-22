import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import '../domain/face_quality.dart';
import '../domain/privacy_notice.dart';
import 'face_detector.dart';
import 'face_embedder.dart';

class FaceCapture {
  FaceCapture({required this.embedding, required this.qualityScore});
  final List<double> embedding;
  final double qualityScore;
}





class FaceResult {
  FaceResult._({required this.ok, required this.message, this.score, this.version, this.gate});

  factory FaceResult.success({required double score, required int version}) =>
      FaceResult._(ok: true, message: 'Wajah berhasil didaftarkan.', score: score, version: version, gate: FaceGate.ok);

  factory FaceResult.rejected(FaceGate gate, {double? score}) =>
      FaceResult._(ok: false, message: faceGateMessage(gate), score: score, gate: gate);

  factory FaceResult.failed(String message, {FaceGate? gate}) =>
      FaceResult._(ok: false, message: message, gate: gate);

  final bool ok;
  final String message;
  final double? score;
  final int? version;
  final FaceGate? gate;
}







class FaceRepository {
  FaceRepository({required Dio dio, required FaceDetectorService detector, required FaceEmbedder embedder})
      : _dio = dio,
        _detector = detector,
        _embedder = embedder;

  final Dio _dio;
  final FaceDetectorService _detector;
  final FaceEmbedder _embedder;

  
  
  
  
  String? _lastRejectionPath;
  String? _lastRejectionMessage;
  FaceGate? _lastRejectionGate;

  Future<bool> hasTemplate() async {
    try {
      final Response res = await _dio.get('/face/status');
      final Map data = res.data as Map;
      return data['registered'] == true;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return false;
      rethrow;
    }
  }

  Future<FaceResult> registerFromFile(String path, {String? noticeVersion}) async {
    await ensureConsent(noticeVersion: noticeVersion);
    final FaceCapture? capture = await captureEmbedding(path);
    if (capture == null) {
      
      
      final String m = await rejectionMessage(path);
      final FaceGate? g = await rejectionGate(path);
      return FaceResult.failed(m, gate: g);
    }
    try {
      final Response res = await _dio.post(
        '/face/register',
        data: {'template': capture.embedding, 'qualityScore': capture.qualityScore, 'algorithm': 'MobileFaceNet_v1'},
      );
      final Map body = res.data as Map;
      return FaceResult.success(score: capture.qualityScore, version: (body['version'] as num).toInt());
    } on DioException catch (e) {
      if (e.response?.statusCode == 400) {
        return FaceResult.failed('Server menolak template (kualitas rendah). Coba lagi.');
      }
      rethrow;
    }
  }

  
  
  
  
  Future<FaceCapture?> captureEmbedding(String path) async {
    final _EvaluatedPicture eval = await _evaluatePicture(path);
    if (eval.gate != FaceGate.ok || eval.modelInput == null) {
      _lastRejectionPath = path;
      _lastRejectionMessage = eval.message;
      _lastRejectionGate = eval.gate;
      return null;
    }
    _lastRejectionPath = path;
    _lastRejectionMessage = null;
    _lastRejectionGate = FaceGate.ok;
    await _embedder.load();
    final List<double> embedding = _embedder.embed(eval.modelInput!);
    return FaceCapture(embedding: embedding, qualityScore: eval.score);
  }

  
  
  
  Future<String> rejectionMessage(String path) async {
    if (_lastRejectionPath == path && _lastRejectionMessage != null) {
      return _lastRejectionMessage!;
    }
    final _EvaluatedPicture eval = await _evaluatePicture(path);
    _lastRejectionPath = path;
    _lastRejectionMessage = eval.gate == FaceGate.ok ? null : eval.message;
    _lastRejectionGate = eval.gate;
    return eval.message;
  }

  
  
  
  
  Future<FaceGate?> rejectionGate(String path) async {
    if (_lastRejectionPath == path && _lastRejectionGate != null) {
      return _lastRejectionGate;
    }
    final _EvaluatedPicture eval = await _evaluatePicture(path);
    _lastRejectionPath = path;
    _lastRejectionMessage = eval.gate == FaceGate.ok ? null : eval.message;
    _lastRejectionGate = eval.gate;
    return eval.gate;
  }

  
  
  Future<_EvaluatedPicture> _evaluatePicture(String path) async {
    final Uint8List jpeg = await File(path).readAsBytes();
    
    
    final img.Decoder? decoder = img.findDecoderForData(jpeg);
    final img.DecodeInfo? info = decoder?.startDecode(jpeg);
    if (info == null || info.width <= 0) {
      return _EvaluatedPicture(
        gate: FaceGate.noFace,
        score: 0,
        message: faceGateMessage(FaceGate.noFace),
      );
    }
    final faces = await _detector.detect(path);
    
    
    
    if (faces.isNotEmpty) {
      final Face face = faces.first;
      final double? leftOpen = face.leftEyeOpenProbability;
      final double? rightOpen = face.rightEyeOpenProbability;
      if (leftOpen != null &&
          rightOpen != null &&
          (leftOpen < 0.15 || rightOpen < 0.15)) {
        return _EvaluatedPicture(
          gate: FaceGate.eyesClosed,
          score: 0,
          message: faceGateMessage(FaceGate.eyesClosed),
        );
      }
    }
    int left = 0, top = 0, width = 0, height = 0;
    double boxWidth = 0;
    if (faces.isNotEmpty) {
      final box = faces.first.boundingBox;
      left = box.left.round();
      top = box.top.round();
      width = box.width.round();
      height = box.height.round();
      boxWidth = box.width;
    }
    final _PrepWire wire = await compute(
      _decodeGatePreprocess,
      _PrepJob(
        jpeg: TransferableTypedData.fromList(<Uint8List>[jpeg]),
        count: faces.length,
        left: left,
        top: top,
        width: width,
        height: height,
        boxWidth: boxWidth,
      ),
    );
    List<double>? modelInput;
    if (wire.modelInputBytes != null) {
      final ByteBuffer buf = wire.modelInputBytes!.materialize();
      modelInput = buf.asFloat64List().toList();
    }
    final FaceGate gate = FaceGate.values[wire.gateIndex];
    return _EvaluatedPicture(
      gate: gate,
      score: wire.score,
      message: wire.message,
      modelInput: modelInput,
    );
  }

  
  
  
  Future<void> ensureConsent({String? noticeVersion}) async {
    await _dio.post(
      '/privacy/consent',
      data: {
        'purpose': 'BIOMETRIC_ATTENDANCE',
        'granted': true,
        if (noticeVersion != null && noticeVersion.isNotEmpty) 'version': noticeVersion,
      },
    );
  }

  
  Future<PrivacyNotice> fetchNotice() async {
    try {
      final Response res = await _dio.get('/privacy/notice');
      return PrivacyNotice.fromJson(Map<String, dynamic>.from(res.data as Map));
    } catch (_) {
      return PrivacyNotice.fallback;
    }
  }
}


class _EvaluatedPicture {
  _EvaluatedPicture({
    required this.gate,
    required this.score,
    required this.message,
    this.modelInput,
  });
  final FaceGate gate;
  final double score;
  final String message;
  final List<double>? modelInput;
}



class _PrepJob {
  _PrepJob({
    required this.jpeg,
    required this.count,
    required this.left,
    required this.top,
    required this.width,
    required this.height,
    required this.boxWidth,
  });
  final TransferableTypedData jpeg;
  final int count;
  final int left;
  final int top;
  final int width;
  final int height;
  final double boxWidth;
}



class _PrepWire {
  _PrepWire({required this.gateIndex, required this.score, required this.message, this.modelInputBytes});
  final int gateIndex;
  final double score;
  final String message;
  final TransferableTypedData? modelInputBytes;
}



_PrepWire _decodeGatePreprocess(_PrepJob job) {
  final Uint8List bytes = job.jpeg.materialize().asUint8List();
  final img.Image? raw = img.decodeImage(bytes);
  if (raw == null) {
    return _PrepWire(
      gateIndex: FaceGate.noFace.index,
      score: 0,
      message: faceGateMessage(FaceGate.noFace),
    );
  }
  
  
  final double relativeWidth =
      job.boxWidth > 0 && raw.width > 0 ? job.boxWidth / raw.width : 0.0;
  img.Image decoded = raw;
  if (decoded.width > 480) {
    decoded = img.copyResize(decoded, width: 480);
  }
  final FaceGate countGate = decideFaces(count: job.count, relativeWidth: relativeWidth);
  if (countGate != FaceGate.ok) {
    return _PrepWire(
      gateIndex: countGate.index,
      score: 0,
      message: faceGateMessage(countGate),
    );
  }
  final FacePrepOutcome outcome = evaluateFaceCapture(
    decoded: decoded,
    left: job.left,
    top: job.top,
    width: job.width,
    height: job.height,
    relativeWidth: relativeWidth,
  );
  if (outcome.gate != FaceGate.ok || outcome.modelInput == null) {
    final String base = faceGateMessage(outcome.gate);
    return _PrepWire(
      gateIndex: outcome.gate.index,
      score: outcome.score,
      message: '${base.substring(0, base.length - 1)} (skor ${(outcome.score * 100).round()}%).',
    );
  }
  final Float64List vec = Float64List.fromList(outcome.modelInput!);
  return _PrepWire(
    gateIndex: FaceGate.ok.index,
    score: outcome.score,
    message: '',
    modelInputBytes: TransferableTypedData.fromList(<Uint8List>[vec.buffer.asUint8List()]),
  );
}
