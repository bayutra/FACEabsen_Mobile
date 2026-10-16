import 'dart:math' as math;

/// Eye-openness source. ML Kit on Android exposes `leftEyeOpenProbability`
/// (0..1). On iOS that field is **not available** — only eye landmark points.
/// This enum lets the liveness engine apply the right thresholds per platform
/// instead of silently failing every blink challenge on iOS.
enum EyeSignalSource {
  /// Native classifier probability (Android).
  probability,

  /// Derived from eye contour geometry (iOS fallback).
  landmarkRatio,
}

/// A 2D landmark point in image-normalised space (0..1), matching ML Kit.
class EyePoint {
  const EyePoint(this.x, this.y);
  final double x;
  final double y;
}

/// Open/closed thresholds per signal source.
///
/// `landmarkRatio` values are provisional: they must be calibrated on a real
/// iPhone against known open/closed frames (see docs/IOS_SETUP.md). Until then
/// they are deliberately wide so the challenge stays passable.
class BlinkThresholds {
  const BlinkThresholds(this.open, this.closed);
  final double open;
  final double closed;

  static const BlinkThresholds forProbability = BlinkThresholds(0.6, 0.4);
  static const BlinkThresholds forLandmarkRatio = BlinkThresholds(0.16, 0.09);

  static BlinkThresholds forSource(EyeSignalSource src) =>
      src == EyeSignalSource.probability ? forProbability : forLandmarkRatio;
}

/// Eye openness in 0..1 derived from the eye contour's aspect ratio.
///
/// Openness = contourHeight / contourWidth, i.e. the classic eye-aspect-ratio.
/// A wide-open eye is roughly 0.25-0.35; a shut eye collapses toward 0.
/// Returns null when there are too few points or the geometry is degenerate
/// (a flat contour has zero width/height and carries no signal).
///
/// Pure Dart: unit-tested with synthetic contours, no device needed.
double? eyeOpenRatioFromLandmarks(List<EyePoint> contour) {
  if (contour.length < 4) return null;
  var minX = double.infinity;
  var minY = double.infinity;
  var maxX = double.negativeInfinity;
  var maxY = double.negativeInfinity;
  for (final EyePoint p in contour) {
    if (!p.x.isFinite || !p.y.isFinite) return null;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  final double width = maxX - minX;
  final double height = maxY - minY;
  // Degenerate: a point-like contour means the detector lost the eye.
  if (width <= 1e-6 || height <= 1e-6) return null;
  final double ratio = height / width;
  // Clamp: contour noise can exceed the expected open-eye ceiling.
  return math.min(1.0, ratio);
}