import 'dart:math';

import 'package:image/image.dart' as img;

enum FaceGate {
  ok,
  noFace,
  multipleFaces,
  tooSmall,
  tooBlurry,
  tooDark,
  tooBright,
  eyesClosed
}

String faceGateMessage(FaceGate gate) {
  switch (gate) {
    case FaceGate.ok:
      return 'Wajah valid.';
    case FaceGate.noFace:
      return 'Tidak ada wajah. Posisikan wajah di dalam lingkaran.';
    case FaceGate.multipleFaces:
      return 'Terdeteksi lebih dari satu wajah. Pastikan hanya Anda.';
    case FaceGate.tooSmall:
      return 'Wajah terlalu jauh. Dekatkan wajah ke kamera.';
    case FaceGate.tooBlurry:
      return 'Gambar blur. Tahan HP stabil dan coba lagi.';
    case FaceGate.tooDark:
      return 'Pencahayaan kurang. Cari tempat lebih terang.';
    case FaceGate.tooBright:
      return 'Pencahayaan berlebih. Hindari cahaya langsung.';
    case FaceGate.eyesClosed:
      return 'Mata tertutup. Buka mata dan lihat kamera.';
  }
}

FaceGate decideFaces({required int count, required double relativeWidth}) {
  if (count == 0) return FaceGate.noFace;
  if (count > 1) return FaceGate.multipleFaces;
  if (relativeWidth < 0.10) return FaceGate.tooSmall;
  return FaceGate.ok;
}

double meanBrightness(img.Image gray) {
  double sum = 0;
  for (var y = 0; y < gray.height; y++) {
    for (var x = 0; x < gray.width; x++) {
      sum += gray.getPixel(x, y).r.toDouble();
    }
  }
  return sum / (gray.width * gray.height * 255.0);
}

double laplacianVariance(img.Image gray) {
  double sum = 0;
  double sumSq = 0;
  int n = 0;
  for (var y = 1; y < gray.height - 1; y++) {
    for (var x = 1; x < gray.width - 1; x++) {
      final double c = gray.getPixel(x, y).r.toDouble();
      final double lap = gray.getPixel(x - 1, y).r.toDouble() +
          gray.getPixel(x + 1, y).r.toDouble() +
          gray.getPixel(x, y - 1).r.toDouble() +
          gray.getPixel(x, y + 1).r.toDouble() -
          4 * c;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n == 0) return 0;
  final double mean = sum / n;
  return sumSq / n - mean * mean;
}

class QualityResult {
  QualityResult({required this.gate, required this.score});
  final FaceGate gate;
  final double score;
}

QualityResult assessQuality({
  required img.Image grayFace,
  required double relativeWidth,
  double blurThreshold = 30.0,
}) {
  final double variance = laplacianVariance(grayFace);
  final double brightness = meanBrightness(grayFace);

  if (brightness < 0.05) {
    return QualityResult(
        gate: FaceGate.tooDark,
        score: _score(variance, brightness, relativeWidth, blurThreshold));
  }
  if (brightness > 0.99) {
    return QualityResult(
        gate: FaceGate.tooBright,
        score: _score(variance, brightness, relativeWidth, blurThreshold));
  }
  if (variance < blurThreshold) {
    return QualityResult(
        gate: FaceGate.tooBlurry,
        score: _score(variance, brightness, relativeWidth, blurThreshold));
  }
  return QualityResult(
      gate: FaceGate.ok,
      score: _score(variance, brightness, relativeWidth, blurThreshold));
}

double _score(double variance, double brightness, double relativeWidth,
    double blurThreshold) {
  final double sharp = (variance / (blurThreshold * 4)).clamp(0.0, 1.0);
  final double bright = brightness < 0.5
      ? (brightness / 0.5).clamp(0.0, 1.0)
      : ((1 - brightness) / 0.5).clamp(0.0, 1.0);
  final double size = ((relativeWidth - 0.25) / 0.5).clamp(0.0, 1.0);
  return (sharp + bright + size) / 3.0;
}

img.Image cropFace(img.Image src,
    {required int left,
    required int top,
    required int width,
    required int height,
    double margin = 0.2}) {
  final int mx = (width * margin).round();
  final int my = (height * margin).round();
  final int x = max(0, left - mx);
  final int y = max(0, top - my);
  final int w = min(src.width - x, width + 2 * mx);
  final int h = min(src.height - y, height + 2 * my);
  return img.copyCrop(src, x: x, y: y, width: w, height: h);
}

List<double> preprocess112(img.Image faceCrop) {
  final img.Image resized = img.copyResize(faceCrop, width: 112, height: 112);
  final List<double> out = List<double>.filled(112 * 112 * 3, 0);
  var i = 0;
  for (var y = 0; y < 112; y++) {
    for (var x = 0; x < 112; x++) {
      final p = resized.getPixel(x, y);
      out[i++] = (p.r.toDouble() - 127.5) / 128.0;
      out[i++] = (p.g.toDouble() - 127.5) / 128.0;
      out[i++] = (p.b.toDouble() - 127.5) / 128.0;
    }
  }
  return out;
}

class FacePrepOutcome {
  FacePrepOutcome.rejected({required this.gate, required this.score})
      : modelInput = null;
  FacePrepOutcome.accepted({required this.score, required this.modelInput})
      : gate = FaceGate.ok;
  final FaceGate gate;
  final double score;
  final List<double>? modelInput;
}

FacePrepOutcome evaluateFaceCapture({
  required img.Image decoded,
  required int left,
  required int top,
  required int width,
  required int height,
  required double relativeWidth,
  double blurThreshold = 30.0,
}) {
  final img.Image crop =
      cropFace(decoded, left: left, top: top, width: width, height: height);
  final img.Image gray = img.grayscale(crop);
  final QualityResult quality = assessQuality(
    grayFace: gray,
    relativeWidth: relativeWidth,
    blurThreshold: blurThreshold,
  );
  if (quality.gate != FaceGate.ok) {
    return FacePrepOutcome.rejected(gate: quality.gate, score: quality.score);
  }
  return FacePrepOutcome.accepted(
      score: quality.score, modelInput: preprocess112(crop));
}

List<double> l2normalize(List<double> v) {
  double sum = 0;
  for (final x in v) {
    sum += x * x;
  }
  final double norm = sqrt(sum);
  if (norm == 0) return List<double>.filled(v.length, 0);
  return [for (final x in v) x / norm];
}
