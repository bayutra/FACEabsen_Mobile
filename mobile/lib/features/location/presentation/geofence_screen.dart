import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/network/error_detail.dart';
import '../../../core/theme/app_colors.dart';
import '../data/location_repository.dart';
import '../domain/geo_models.dart';

/// STEP 11 pre-validation screen (Stitch "Pra-Validasi & Geofence"):
/// hospital card with semantic accent line, fix details, verdict badge.
class GeofenceScreen extends StatefulWidget {
  const GeofenceScreen({super.key, required this.locations});

  final LocationRepository locations;

  @override
  State<GeofenceScreen> createState() => _GeofenceScreenState();
}

class _GeofenceScreenState extends State<GeofenceScreen> {
  GeoFix? _fix;
  GeofenceResult? _verdict;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final GeoFix fix = await widget.locations.getFix();
      final GeofenceResult verdict = await widget.locations.checkGeofence(fix);
      if (mounted) {
        setState(() {
          _fix = fix;
          _verdict = verdict;
          _busy = false;
        });
      }
    } on LocationFailure catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _busy = false;
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Server tidak terjangkau. (${describeError(e)})';
          _busy = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Gagal memeriksa lokasi. (${describeError(e)})';
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final GeofenceResult? v = _verdict;
    final Color accent = v == null
        ? AppColors.borderStrong
        : v.inside
            ? AppColors.success
            : AppColors.error;
    return Scaffold(
      appBar: AppBar(title: const Text('Cek Lokasi')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: accent,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(v?.hospitalName ?? 'Rumah Sakit',
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(
                          v == null
                              ? 'Memeriksa…'
                              : 'Radius: ${v.radiusM.round()} m · Jarak Anda: ${v.distanceM.isNaN ? '—' : '${v.distanceM.round()} m'}',
                          style: const TextStyle(color: AppColors.inkSecondary, fontSize: 14),
                        ),
                        const SizedBox(height: 12),
                        if (v != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: v.inside ? AppColors.successTint : AppColors.errorTint,
                              borderRadius: BorderRadius.circular(AppColors.radiusFull),
                              border: Border.all(
                                  color: v.inside
                                      ? AppColors.successBorder
                                      : AppColors.errorBorder),
                            ),
                            child: Text(
                              v.explanation(),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: v.inside
                                    ? AppColors.successText
                                    : AppColors.errorText,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: _fix == null
                    ? const Text('Belum ada titik GPS.',
                        style: TextStyle(color: AppColors.inkSecondary, fontSize: 14))
                    : Text(
                        'Lat ${_fix!.latitude.toStringAsFixed(6)}\n'
                        'Lon ${_fix!.longitude.toStringAsFixed(6)}\n'
                        'Akurasi ±${_fix!.accuracyM.toStringAsFixed(0)} m'
                        '${_fix!.isMocked ? '\nPERINGATAN: lokasi palsu' : ''}',
                        style: const TextStyle(fontSize: 14, height: 1.6),
                      ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.errorText, fontSize: 14)),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _refresh,
              child: Text(_busy ? 'Memeriksa…' : 'Periksa ulang'),
            ),
          ],
        ),
      ),
    );
  }
}
