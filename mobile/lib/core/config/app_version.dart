List<int> _versionParts(String value) {
  final String base = value.trim().split('+').first;
  return base
      .split('.')
      .map((String part) =>
          int.tryParse(part.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0)
      .toList(growable: false);
}

int compareAppVersions(String current, String minimum) {
  final List<int> left = _versionParts(current);
  final List<int> right = _versionParts(minimum);
  final int length = left.length > right.length ? left.length : right.length;
  for (int i = 0; i < length; i++) {
    final int l = i < left.length ? left[i] : 0;
    final int r = i < right.length ? right[i] : 0;
    if (l != r) return l.compareTo(r);
  }
  return 0;
}

bool isAppVersionBelow(String current, String minimum) =>
    compareAppVersions(current, minimum) < 0;
