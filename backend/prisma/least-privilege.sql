-- Least-privilege app role for production Postgres.
-- Run ONCE as superuser (postgres) BEFORE db-go-live.sh, ganti password kuat:
--
--   psql -U postgres -d face_absen -f backend/prisma/least-privilege.sql
--
-- Prinsip: role app hanya DML + USAGE/SEQUENCE pada skema public.
-- Migrasi (DDL) tetap dijalankan user migrasi terpisah / superuser via entrypoint
-- pada jendela change; JANGAN beri CREATEDB/CREATEROLE ke role app.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'face_absen_app') THEN
    CREATE ROLE face_absen_app NOINHERIT LOGIN PASSWORD 'GANTI-DENGAN-PASSWORD-KUAT';
  END IF;
END
$$;
GRANT CONNECT ON DATABASE face_absen TO face_absen_app;
GRANT USAGE ON SCHEMA public TO face_absen_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO face_absen_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO face_absen_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO face_absen_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO face_absen_app;
-- Verifikasi: \du face_absen_app  (tanpa Superuser/Create role/Create DB)
