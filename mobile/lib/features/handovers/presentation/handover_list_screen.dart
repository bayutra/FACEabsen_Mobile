import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../core/widgets/stitch.dart';
import '../data/handover_repository.dart';
import '../domain/handover_models.dart';
import 'handover_detail_screen.dart';
import 'handover_form_screen.dart';

class HandoverListScreen extends StatefulWidget {
  const HandoverListScreen({super.key, required this.dio});

  final Dio dio;

  @override
  State<HandoverListScreen> createState() => _HandoverListScreenState();
}

class _HandoverListScreenState extends State<HandoverListScreen> {
  late final HandoverRepository _repo = HandoverRepository(dio: widget.dio);

  List<Handover> _items = const <Handover>[];
  bool _loading = true;
  String? _error;
  final String _status = '';

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
      final List<Handover> items = await _repo.list(
        status: _status.isEmpty ? null : _status,
      );
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openCreate() async {
    final bool? saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => HandoverFormScreen(dio: widget.dio),
      ),
    );
    if (saved == true && mounted) {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Operan Jaga')),
      floatingActionButton: FloatingActionButton(
        onPressed: _openCreate,
        child: const Icon(Icons.add),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading && _items.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _items.isEmpty
                ? Center(child: Text(_error!))
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: <Widget>[
                      if (_items.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 32),
                          child: Center(child: Text('Belum ada operan jaga.')),
                        )
                      else
                        for (final Handover h in _items) ...<Widget>[
                          Card(
                            child: ListTile(
                              title: Text(h.title),
                              subtitle: Text(
                                '${h.fromName ?? '-'} · ${h.departmentName ?? '-'}\n'
                                '${h.statusLabel}',
                              ),
                              isThreeLine: true,
                              trailing: StatusPill(h.status),
                              onTap: () => Navigator.of(context).push(
                                MaterialPageRoute<void>(
                                  builder: (_) => HandoverDetailScreen(
                                    dio: widget.dio,
                                    id: h.id,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],
                    ],
                  ),
      ),
    );
  }
}
