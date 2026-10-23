import 'dart:io';

import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

/// Runs the auxiliary 35-point facial landmark model.
///
/// The model card supplied with the asset specifies a 60x60 RGB float input
/// and 70 output values. Output is interpreted as 35 normalized (x, y) pairs.
/// Predictions outside [0, 1] are rejected instead of being used as liveness
/// evidence.
class FacialLandmarkEmbedder {
  Interpreter? _interpreter;

  Future<void> load() async {
    _interpreter ??= await Interpreter.fromAsset(
      'models/facial_landmarks_model_float32.tflite',
    );
    final List<int> inputShape = _interpreter!.getInputTensor(0).shape;
    final List<int> outputShape = _interpreter!.getOutputTensor(0).shape;
    if (inputShape.length != 4 ||
        inputShape[1] != 60 ||
        inputShape[2] != 60 ||
        inputShape[3] != 3 ||
        outputShape.fold<int>(1, (int a, int b) => a * b) != 70) {
      _interpreter!.close();
      _interpreter = null;
      throw StateError(
        'Unexpected facial landmark model tensor shapes: '
        '$inputShape -> $outputShape',
      );
    }
  }

  Future<FaceLandmarkCenter?> predict(
    String imagePath, {
    required double leftEdge,
    required double topEdge,
    required double faceWidth,
    required double faceHeight,
  }) async {
    await load();
    final img.Image? decoded = img.decodeImage(await File(imagePath).readAsBytes());
    if (decoded == null) return null;

    final int left = leftEdge.floor().clamp(0, decoded.width - 1).toInt();
    final int top = topEdge.floor().clamp(0, decoded.height - 1).toInt();
    final int right = (leftEdge + faceWidth)
        .ceil()
        .clamp(left + 1, decoded.width)
        .toInt();
    final int bottom = (topEdge + faceHeight)
        .ceil()
        .clamp(top + 1, decoded.height)
        .toInt();
    final img.Image face = img.copyCrop(
      decoded,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    );
    final img.Image resized = img.copyResize(face, width: 60, height: 60);
    final List<List<List<List<double>>>> input = <List<List<List<double>>>>[
      List<List<List<double>>>.generate(
        60,
        (int y) => List<List<double>>.generate(60, (int x) {
          final img.Pixel p = resized.getPixel(x, y);
          return <double>[
            (p.r.toDouble() - 127.5) / 128.0,
            (p.g.toDouble() - 127.5) / 128.0,
            (p.b.toDouble() - 127.5) / 128.0,
          ];
        }),
      ),
    ];
    final List<List<double>> output = <List<double>>[
      List<double>.filled(70, 0),
    ];
    _interpreter!.run(input, output);

    double sumX = 0;
    double sumY = 0;
    for (int i = 0; i < 70; i += 2) {
      final double x = output[0][i];
      final double y = output[0][i + 1];
      if (!x.isFinite || !y.isFinite || x < 0 || x > 1 || y < 0 || y > 1) {
        return null;
      }
      sumX += x;
      sumY += y;
    }
    return FaceLandmarkCenter(
      x: left + (sumX / 35) * (right - left),
      y: top + (sumY / 35) * (bottom - top),
    );
  }

  void close() {
    _interpreter?.close();
    _interpreter = null;
  }
}

class FaceLandmarkCenter {
  const FaceLandmarkCenter({required this.x, required this.y});
  final double x;
  final double y;
}
