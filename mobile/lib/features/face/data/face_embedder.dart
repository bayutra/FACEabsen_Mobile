import 'package:tflite_flutter/tflite_flutter.dart';

import '../domain/face_quality.dart' show l2normalize;

class FaceEmbedder {
  Interpreter? _interpreter;

  Future<void> load() async {
    _interpreter ??= await Interpreter.fromAsset('models/mobilefacenet.tflite');
  }

  bool get isLoaded => _interpreter != null;

  List<double> embed(List<double> modelInput) {
    final Interpreter? itp = _interpreter;
    if (itp == null) {
      throw StateError('Embedder not loaded. Call load() first.');
    }
    if (modelInput.length != 112 * 112 * 3) {
      throw ArgumentError('Expected 37632 floats, got ${modelInput.length}');
    }

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
