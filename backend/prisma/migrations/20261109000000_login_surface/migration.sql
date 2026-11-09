-- Login surface per akun: mobile | web | both (Kepala Ruangan = SUPERVISOR + "mobile")
ALTER TABLE "users" ADD COLUMN "login_surface" TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "users" ADD CONSTRAINT "users_login_surface_check" CHECK ("login_surface" IN ('mobile', 'web', 'both'));
