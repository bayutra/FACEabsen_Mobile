-- Kebijakan "1 karyawan = 1 perangkat ACTIVE" dihapus.
--
-- Perangkat baru kini langsung ACTIVE dan akun boleh dipakai di beberapa
-- perangkat (mis. HP pribadi + tablet ruangan). Index parsial ini akan
-- menggagalkan registrasi perangkat kedua, jadi harus dibuang.
DROP INDEX IF EXISTS "devices_one_active_per_employee";
