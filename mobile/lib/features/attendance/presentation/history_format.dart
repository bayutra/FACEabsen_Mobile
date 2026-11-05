///
/// Formatting helpers shared by the history screen and its detail sheet.
/// Kept dependency-free on purpose so both files can use them cheaply.
String clockHm(String? iso) {
  if (iso == null) return '--:--';
  final DateTime? d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '--:--';
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

String clockHms(String? iso) {
  if (iso == null) return '--:--:--';
  final DateTime? d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '--:--:--';
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}:${d.second.toString().padLeft(2, '0')}';
}

String formatWorkDateId(String ymd) {
  final DateTime? d = DateTime.tryParse(ymd);
  if (d == null) return ymd;
  const List<String> hari = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu'
  ];
  const List<String> bulan = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  return '${hari[d.weekday - 1]}, ${d.day} ${bulan[d.month - 1]} ${d.year}';
}

String formatWorkDateLongId(String ymd) {
  final DateTime? d = DateTime.tryParse(ymd);
  if (d == null) return ymd;
  const List<String> hari = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu'
  ];
  const List<String> bulan = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return '${hari[d.weekday - 1]}, ${d.day} ${bulan[d.month - 1]} ${d.year}';
}

String? effectiveDurationLabel(String? inIso, String? outIso) {
  final DateTime? a = inIso == null ? null : DateTime.tryParse(inIso);
  final DateTime? b = outIso == null ? null : DateTime.tryParse(outIso);
  if (a == null || b == null) return null;
  final Duration diff = b.difference(a);
  if (diff.isNegative) return null;
  return '${diff.inHours} Jam ${diff.inMinutes % 60} Menit';
}

String dateKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String initials(String name) {
  final List<String> parts =
      name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '—';
  if (parts.length == 1) {
    return parts.first
        .substring(0, parts.first.length >= 2 ? 2 : 1)
        .toUpperCase();
  }
  return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
}
