import 'dart:math' as math;





enum EyeSignalSource {
  
  probability,

  
  landmarkRatio,
}


class EyePoint {
  const EyePoint(this.x, this.y);
  final double x;
  final double y;
}






class BlinkThresholds {
  const BlinkThresholds(this.open, this.closed);
  final double open;
  final double closed;

  static const BlinkThresholds forProbability = BlinkThresholds(0.6, 0.4);
  static const BlinkThresholds forLandmarkRatio = BlinkThresholds(0.16, 0.09);

  static BlinkThresholds forSource(EyeSignalSource src) =>
      src == EyeSignalSource.probability ? forProbability : forLandmarkRatio;
}









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
  
  if (width <= 1e-6 || height <= 1e-6) return null;
  final double ratio = height / width;
  
  return math.min(1.0, ratio);
}