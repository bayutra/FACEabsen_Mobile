import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../data/handover_repository.dart';
import '../domain/handover_models.dart';

class HandoverDetailScreen extends StatefulWidget {
  const HandoverDetailScreen({super.key, required this.dio, required this.id});

  final Dio dio;
  final String id;

  @override
  State<HandoverDetailScreen> createState() => _HandoverDetailScreenState();
}

class _HandoverDetailScreenState extends State<HandoverDetailScreen> {
  late final HandoverRepository _repo = HandoverRepository(dio: widget.dio);

  Handover? _item;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // list to find by id (no GET single in repo yet)
      final List<Handover> items = await _repo.list();
      Handover? found;
      for (final Handover h in items) {
        if (h.id == widget.id) {
          found = h;
          break;
        }
      }
      if (!mounted) return;
      setState(() {
        _item = found;
        _loading = false;
        if (found == null) _error = 'Operan tidak ditemukan.';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _acknowledge() async {
    try {
      await _repo.acknowledge(widget.id);
      if (!mounted) return;
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Operan diterima.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  Widget _section(String title, String? value) {
    if (value == null || value.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(value),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final Handover? h = _item;
    return Scaffold(
      appBar: AppBar(title: const Text('Detail Operan')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : h == null
                  ? const Center(child: Text('Tidak ditemukan'))
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: <Widget>[
                        Text(h.title, style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 8),
                        Text('Dari: ${h.fromName ?? '-'} (${h.fromNo ?? '-'})'),
                        Text('Unit: ${h.departmentName ?? '-'}'),
                        Text('Status: ${h.statusLabel}'),
                        if (h.acknowledgedAt != null)
                          Text('Diterima: ${h.acknowledgedAt}'),
                        const SizedBox(height: 16),
                        _section('Ringkasan pasien', h.patientSummary),
                        _section('Tugas tertunda', h.pendingTasks),
                        _section('Obat/terapi', h.medications),
                        _section('Insiden', h.incidents),
                        _section('Catatan', h.notes),
                        const SizedBox(height: 24),
                        if (h.pending)
                          FilledButton.icon(
                            onPressed: _acknowledge,
                            icon: const Icon(Icons.check),
                            label: const Text('Terima operan'),
                          ),
                      ],
                    ),
    );
  }
}
