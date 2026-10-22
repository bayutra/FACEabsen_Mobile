import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../data/handover_repository.dart';

class HandoverFormScreen extends StatefulWidget {
  const HandoverFormScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<HandoverFormScreen> createState() => _HandoverFormScreenState();
}

class _HandoverFormScreenState extends State<HandoverFormScreen> {
  late final HandoverRepository _repo = HandoverRepository(dio: widget.dio);

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _title = TextEditingController();
  final TextEditingController _patient = TextEditingController();
  final TextEditingController _tasks = TextEditingController();
  final TextEditingController _meds = TextEditingController();
  final TextEditingController _incidents = TextEditingController();
  final TextEditingController _notes = TextEditingController();

  bool _saving = false;

  @override
  void dispose() {
    _title.dispose();
    _patient.dispose();
    _tasks.dispose();
    _meds.dispose();
    _incidents.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      await _repo.create(
        title: _title.text,
        patientSummary: _patient.text,
        pendingTasks: _tasks.text,
        medications: _meds.text,
        incidents: _incidents.text,
        notes: _notes.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Operan Jaga Baru')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: <Widget>[
            TextFormField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Judul operan'),
              validator: (String? v) =>
                  (v ?? '').trim().length < 2 ? 'Minimal 2 karakter.' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _patient,
              decoration: const InputDecoration(labelText: 'Ringkasan pasien'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _tasks,
              decoration: const InputDecoration(labelText: 'Tugas tertunda'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _meds,
              decoration: const InputDecoration(labelText: 'Obat/terapi'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _incidents,
              decoration: const InputDecoration(labelText: 'Insiden/kejadian'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              decoration: const InputDecoration(labelText: 'Catatan tambahan'),
              maxLines: 3,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Menyimpan…' : 'Simpan'),
            ),
          ],
        ),
      ),
    );
  }
}
