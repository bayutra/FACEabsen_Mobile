import 'package:flutter/material.dart';

import '../data/auth_repository.dart';

class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key, required this.email, required this.auth});

  final String email;
  final AuthRepository auth;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  final TextEditingController _code = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _info;

  Future<void> _verify() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.verifyEmail(email: widget.email, code: _code.text.trim());
      if (!mounted) return;
      setState(() {
        _info = 'Email terverifikasi. Akun menunggu persetujuan admin.';
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Kode tidak valid atau kedaluwarsa.';
        _busy = false;
      });
    }
  }

  Future<void> _resend() async {
    try {
      await widget.auth.resendVerification(widget.email);
      if (!mounted) return;
      setState(() => _info = 'Kode baru telah dikirim.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Gagal mengirim ulang kode.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verifikasi Email')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text('Kode dikirim ke ${widget.email}'),
            const SizedBox(height: 12),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(labelText: 'Kode 6 digit'),
            ),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.red)),
            if (_info != null)
              Text(_info!, style: const TextStyle(color: Colors.green)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _busy ? null : _verify,
              child: Text(_busy ? 'Memverifikasi...' : 'Verifikasi'),
            ),
            TextButton(onPressed: _resend, child: const Text('Kirim ulang kode')),
          ],
        ),
      ),
    );
  }
}