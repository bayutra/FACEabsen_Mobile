String? validateCurrentPassword(String? value) {
  if (value == null || value.isEmpty) return 'Password saat ini wajib diisi.';
  return null;
}

String? validateNewPassword(String? value) {
  if (value == null || value.isEmpty) return 'Password baru wajib diisi.';
  if (value.length < 8) return 'Password baru minimal 8 karakter.';
  if (!RegExp(r'[a-z]').hasMatch(value)) {
    return 'Password baru wajib mengandung huruf kecil.';
  }
  if (!RegExp(r'[A-Z]').hasMatch(value)) {
    return 'Password baru wajib mengandung huruf besar.';
  }
  if (!RegExp(r'[0-9]').hasMatch(value)) {
    return 'Password baru wajib mengandung angka.';
  }
  return null;
}

String? validatePasswordConfirmation(String? value, String newPassword) {
  if (value == null || value.isEmpty) {
    return 'Ulangi password baru wajib diisi.';
  }
  if (value != newPassword) return 'Password tidak sama';
  return null;
}
