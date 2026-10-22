# Catatan Kerja — Bab I

Berkas ini **bukan bagian naskah**. Jangan diserahkan ke pembimbing.
Naskah bersih: [`bab1-pendahuluan.md`](bab1-pendahuluan.md)

---

## 1. Placeholder yang harus diisi

| Placeholder | Lokasi di naskah | Cara memperoleh |
|---|---|---|
| `⟨jumlah karyawan⟩` | §1.1 par. 2 | Data SDM |
| `⟨jumlah unit/instalasi⟩` | §1.1 par. 2 | Data SDM |
| `⟨lokasi pemasangan⟩` | §1.1 par. 2 | Observasi |
| `⟨n⟩` | §1.4 butir 1 | Jumlah responden |
| `⟨jenis serangan yang diuji⟩` | §1.4 butir 3 | Putuskan di Bab III |

Sengaja hanya lima. Semakin sedikit placeholder, semakin besar peluang
naskah Anda lolos pemeriksaan awal.

---

## 2. Observasi awal (kerjakan sebelum izin penelitian turun)

Bagian ini menyelamatkan Latar Belakang Anda. Tanpa angka, klaim
"antrean memicu titip absen" hanya dugaan. Semua di bawah dapat diukur
dengan stopwatch, buku catatan, dan satu kali wawancara.

### 2.1 Formulir pengamatan antrean

Isi 3 hari berbeda, masing-masing pada jam pergantian shift.

| Tanggal | Shift | Jam mulai | Jam selesai | Jumlah org mengantre | Antrean terpanjang | Jumlah gagal baca | Rata-rata percobaan/org | Ada yg menyerah? |
|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |

**Cara mengukur:**

- *Antrean terpanjang* — hitung orang yang berdiri menunggu pada satu titik waktu.
- *Rata-rata percobaan* — amati 20 orang berturut-turut, catat berapa kali
  menempelkan jari sampai berhasil.
- *Jumlah gagal baca* — percobaan yang ditolak mesin, bukan jumlah orang.

### 2.2 Template perhitungan beban

Gunakan ini untuk mengubah jumlah karyawan (yang belum Anda ketahui) menjadi
argumen kuantitatif. Tidak perlu angka pasti sekarang — rumusnya yang
Anda tulis, angkanya diisi belakangan.

```
Beban antrean = (P × t) / W
```

- `P` = perkiraan jumlah orang yang presensi pada satu pergantian shift
- `t` = rata-rata waktu satu percobaan (detik), **dari pengamatan §2.1**
- `W` = lebar jendela waktu pergantian shift (detik)

Jika `P × t > W`, antrean **pasti** terjadi dan itu dapat dibuktikan secara
matematis, bukan diklaim. Tulis hasilnya di §1.1 sebagai kalimat:

> "Dengan `P` personel dan rata-rata `t` detik per percobaan pada jendela
> `W` detik, satu unit mesin membutuhkan `P × t` detik — melebihi jendela
> yang tersedia sebesar `⟨...⟩` detik."

### 2.3 Wawancara

Daftar lengkap: **[`instrumen-wawancara.md`](instrumen-wawancara.md)** — 82
pertanyaan, dipisah per narasumber, dilengkapi pertanyaan lanjutan (*probe*)
dan versi singkat 15 soal.

Lima pertanyaan inti (bila waktu sangat terbatas):

Tanyakan ke `⟨kepala SDM / petugas presensi⟩`. Catat jawaban apa adanya.

1. Berapa jumlah pegawai dan berapa yang presensi pada shift yang sama?
2. Sejak kapan mesin sidik jari ini dipakai, dan apakah pernah ditambah?
3. **Jika mesin gagal membaca atau antrean panjang, bagaimana kehadiran
   dicatat?** *(jawaban ini mengisi §1.1 persoalan ketiga — masih kosong)*
4. Apakah pernah ada laporan atau dugaan titip absen? Berapa kali?
5. Apakah ada keluhan pegawai soal antrean atau sidik jari tidak terbaca?

Pertanyaan 3 dan 4 adalah yang paling menentukan. Jika jawabannya
"tidak pernah ada", sesuaikan nada §1.1: ubah dari "terjadi" menjadi
"berpotensi terjadi" dan perkuat argumen pada keterbatasan mekanisme,
bukan pada tuduhan.

---

## 3. Referensi kandidat — WAJIB diverifikasi

Belum satu pun terverifikasi. Jangan masukkan ke daftar pustaka sebelum
dicek. Jalankan `papers-skill` (Semantic Scholar) untuk tiap entri.

| No | Sumber | Yang harus dicek |
|---|---|---|
| [1] | Chen, Liu, Gao, Han — *MobileFaceNets*, CCBR 2018 | Tahun, venue, DOI |
| [2] | Schroff, Kalenichenko, Philbin — *FaceNet*, CVPR 2015 | Halaman, DOI |
| [3] | Deng, Guo, Xue, Zafeiriou — *ArcFace*, CVPR 2019 | Halaman, DOI |
| [4] | ISO/IEC 30107-3 | Edisi/tahun berlaku |
| [5] | Yu et al. — *Deep Learning for Face Anti-Spoofing: A Survey*, IEEE TPAMI | Volume, tahun |
| [6] | OWASP MASVS | Versi terbaru |
| [7] | NIST SP 800-63B | Revisi terbaru |
| [8] | RFC 8032 — EdDSA | Status (Proposed Standard?) |
| [9] | UU No. 27 Tahun 2022 tentang PDP | Sumber resmi (JDIH) |

**Catatan penting:** klaim "penelitian terdahulu berhenti pada sinyal
tunggal" di §1.1 **belum punya sitasi**. Setelah Bab II dikerjakan, klaim
itu harus disandarkan pada minimal 3 penelitian nyata, atau dilunakkan
menjadi "umumnya" tanpa klaim universal.

---

## 4. Keputusan yang masih terbuka

| # | Keputusan | Dampak | Status |
|---|---|---|---|
| 1 | Judul: "Penerapan..." vs "Perbandingan..." | Menentukan bobot eksperimen vs rekayasa | Belum |
| 2 | Izin penelitian RSU | Menentukan ada/tidaknya Bab IV | Belum |
| 3 | Ambang acuan (`0.5` default) | Harus dikalibrasi, bukan diasumsikan | Belum |
| 4 | Jenis serangan yang diuji | Menentukan isi §1.4 butir 3 | Belum |
| 5 | Jumlah responden `n` | Menentukan kekuatan statistik | Belum |

### Soal pilihan judul

| | "Penerapan..." | "Perbandingan..." |
|---|---|---|
| Fokus | Merancang sistem | Menguji klaim |
| Kekuatan | Kontribusi artefak jelas | Variabel bebas jelas, lebih "penelitian" |
| Kelemahan | Rawan dianggap "cuma bikin aplikasi" | Butuh dua kondisi uji yang benar-benar setara |
| Cocok jika | Pembimbing menyukai produk | Pembimbing menuntut eksperimen |

Untuk Teknik Informatika, "Perbandingan..." umumnya lebih aman di sidang.

---

## 5. Kelemahan naskah saat ini

1. **Angka belum ada.** Seluruh §1.1 bagian awal masih deskriptif. Setelah
   §2 selesai, ganti minimal dua kalimat dengan data.
2. **Klaim kausal belum terbukti.** "Antrean mendorong titip absen" adalah
   penalaran, bukan temuan. Sudah ditulis sebagai penalaran ("berisiko",
   "terbuka ruang"), bukan sebagai fakta — pertahankan gaya ini sampai
   ada data.
3. **Sitasi belum terverifikasi** (lihat §3).
4. **Kontribusi belum dibandingkan dengan penelitian lain.** Pertanyaan
   penguji: "Apa bedanya dengan sistem presensi wajah yang sudah ada?"
   Jawaban harus ada di Bab II, bukan di Bab I.
5. **Nama institusi dan pembimbing** belum dicantumkan di halaman judul.

---

## 6. Status magang di lokasi penelitian

Anda berada di dalam institusi. Ini keuntungan besar, tetapi juga sumber
pertanyaan metodologis.

### 6.1 Yang otomatis Anda dapat

- Akses mengamati alur presensi tanpa perlu izin masuk.
- Kesempatan mengukur `t`, `P`, dan `W` (lihat §2.2) sambil menjalankan
  tugas magang.
- Narasumber yang mudah ditemui, termasuk petugas presensi.
- Pembimbing lapangan yang dapat membaca draf Bab I sebelum diajukan ke
  kampus.

### 6.2 Yang TIDAK otomatis Anda dapat

| Hal | Mengapa tetap perlu | Tindakan |
|---|---|---|
| Izin penelitian resmi | Magang dan penelitian adalah dua tujuan berbeda | Surat dari kampus ke RS |
| Persetujuan subjek | Karyawan berhak menolak data wajahnya diambil | Lembar informed consent |
| Izin memakai data internal | Data kehadiran milik RS, bukan milik magang | Minta tertulis |
| Bebas dari kerahasiaan | Perjanjian magang biasanya memuat klausul NDA | Baca ulang perjanjian |
| Izin menyebut nama RS | Anonimisasi sering diwajibkan | Tanyakan sejak awal |

**Periksa perjanjian magang Anda sekarang.** Cari klausul tentang
kerahasiaan data, kepemilikan hasil kerja, dan larangan publikasi. Bila
klausulnya melarang publikasi data, penelitian tetap boleh berjalan tetapi
identitas institusi harus disamarkan ("RS X di Jawa Timur") dan hasil ukur
harus diagregasi.

### 6.3 Risiko insider bias

Penguji akan bertanya: *"Anda sudah terbiasa di sana, bagaimana Anda tahu
penilaian Anda tidak subjektif?"*

Mitigasi yang harus tertulis di Bab III:

1. **Protokol pengukuran ditetapkan sebelum observasi**, bukan setelah.
   Lembar §2.1 sudah memenuhi syarat ini.
2. **Angka menggantikan kesan.** Jangan pernah menulis "antrean terasa
   panjang". Tulis "antrean 23 orang pada 07.05".
3. **Triangulasi minimal tiga sumber** untuk klaim penting: pengamatan
   langsung, wawancara, dan data/laporan tertulis.
4. **Sebutkan posisi Anda secara terbuka** di Bab III: "Peneliti menjalani
   magang di lokasi penelitian selama `⟨durasi⟩` sehingga memiliki akses
   pengamatan langsung; untuk mengurangi bias, protokol pengukuran
   ditetapkan sebelum pengambilan data dan setiap klaim didukung minimal
   tiga sumber." Menyembunyikan status magang jauh lebih berbahaya
   daripada mengakuinya.

### 6.4 Peluang yang belum Anda pakai

1. **Studi pendahuluan tanpa izin penelitian penuh.** Pengamatan alur kerja
   adalah bagian tugas magang. Anda bisa mengumpulkan `t` dan antrean
   sekarang, lalu ajukan izin formal hanya untuk pengambilan data wajah.
2. **Pembimbing lapangan sebagai penguji kedua.** Minta beliau membaca
   Bab I dan menandai klaim yang tidak sesuai kenyataan. Ini jauh lebih
   murah daripada salah di sidang.
3. **Kebutuhan nyata sebagai dasar rumusan masalah.** Jika saat magang Anda
   menemukan persoalan yang tidak terduga, itu justru bahan terbaik — asal
   dicatat dengan tanggal dan bukti.
4. **Kelayakan implementasi.** Anda dapat menguji apakah karyawan mau
   memakai aplikasi, sebelum menghabiskan waktu membangunnya.

### 6.5 Satu larangan

Jangan memakai data kehadiran atau data pribadi yang Anda akses sebagai
peserta magang **tanpa izin tertulis**, sekalipun mudah diakses. Pelanggaran
ini bukan hanya risiko akademik, tetapi risiko hukum berdasarkan UU PDP.
Untuk Bab IV, data harus diperoleh melalui prosedur penelitian yang
disetujui, bukan melalui akses magang.

---

### 6.6 Jebakan khusus anak magang IT

**a. Anda bisa mengakses data yang bukan milik Anda.** Sebagai anak magang
IT, log mesin presensi, database kehadiran, dan backup sistem kemungkinan
besar berada dalam jangkauan akses Anda. Kemudahan itu justru menuntut
batas yang lebih tegas: **jangan membaca atau mengekspor data kehadiran
karyawan tanpa izin tertulis**, sekalipun secara teknis bisa. Untuk Bab IV,
data harus diperoleh melalui permintaan resmi yang tercatat.

**b. Data yang Anda butuhkan sebagian bukan milik IT.** IT menguasai
aspek teknis (konektivitas mesin, jaringan, log kegagalan), tetapi
**kebijakan** presensi — prosedur pencatatan susulan, sanksi, siapa yang
mengesahkan — adalah kewenangan SDM. Jangan menyimpulkan kebijakan dari
konfigurasi sistem. Dua narasumber berbeda, dua jenis fakta berbeda.

**c. Kepemilikan kode.** Bila aplikasi dibangun dalam rangka magang, karya
tersebut bisa dianggap hasil kerja untuk rumah sakit. Periksa perjanjian:
apakah kode sumber menjadi milik RS? Untuk skripsi Anda perlu hak
mempublikasikan artefak. Bila klausulnya tidak jelas, minta izin tertulis
bahwa kode boleh dilampirkan dan dipublikasikan sebagai bagian skripsi.

**d. Posisi ganda.** Anda menghitung dan juga terlibat membangun. Di Bab III
nyatakan hal ini terbuka, dan pastikan pengukuran FAR/FRR dilakukan dengan
prosedur yang tidak bergantung pada penilaian Anda sendiri — misalnya
memakai skrip kalibrasi yang sudah ada, bukan penilaian manual.

### 6.7 Urutan kerja 12 minggu

Minggu 1–2 dan 11–12 adalah yang menentukan.

| Minggu | Kegiatan | Keluaran |
|---|---|---|
| 1 | Baca perjanjian magang; ajukan surat izin penelitian ke kampus | Surat pengantar |
| 1 | Minta pembimbing lapangan menjadi penghubung ke SDM | Janji temu |
| 2 | Serahkan surat ke RS; tanyakan alur izin dan syaratnya | Nomor pengajuan |
| 2–3 | Observasi antrean (formulir §2.1), 3 hari | Data `t`, `P`, `W` |
| 3 | Wawancara IT: bagian B5, B6, F1–F10 | Data kelayakan teknis |
| 4 | Wawancara SDM: bagian A, B, D, E, G | Data kebijakan |
| 4 | Wawancara kepala unit: C, H | Data lapangan |
| 5 | Hitung `(P × t) / W`; perbarui Bab I | Bab I berbasis data |
| 5–6 | Susun Bab III (protokol pengambilan data wajah) | Draf Bab III |
| 6–7 | Tunggu izin selesai; siapkan instrumen & consent | Instrumen siap |
| 7–9 | Pengambilan data wajah: 50 genuine + 50 impostor | `pilot-scores.csv` |
| 9–10 | Jalankan kalibrasi; susun tabel FAR/FRR/EER | `calibration-report.json` |
| 10–11 | Bab IV dan Bab V | Draf lengkap |
| 11–12 | Review pembimbing lapangan + pembimbing kampus | Naskah final |

**Jalur kritis:** izin penelitian. Bila minggu ke-6 izin belum keluar,
segera aktifkan rencana cadangan: gunakan dataset publik untuk Bab IV dan
nyatakan data lapangan sebagai keterbatasan. Jangan menunggu sampai
minggu ke-10.

---

## 7. Pertanyaan penguji yang paling mungkin muncul

Siapkan jawaban singkat untuk lima ini sebelum seminar proposal:

1. "Mengapa tidak menambah mesin sidik jari saja?" → kapasitas vs
   kredensial yang dapat dipindahtangankan (lihat §1.1 par. 6).
2. "Apa bukti titip absen benar terjadi?" → data wawancara §2.3 butir 4.
3. "Bagaimana Anda tahu ini lebih baik?" → FAR/FRR/EER, terukur.
4. "Data wajah karyawan, izinnya bagaimana?" → informed consent + UU PDP +
   embedding terenkripsi + foto tidak dikirim.
5. "Kalau HP-nya dititipkan ke rekan?" → liveness + device binding +
   signature; dan akui batasannya di §1.4 butir 8.
