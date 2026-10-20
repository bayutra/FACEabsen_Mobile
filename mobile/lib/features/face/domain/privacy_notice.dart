/// STEP 21 — bundled privacy notice fallback (shown when offline).
/// Server truth: GET /privacy/notice. Legal final review by hospital/DPO
/// required before production (PRD §66).
class PrivacyNotice {
  const PrivacyNotice({
    required this.version,
    required this.title,
    required this.lines,
  });

  final String version;
  final String title;
  final List<String> lines;

  String get body => lines.join('\n\n');

  factory PrivacyNotice.fromJson(Map<String, dynamic> json) {
    final List raw = (json['lines'] as List?) ?? (json['body'] as List?) ?? [];
    return PrivacyNotice(
      version: json['version'] as String? ?? fallback.version,
      title: json['title'] as String? ?? fallback.title,
      lines: [for (final l in raw) l.toString()],
    );
  }

  static const PrivacyNotice fallback = PrivacyNotice(
    version: '2026-10-01',
    title: 'Pemberitahuan Privasi — Presensi Wajah',
    lines: [
      'Data wajah (template biometrik) dan perangkat Anda diproses semata untuk presensi karyawan rumah sakit.',
      'Foto mentah tidak pernah dikirim ke server. Template tersimpan terenkripsi.',
      'Persetujuan dapat dicabut kapan saja; pencabutan menghentikan presensi wajah berikutnya.',
    ],
  );
}
