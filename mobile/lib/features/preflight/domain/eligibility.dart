/// Pure eligibility evaluation for the Stitch "Pra-Validasi & Geofence" screen.
///
/// Four gates must pass before a punch is meaningful (PRD §16-§21):
/// account active, GPS accuracy usable, inside the perimeter, and a roster row
/// for today. Pure Dart so every rule is unit-testable without a device.
enum GateId { account, accuracy, geofence, schedule }

enum GateState { pass, warn, fail }

class GateResult {
  const GateResult({
    required this.id,
    required this.title,
    required this.badge,
    required this.state,
    required this.detail,
    this.chips = const [],
  });

  final GateId id;
  final String title;
  final String badge;
  final GateState state;
  final String detail;
  final List<String> chips;
}

/// Server tolerance for a trustworthy fix (PRD §16, `GEO_MAX_ACCURACY_M`).
const int kMaxAccuracyMeters = 50;

GateResult evaluateAccount({required bool isActive, required bool hasProfile}) {
  if (!hasProfile) {
    return const GateResult(
      id: GateId.account,
      title: 'Perangkat Terdaftar',
      badge: 'Tidak Ditemukan',
      state: GateState.fail,
      detail: 'Akun ini belum terhubung ke data karyawan.',
    );
  }
  return GateResult(
    id: GateId.account,
    title: 'Perangkat Terdaftar',
    badge: isActive ? 'Aktif' : 'Nonaktif',
    state: isActive ? GateState.pass : GateState.fail,
    detail: isActive
        ? 'Akun aktif dan terhubung ke data karyawan.'
        : 'Akun dinonaktifkan. Hubungi admin SDM.',
    chips: isActive ? const ['ID Terdaftar', 'Role valid'] : const [],
  );
}

GateResult evaluateAccuracy(double? accuracyMeters) {
  if (accuracyMeters == null) {
    return const GateResult(
      id: GateId.accuracy,
      title: 'Akurasi Sinyal GPS',
      badge: 'Tidak Ada',
      state: GateState.warn,
      detail: 'Belum ada titik GPS. Presensi tetap bisa dicoba, server yang menilai.',
    );
  }
  // Within half the tolerance is comfortable; the rest still warns.
  final bool good = accuracyMeters <= kMaxAccuracyMeters / 2;
  final bool usable = accuracyMeters <= kMaxAccuracyMeters;
  return GateResult(
    id: GateId.accuracy,
    title: 'Akurasi Sinyal GPS',
    badge: good ? 'Optimal' : (usable ? 'Cukup' : 'Lemah'),
    // Never FAIL: the server re-validates accuracy on the punch itself.
    state: good ? GateState.pass : GateState.warn,
    detail: usable
        ? 'Akurasi ±${accuracyMeters.round()} m (maks $kMaxAccuracyMeters m).'
        : 'Akurasi ±${accuracyMeters.round()} m — server mungkin menolak, pindahkan ke dekat jendela.',
  );
}

GateResult evaluateGeofence({required bool? inside, required double? distanceM, required bool? mockSuspected}) {
  if (mockSuspected == true) {
    return const GateResult(
      id: GateId.geofence,
      title: 'Geofencing Area RS',
      badge: 'Lokasi Palsu',
      state: GateState.fail,
      detail: 'Server mencurigai lokasi dimock (fake GPS). Matikan mock location.',
    );
  }
  if (inside == null) {
    return const GateResult(
      id: GateId.geofence,
      title: 'Geofencing Area RS',
      badge: 'Menunggu',
      state: GateState.warn,
      detail: 'Lokasi belum diverifikasi server.',
    );
  }
  return GateResult(
    id: GateId.geofence,
    title: 'Geofencing Area RS',
    badge: inside ? 'Dalam Radius Sah' : 'Di Luar Radius',
    state: inside ? GateState.pass : GateState.fail,
    detail: inside
        ? '${distanceM?.round() ?? 0} meter dari titik presensi.'
        : '${distanceM?.round() ?? 0} meter dari titik presensi (di luar radius).',
  );
}

GateResult evaluateSchedule({required bool hasShift, String? window, String? name}) {
  if (!hasShift) {
    return const GateResult(
      id: GateId.schedule,
      title: 'Jadwal Shift Dinas',
      badge: 'Tidak Ada Jadwal',
      state: GateState.fail,
      detail: 'Belum ada roster hari ini, presensi tidak dapat dicatat.',
    );
  }
  return GateResult(
    id: GateId.schedule,
    title: 'Jadwal Shift Dinas',
    badge: 'Tepat Waktu',
    state: GateState.pass,
    detail: '${name ?? 'Shift'} · ${window ?? '—'}',
  );
}

/// True when nothing blocks the punch: no FAIL gate. Warnings still allow it.
bool canProceed(List<GateResult> gates) =>
    !gates.any((GateResult g) => g.state == GateState.fail);

int passedCount(List<GateResult> gates) =>
    gates.where((GateResult g) => g.state == GateState.pass).length;

/// Gates the punch must satisfy, mirroring what the server will actually
/// reject. GPS accuracy is deliberately NOT here: the server re-validates
/// `GEO_MAX_ACCURACY_M` on every punch, so failing the user here would block
/// a punch that would otherwise be accepted (and indoors a fix is often 40-60 m
/// on an old handset). Blocking early just adds friction with no safety gain.
bool isBlocking(GateResult g) => switch (g.id) {
      GateId.geofence || GateId.schedule || GateId.account => true,
      GateId.accuracy => false,
    };

/// Gates that stopped the punch, for the "perbaiki yang gagal" hint.
List<GateResult> blockingGates(List<GateResult> gates) =>
    gates.where(isBlocking).where((GateResult g) => g.state == GateState.fail).toList();
