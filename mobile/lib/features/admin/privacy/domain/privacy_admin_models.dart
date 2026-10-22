
class PrivacyNotice {
  const PrivacyNotice({
    required this.version,
    required this.lang,
    required this.title,
    required this.body,
  });

  final String version;
  final String lang;
  final String title;
  final List<String> body;

  factory PrivacyNotice.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawBody = (json['body'] as List?) ?? const <dynamic>[];
    return PrivacyNotice(
      version: json['version'] as String? ?? '—',
      lang: json['lang'] as String? ?? 'id',
      title: json['title'] as String? ?? 'Pemberitahuan Privasi',
      body: rawBody.map((dynamic e) => e.toString()).toList(),
    );
  }
}
