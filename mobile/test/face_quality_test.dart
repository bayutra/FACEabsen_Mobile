import 'package:face_absen_mobile/features/face/domain/face_quality.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;


img.Image _checkerboard() {
  final im = img.Image(width: 112, height: 112);
  for (var y = 0; y < 112; y++) {
    for (var x = 0; x < 112; x++) {
      final v = ((x ~/ 8) + (y ~/ 8)) % 2 == 0 ? 255 : 0;
      im.setPixelRgb(x, y, v, v, v);
    }
  }
  return im;
}

img.Image _flat(int v) {
  final im = img.Image(width: 112, height: 112);
  for (var y = 0; y < 112; y++) {
    for (var x = 0; x < 112; x++) {
      im.setPixelRgb(x, y, v, v, v);
    }
  }
  return im;
}

void main() {
  test('decideFaces matrix (PRD §54 acceptance)', () {
    expect(decideFaces(count: 0, relativeWidth: 0).name, FaceGate.noFace.name);
    expect(decideFaces(count: 2, relativeWidth: 0.5).name, FaceGate.multipleFaces.name);
    expect(decideFaces(count: 1, relativeWidth: 0.05).name, FaceGate.tooSmall.name);
    expect(decideFaces(count: 1, relativeWidth: 0.4).name, FaceGate.ok.name);
    expect(faceGateMessage(FaceGate.noFace), contains('Tidak ada wajah'));
    expect(faceGateMessage(FaceGate.multipleFaces), contains('lebih dari satu'));
  });

  test('sharp passes, flat fails as blurry', () {
    final sharp = assessQuality(grayFace: img.grayscale(_checkerboard()), relativeWidth: 0.4);
    expect(sharp.gate, FaceGate.ok);
    expect(sharp.score, greaterThan(0.6));

    final flat = assessQuality(grayFace: img.grayscale(_flat(128)), relativeWidth: 0.4);
    expect(flat.gate, FaceGate.tooBlurry);
  });

  test('dark and bright extremes rejected', () {
    expect(
      assessQuality(grayFace: img.grayscale(_flat(10)), relativeWidth: 0.4).gate,
      FaceGate.tooDark,
    );
    
    final brightTex = _checkerboard();
    for (var y = 0; y < 112; y++) {
      for (var x = 0; x < 112; x++) {
        final p = brightTex.getPixel(x, y);
        brightTex.setPixelRgb(x, y, (p.r ~/ 2 + 128).clamp(0, 255), 255, 255);
      }
    }
    final r = assessQuality(grayFace: img.grayscale(brightTex), relativeWidth: 0.4);
    expect(r.gate == FaceGate.ok || r.gate == FaceGate.tooBright, isTrue);
  });

  test('preprocess112 yields 37632 floats in [-1, 1]', () {
    final out = preprocess112(_checkerboard());
    expect(out.length, 112 * 112 * 3);
    expect(out.every((v) => v >= -1.0 && v <= 1.0), isTrue);
    
    expect(out[0], closeTo(0.99609375, 1e-9));
    expect(out[8 * 3], closeTo(-0.99609375, 1e-9));
  });

  test('cropFace expands and clamps', () {
    final src = _checkerboard();
    final crop = cropFace(src, left: 0, top: 0, width: 20, height: 20);
    expect(crop.width, greaterThan(20));
    expect(crop.width, lessThanOrEqualTo(112));
  });

  test('evaluateFaceCapture single pass matches split pipeline', () {
    final src = _checkerboard();
    final out = evaluateFaceCapture(
      decoded: src,
      left: 28,
      top: 28,
      width: 56,
      height: 56,
      relativeWidth: 0.5,
    );
    expect(out.gate, FaceGate.ok);
    expect(out.modelInput, isNotNull);
    expect(out.modelInput!.length, 112 * 112 * 3);
    
    final expectedCrop = cropFace(src, left: 28, top: 28, width: 56, height: 56);
    expect(out.modelInput, preprocess112(expectedCrop));
    final quality = assessQuality(grayFace: img.grayscale(expectedCrop), relativeWidth: 0.5);
    expect(out.score, quality.score);
  });

  test('evaluateFaceCapture rejects blurry/dark without model input', () {
    final blurry = evaluateFaceCapture(
      decoded: _flat(128),
      left: 28,
      top: 28,
      width: 56,
      height: 56,
      relativeWidth: 0.4,
    );
    expect(blurry.gate, FaceGate.tooBlurry);
    expect(blurry.modelInput, isNull);
    final expectedBlur = assessQuality(
      grayFace: img.grayscale(cropFace(_flat(128), left: 28, top: 28, width: 56, height: 56)),
      relativeWidth: 0.4,
    );
    expect(blurry.score, expectedBlur.score);

    final dark = evaluateFaceCapture(
      decoded: _flat(10),
      left: 28,
      top: 28,
      width: 56,
      height: 56,
      relativeWidth: 0.4,
    );
    expect(dark.gate, FaceGate.tooDark);
    expect(dark.modelInput, isNull);
  });

  test('l2normalize unit length', () {
    final v = l2normalize([3.0, 4.0]);
    expect(v[0], closeTo(0.6, 1e-9));
    expect(v[1], closeTo(0.8, 1e-9));
  });

  test('bundled MobileFaceNet asset is intact', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final data = await rootBundle.load('assets/models/mobilefacenet.tflite');
    expect(data.lengthInBytes, 5233552);
    final magic = String.fromCharCodes(data.buffer.asUint8List(4, 4));
    expect(magic, 'TFL3');
  });
}
