# BAB I — PENDAHULUAN

**Judul:** Penerapan Verifikasi Multi-Sinyal dan *Risk Scoring* untuk
Pencegahan Titip Absen pada Sistem Presensi Berbasis Pengenalan Wajah
*On-Device* (Studi Kasus: RSU Darmayu Madiun)

---

## 1.1 Latar Belakang

Presensi kehadiran merupakan bagian yang tidak terpisahkan dari tata kelola
sumber daya manusia di institusi pelayanan kesehatan. Berbeda dengan instansi
yang beroperasi pada jam kerja tetap, rumah sakit menjalankan pola siklus
dinas yang mencakup shift pagi, siang, malam, serta hari libur. Kondisi ini
membuat kehadiran personel tidak dapat diverifikasi secara kasat mata oleh
satu orang saja, sehingga rumah sakit membutuhkan mekanisme pencatatan
kehadiran yang mandiri, cepat, dan dapat diaudit.

RSU Darmayu Madiun merupakan rumah sakit dengan `⟨jumlah karyawan⟩` pegawai
yang tersebar pada `⟨jumlah unit/instalasi⟩` unit kerja. Saat ini presensi
kehadiran dilakukan menggunakan mesin sidik jari, namun hanya tersedia satu
unit yang dipasang di `⟨lokasi pemasangan⟩`. Kondisi tersebut menimbulkan
empat persoalan yang saling berkaitan.

*Pertama, pemusatan titik layanan.* Seluruh personel dari berbagai unit —
termasuk unit rawat inap yang secara operasional tidak dapat ditinggalkan
tanpa serah terima — harus menuju satu titik yang sama pada jam pergantian
shift. Karena beberapa unit memasuki waktu pergantian secara bersamaan,
antrean menjadi tidak terhindarkan.

*Kedua, ketergantungan pada kualitas sidik jari.* Personel yang bertugas di
area perawatan cenderung sering kontak dengan cairan pembersih, antiseptik,
dan air sehingga permukaan jari mengalami perubahan yang menurunkan kualitas
pembacaan. Akibatnya satu kali kehadiran berpotensi memerlukan beberapa kali
percobaan, yang justru memperpanjang antrean pada saat beban antrean sedang
tinggi.

*Ketiga, melemahnya keterlacakan data.* Ketika pembacaan gagal berulang atau
antrean dinilai terlalu panjang, kehadiran berisiko tidak tercatat pada
mesin. Tanpa mekanisme pencatatan pengganti yang baku, kehadiran pada
periode tersebut hanya dapat diketahui melalui pengakuan pihak lain,
sehingga tidak dapat diverifikasi dan berpotensi menjadi sengketa ketika
berkaitan dengan penggajian atau penilaian kinerja.

*Keempat, dan paling relevan bagi penelitian ini, terbukanya ruang bagi
praktik titip absen.* Ketika satu titik layanan harus melayani banyak orang
dalam waktu singkat, menitipkan kehadiran kepada rekan yang kebetulan berada
di dekat mesin menjadi lebih mudah dan secara sosial lebih dapat diterima
dibandingkan harus meninggalkan unit pada saat sibuk. Mesin sidik jari yang
tidak dilengkapi deteksi kekuatan hidup tidak dapat membedakan jari pemilik
sah dari jari rekan yang menempelkan jari orang lain. Praktik inilah yang
dalam konteks ketenagakerjaan dikenal sebagai *titip absen*, yaitu
pencatatan kehadiran atas nama seseorang yang sebenarnya tidak hadir.

Persoalannya, keempat gejala di atas berakar pada dua sebab yang berbeda dan
tidak dapat diselesaikan oleh satu tindakan yang sama. Antrean berakar pada
**keterbatasan kapasitas perangkat**, sedangkan titip absen berakar pada
**sifat kredensial yang dapat dipindahtangankan** (*transferable
credential*). Menambah unit mesin sidik jari memang meredakan antrean,
tetapi tidak menyentuh sebab kedua: sidik jari rekan tetap dapat ditempelkan
pada mesin mana pun, berapa pun jumlah mesinnya. Sebaliknya, memperketat
pengawasan tanpa menambah titik layanan hanya memindahkan beban kepada
petugas dan personel yang harus meninggalkan unit kerja. Dengan demikian
diperlukan pendekatan yang sekaligus menghilangkan titik rebutan dan
mengganti kredensial yang dapat dipindahtangankan dengan kredensial yang
melekat pada pemiliknya.

Pendekatan yang dinilai memenuhi kedua syarat tersebut adalah memindahkan
titik verifikasi ke perangkat yang justru sudah dimiliki dan dibawa oleh
setiap karyawan, yaitu telepon seluler. Dengan demikian tidak ada lagi satu
perangkat yang harus diperebutkan, sehingga antrean pada jam pergantian
shift tidak lagi menjadi tekanan yang mendorong praktik titip absen.
Diantara pilihan biometrik yang dapat dijalankan pada telepon seluler,
wajah dipilih karena melekat pada pemiliknya, tidak memerlukan perangkat
tambahan, dan dapat diverifikasi hanya dengan kamera depan yang telah
tersedia. Perkembangan arsitektur jaringan saraf konvolusi yang ringkas
memungkinkan ekstraksi ciri wajah dijalankan langsung pada perangkat
(*on-device*). MobileFaceNet, misalnya, mampu menghasilkan vektor
*-embedding* berdimensi tetap dengan akurasi verifikasi yang kompetitif
namun berukuran model hanya beberapa megabita sehingga layak dijalankan pada
perangkat kelas menengah [1], [2]. Pendekatan *on-device* juga membawa
keuntungan privasi: citra wajah mentah tidak perlu dikirim maupun disimpan
di server, karena yang ditransmisikan hanyalah representasi numerik
(*embedding*) hasil ekstraksi [3].

Meskipun demikian, memindahkan verifikasi ke perangkat pribadi menimbulkan
konsekuensi baru: perangkat tersebut tidak berada dalam kendali institusi
dan harus diperlakukan sebagai klien yang tidak tepercaya (*untrusted
client*). Verifikasi wajah tunggal (*single-signal verification*) karena itu
tidak memadai. Terdapat tiga celah yang perlu ditutup secara bersamaan.

**Pertama, celah serangan presentasi (*presentation attack*).** Sistem
verifikasi wajah dapat dikelabui dengan foto cetak, tampilan layar, atau
rekaman video milik pemilik identitas yang sah. Oleh karena itu, selain
mencocokkan wajah, sistem perlu memastikan bahwa objek di hadapan kamera
adalah manusia hidup (*liveness detection*). Evaluasi ketahanan terhadap
serangan semacam ini memiliki standar tersendiri, yaitu ISO/IEC 30107-3,
yang mengukur *Attack Presentation Classification Error Rate* (APCER) dan
*Bona Fide Presentation Classification Error Rate* (BPCER) [4], [5].

**Kedua, celah pemindahtanganan perangkat.** Walaupun wajah berhasil
diverifikasi, sistem tetap perlu memastikan bahwa permintaan presensi
dikirim dari perangkat yang terikat pada karyawan tersebut, bukan dari
perangkat lain yang dipinjamkan atau dipasangi aplikasi tiruan. Pengikatan
perangkat (*device binding*) dan pemeriksaan integritas sistem operasi
merupakan kontrol yang lazim digunakan pada aplikasi seluler bernilai tinggi
[6].

**Ketiga, celah pemutaran ulang permintaan (*replay*) dan pemalsuan
identitas pengirim.** Permintaan presensi yang sah dapat direkam lalu
dikirim ulang, atau dipalsukan dengan menyatakan identitas karyawan lain.
Penandatanganan setiap permintaan menggunakan kunci privat asimetris
(Ed25519) yang tersimpan pada penyimpanan aman perangkat membuat server
dapat memverifikasi keaslian dan keutuhan permintaan tanpa perlu memercayai
klaim identitas yang dikirim klien. Prinsip ini sejalan dengan pendekatan
*zero trust* pada sistem autentikasi modern yang tidak memercayai klien
secara default [7], [8].

Keempat sinyal tersebut — kecocokan wajah, kekuatan hidup, keterikatan
perangkat, dan keaslian tanda tangan permintaan — umumnya dievaluasi secara
terpisah. Sebagian besar penelitian dan implementasi presensi berbasis wajah
berhenti pada pengukuran akurasi pengenalan wajah (FAR/FRR) sebagai sinyal
tunggal, atau memindahkan proses pencocokan ke server sehingga menimbulkan
konsekuensi privasi dan beban jaringan. Padahal dalam praktik presensi,
keputusan yang diambil bukan sekadar "wajah cocok atau tidak", melainkan
"seberapa layak permintaan presensi ini diterima". Keputusan biner semacam
itu tidak menyediakan ruang bagi kasus batas: pencahayaan redup, kacamata,
atau kamera depan yang tergores dapat menurunkan skor wajah pada karyawan
yang sah, sementara menurunkan ambang penerimaan akan memperbesar peluang
impostor lolos. Akibatnya pengelola sistem dihadapkan pada pilihan yang
merugikan salah satu pihak, dan sering kali memilih menurunkan ambang demi
kelancaran operasional — yang justru mengembalikan persoalan titip absen.

Oleh karena itu diperlukan mekanisme yang mengubah keputusan biner menjadi
keputusan berbasis tingkat risiko. Setiap sinyal verifikasi disumbangkan
sebagai komponen skor dengan bobot tertentu, sehingga permintaan yang lemah
pada satu sinyal tetapi kuat pada sinyal lain masih dapat diproses — namun
dengan kategori risiko yang sesuai. Skor risiko demikian dapat digunakan
untuk tiga hal: menerima secara otomatis, menahan untuk ditinjau atasan,
atau menolak. Dengan cara ini penurunan FAR (impostor lolos) tidak harus
dibayar mahal dengan kenaikan FRR (karyawan sah ditolak) yang berlebihan,
karena kasus batas disalurkan ke jalur peninjauan alih-alih langsung
ditolak.

Selain itu, konteks rumah sakit di Indonesia menuntut kepatuhan terhadap
Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Data
biometrik termasuk dalam kategori data pribadi yang bersifat spesifik
sehingga memerlukan dasar pemrosesan yang sah, pembatasan tujuan, serta
perlindungan teknis yang memadai [9]. Karakteristik biometrik yang permanen
— berbeda dengan kata sandi yang dapat diganti ketika bocor — menjadikan
desain *privacy by design* bukan sekadar pelengkap, melainkan syarat. Karena
itu penyimpanan *embedding* wajah pada server dilakukan dalam bentuk
terenkripsi (AES-256-GCM), sedangkan citra wajah mentah tidak pernah
meninggalkan perangkat.

Berdasarkan uraian tersebut, penelitian ini memandang persoalan titip absen
sebagai persoalan verifikasi multi-sinyal yang harus diukur, bukan sekadar
persoalan pengenalan wajah. Penelitian ini merancang dan mengevaluasi sistem
presensi yang memadukan empat sinyal verifikasi ke dalam satu skor risiko
100 poin, kemudian mengukur dampaknya terhadap *False Acceptance Rate*
(FAR) dan *False Rejection Rate* (FRR) dibandingkan dengan verifikasi wajah
tunggal pada ambang yang setara. Dengan demikian kontribusi yang ditawarkan
bukan sekadar pembangunan aplikasi, melainkan pengukuran kuantitatif atas
manfaat penambahan sinyal non-wajah pada kasus presensi karyawan rumah
sakit.

---

## 1.2 Rumusan Masalah

1. Bagaimana merancang arsitektur verifikasi multi-sinyal yang memadukan
   kecocokan wajah, deteksi kekuatan hidup, pengikatan perangkat, integritas
   perangkat, dan tanda tangan digital permintaan ke dalam satu skor risiko
   pada sistem presensi berbasis wajah *on-device*?

2. Seberapa besar penambahan sinyal non-wajah menurunkan *False Acceptance
   Rate* (FAR) dibandingkan verifikasi wajah tunggal pada ambang kecocokan
   yang setara, dan bagaimana konsekuensinya terhadap *False Rejection Rate*
   (FRR), *Equal Error Rate* (EER), serta waktu proses verifikasi?

3. Bagaimana distribusi kategori risiko yang dihasilkan sistem, dan seberapa
   besar kasus batas dapat disalurkan ke jalur peninjauan alih-alih langsung
   ditolak?

---

## 1.3 Tujuan Penelitian

1. Merancang arsitektur verifikasi multi-sinyal dan *risk scoring* untuk
   sistem presensi berbasis wajah *on-device* pada lingkungan rumah sakit.

2. Mengukur dan menganalisis penurunan FAR akibat penambahan sinyal
   non-wajah dibandingkan verifikasi wajah tunggal, beserta dampaknya
   terhadap FRR, EER, dan waktu proses verifikasi.

3. Menganalisis distribusi kategori risiko serta efektivitas jalur
   peninjauan dalam menangani kasus batas.

---

## 1.4 Batasan Penelitian

1. **Objek studi** terbatas pada karyawan RSU Darmayu Madiun sebanyak
   `⟨n⟩` orang yang bersedia memberikan persetujuan (*informed consent*)
   untuk pengambilan data biometrik.

2. **Platform** yang dievaluasi hanya aplikasi Android. Aplikasi iOS
   tersedia dalam sistem namun tidak diikutsertakan dalam pengukuran karena
   keterbatasan perangkat uji.

3. **Deteksi kekuatan hidup** yang dievaluasi adalah metode pasif berbasis
   analisis rangkaian frame (gerak mikro, geometri mata, dan perubahan
   kedalaman), bukan model *anti-spoofing* terlatih. Evaluasi tidak
   dilakukan secara penuh menurut ISO/IEC 30107-3 dengan protokol serangan
   lengkap; pengukuran APCER/BPCER dilakukan secara terbatas pada
   `⟨jenis serangan yang diuji⟩`.

4. **Lokasi** tidak digunakan sebagai sinyal verifikasi. Sistem tidak
   menerapkan GPS maupun *geofence*, sehingga penelitian ini tidak mengukur
   aspek kepatuhan lokasi.

5. **Ruang lingkup fungsional** dibatasi pada alur presensi karyawan
   (registrasi wajah, *check-in*, *check-out*, dan riwayat). Fitur
   penggajian, penjadwalan otomatis, dan integrasi langsung dengan SIMRS
   rumah sakit tidak termasuk dalam penelitian.

6. **Data evaluasi** bersifat terbatas pada populasi satu institusi,
   sehingga hasil FAR/FRR tidak dapat digeneralisasi secara langsung ke
   institusi lain tanpa kalibrasi ulang.

7. **Sistem sidik jari yang telah berjalan tidak diubah.** Penelitian ini
   tidak melakukan migrasi, penghapusan, maupun integrasi terhadap basis
   data sidik jari yang sudah ada; kedua sistem berjalan berdampingan
   selama periode evaluasi.

8. **Model ancaman dibatasi.** Penelitian ini tidak mengukur ketahanan
   terhadap serangan *deepfake* generatif maupun *injection attack* pada
   lapisan kamera, karena keduanya memerlukan dataset dan model tersendiri.

---

## 1.5 Manfaat Penelitian

### 1.5.1 Manfaat Teoretis

1. Memberikan bukti kuantitatif mengenai kontribusi sinyal non-wajah
   terhadap penurunan FAR pada sistem verifikasi wajah, yang selama ini
   lebih banyak dibahas secara kualitatif.
2. Menawarkan kerangka evaluasi yang memisahkan dua jenis kesalahan
   (impostor lolos dan pemilik sah ditolak) sehingga penilaian sistem
   presensi tidak lagi bergantung pada satu angka akurasi tunggal.
3. Menjadi rujukan bagi penelitian serupa yang ingin menerapkan verifikasi
   biometrik pada konteks institusi dengan pola kerja bergilir.

### 1.5.2 Manfaat Praktis

1. Bagi RSU Darmayu Madiun, penelitian ini menghasilkan sistem presensi
   yang lebih sulit dititipkan sekaligus menyediakan data untuk menetapkan
   ambang penerimaan secara objektif, bukan berdasarkan perkiraan.
2. Bagi instalasi SDM, kategori risiko dan jalur peninjauan memberi dasar
   yang dapat diaudit ketika terjadi sengketa kehadiran.
3. Bagi karyawan, berkurangnya ketergantungan pada satu titik layanan
   menghilangkan antrean pada jam pergantian shift, dan penurunan FRR
   berarti berkurangnya penolakan presensi yang tidak beralasan pada kondisi
   pencahayaan atau kamera yang kurang ideal.

---

## 1.6 Sistematika Penulisan

- **BAB I PENDAHULUAN** — latar belakang, rumusan masalah, tujuan, batasan,
  manfaat, dan sistematika penulisan.
- **BAB II TINJAUAN PUSTAKA** — pengenalan wajah dan arsitektur
  MobileFaceNet, deteksi kekuatan hidup, pengikatan perangkat dan integritas
  aplikasi, tanda tangan digital Ed25519, *risk scoring*, metrik FAR/FRR/EER,
  kajian penelitian terdahulu, dan posisi penelitian.
- **BAB III METODOLOGI PENELITIAN** — rancangan arsitektur sistem, instrumen
  pengambilan data, protokol pengumpulan *genuine* dan *impostor*, prosedur
  kalibrasi ambang, serta rancangan pengujian dan analisis data.
- **BAB IV HASIL DAN PEMBAHASAN** — hasil implementasi, tabel FAR/FRR per
  ambang, nilai EER, waktu proses, distribusi kategori risiko, dan pembahasan.
- **BAB V KESIMPULAN DAN SARAN** — kesimpulan atas tiap rumusan masalah,
  keterbatasan, dan saran pengembangan.
