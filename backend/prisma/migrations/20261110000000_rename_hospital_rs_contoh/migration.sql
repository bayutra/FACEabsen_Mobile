-- Rename the legacy seeded hospital name ("RS Contoh" from the initial seed)
-- so existing databases stop showing placeholder text in "Tambah unit".
UPDATE "hospitals"
SET "name" = 'RSU Darmayu Madiun'
WHERE "code" = 'RS-A'
  AND "name" = 'RS Contoh';
