import 'package:tflite_flutter/tflite_flutter.dart';

import '../domain/face_quality.dart' show l2normalize;

/// MobileFaceNet inference (112×112×3 → 192-d), bundled asset.
/// Source: MCarlomagno/FaceRecognitionAuth mobilefacenet.tflite (verified TFL3).
class FaceEmbedder {
  Interpreter? _interpreter;

  Future<void> load() async {
    // NB: fromAsset() prepends "assets/" sendiri — JANGAN sertakan prefix itu
    // (lihat tflite_flutter interpreter.dart). 'models/...' -> 'assets/models/...'.
    _interpreter ??= await Interpreter.fromAsset('models/mobilefacenet.tflite');
  }

  bool get isLoaded => _interpreter != null;

  /// Runs inference on a preprocess112 flat vector. Returns L2-normalized
  /// 192-d embedding.
  List<double> embed(List<double> modelInput) {
    final Interpreter? itp = _interpreter;
    if (itp == null) throw StateError('Embedder not loaded. Call load() first.');
    if (modelInput.length != 112 * 112 * 3) {
      throw ArgumentError('Expected 37632 floats, got ${modelInput.length}');
    }
    // Nest flat vector → [1][112][112][3].
    var k = 0;
    final List<List<List<List<double>>>> input = [
      List<List<List<double>>>.generate(
        112,
        (_) => List<List<double>>.generate(
          112,
          (_) => [modelInput[k++], modelInput[k++], modelInput[k++]],
        ),
      ),
    ];
    final List<List<double>> output = [List<double>.filled(192, 0)];
    itp.run(input, output);
    return l2normalize(output[0]);
  }

  void close() {
    _interpreter?.close();
    _interpreter = null;
  }
}
