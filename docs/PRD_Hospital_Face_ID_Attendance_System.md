# PRD — HOSPITAL FACE ID ATTENDANCE SYSTEM

**Versi:** 1.0
**Status:** Development Specification
**Platform:** Mobile + Web
**Target:** Sistem Absensi Karyawan Rumah Sakit
**Mobile:** Flutter
**Backend:** NestJS / Node.js
**Database:** PostgreSQL
**Web:** Next.js / React / TypeScript
**Face Recognition:** MobileFaceNet — On-Device

---

# 1. PROJECT OVERVIEW

## 1.1 Tujuan

Membangun sistem absensi karyawan rumah sakit yang aman menggunakan:

* Face Recognition
* Liveness Detection
* Device Binding
* Device Integrity
* GPS Validation
* Geofencing
* Shift Management
* Risk Scoring
* Audit Logging
* Role Based Access Control
* Security Monitoring

Sistem harus mampu memastikan bahwa:

> Orang yang melakukan absensi adalah karyawan yang benar, menggunakan device yang sah, berada di lokasi yang benar, pada waktu/shift yang benar, dan request tidak dimanipulasi.

---

# 2. PLATFORM

## 2.1 Mobile App

Digunakan oleh:

> Karyawan

Teknologi:

```text
Flutter
Dart
Android
iOS
MobileFaceNet
TensorFlow Lite / ONNX Runtime Mobile
```

---

## 2.2 Web Dashboard

Digunakan oleh:

```text
Atasan
Admin
Super Admin
```

Teknologi:

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
```

---

## 2.3 Backend

```text
Node.js
NestJS
TypeScript
REST API
JWT
RBAC
Redis
```

---

## 2.4 Database

```text
PostgreSQL
```

---

# 3. USER ROLE

## 3.1 Karyawan

Mobile:

* Login
* Device registration
* Device replacement
* Face registration
* Liveness verification
* Check-in
* Check-out
* GPS
* Geofence
* Jadwal
* Riwayat absensi
* Koreksi absensi
* Izin/cuti
* Profil
* Privacy information

---

## 3.2 Atasan

Web:

* Dashboard tim
* Monitoring kehadiran
* Melihat keterlambatan
* Melihat ketidakhadiran
* Approval koreksi
* Approval izin/cuti
* Laporan tim

---

## 3.3 Admin

Web:

* Employee management
* Department management
* Shift management
* Schedule management
* Attendance management
* Device management
* Device replacement
* Face template management
* Correction management
* Leave management
* Report
* Audit log

---

## 3.4 Super Admin

Web:

* Semua fitur Admin
* User management
* Role management
* Permission management
* Hospital management
* Security configuration
* Geofence configuration
* Attendance configuration
* Audit log global
* System configuration

---

# 4. ARSITEKTUR SISTEM

```text
                         ┌──────────────────────┐
                         │      EMPLOYEE        │
                         │     Flutter App      │
                         └──────────┬───────────┘
                                    │
                             HTTPS / TLS
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      API GATEWAY     │
                         │ Rate Limit / WAF     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      NESTJS API      │
                         │                      │
                         │ Auth                 │
                         │ RBAC                 │
                         │ Device               │
                         │ Face                 │
                         │ Attendance           │
                         │ Shift                │
                         │ Risk Engine          │
                         │ Audit                │
                         └───────┬──────┬───────┘
                                 │      │
                   ┌─────────────┘      └─────────────┐
                   ▼                                  ▼
          ┌─────────────────┐                ┌─────────────────┐
          │   PostgreSQL    │                │      Redis      │
          │                 │                │                 │
          │ Employees       │                │ OTP             │
          │ Devices         │                │ Rate Limit      │
          │ Face Templates  │                │ Session         │
          │ Attendance      │                │ Temporary Data  │
          │ Audit Logs      │                │                 │
          └─────────────────┘                └─────────────────┘

                         ▲
                         │
                         │ HTTPS
                         │
              ┌──────────┴───────────┐
              │      NEXT.JS        │
              │    Web Dashboard    │
              │                     │
              │ Supervisor          │
              │ Admin               │
              │ Super Admin         │
              └─────────────────────┘
```

---

# 5. SECURITY PRINCIPLE

Security merupakan bagian dari seluruh sistem, bukan fitur tambahan di akhir.

Prinsip utama:

```text
Zero Trust Client
Least Privilege
Defense in Depth
Secure by Design
Privacy by Design
Server as Source of Truth
Audit Everything Important
```

Mobile dan Web dianggap sebagai:

> Untrusted Client.

Artinya server tidak boleh mempercayai data penting hanya karena dikirim dari aplikasi resmi.

---

# 6. SECURITY LAYER

Sistem memiliki beberapa layer:

```text
Layer 1
Authentication

Layer 2
Authorization / RBAC

Layer 3
Device Security

Layer 4
Face Recognition

Layer 5
Liveness

Layer 6
Location Security

Layer 7
Request Integrity

Layer 8
Risk Engine

Layer 9
Database Security

Layer 10
Audit Logging

Layer 11
Privacy / PDP

Layer 12
Monitoring & Security Testing
```

---

# 7. AUTHENTICATION SECURITY

Gunakan:

```text
Argon2id
JWT Access Token
Refresh Token
Refresh Token Rotation
Session Management
Rate Limiting
Account Lockout
```

Password:

> Tidak boleh disimpan plaintext.

Access token harus memiliki lifetime relatif pendek.

Refresh token harus dapat:

* Dicabut
* Dirotasi
* Dilacak
* Dikaitkan dengan session/device

---

# 8. AUTHORIZATION / RBAC

Role:

```text
EMPLOYEE
SUPERVISOR
ADMIN
SUPER_ADMIN
```

Permission menggunakan pola:

```text
resource:action
```

Contoh:

```text
attendance:create:self
attendance:read:self

attendance:read:team
attendance:approve:team

employee:create
employee:update
employee:read

device:read
device:revoke
device:approve-replacement

role:manage
security:manage
system:manage
```

Authorization wajib dilakukan di backend.

UI yang menyembunyikan menu **bukan security**.

---

# 9. DEVICE SECURITY

## 9.1 Prinsip

Satu karyawan hanya boleh memiliki:

> 1 ACTIVE DEVICE pada satu waktu.

Tetapi seluruh device sebelumnya tetap disimpan sebagai histori.

---

## 9.2 Device Identity

Jangan bergantung hanya kepada:

```text
IMEI
MAC Address
Android ID
```

Gunakan kombinasi:

```text
Device Key Pair
Installation ID
Device Integrity
Device Record
```

---

## 9.3 Device Key Pair

Saat device didaftarkan:

```text
Private Key
    ↓
Secure Storage / Hardware-backed Keystore

Public Key
    ↓
Server
```

Private key tidak dikirim ke server.

Request sensitif dapat menggunakan device signature.

---

# 10. DEVICE STATUS

Status:

```text
PENDING
ACTIVE
REVOKED
LOST
REPLACED
```

Fields:

```text
id
employee_id
device_public_key
installation_id
platform
device_name
app_version
status
registered_at
last_seen_at
revoked_at
revoked_by
revoke_reason
```

---

# 11. DEVICE REPLACEMENT

## 11.1 Skenario

Device dapat diganti jika:

* HP rusak
* HP hilang
* HP dicuri
* HP upgrade
* Device tidak dapat digunakan

---

## 11.2 Flow

```text
Device Lama
ACTIVE
   ↓
Replacement Request
   ↓
Identity Verification
   ↓
Risk Check
   ↓
Admin Approval
   ↓
Old Device = REVOKED
   ↓
New Device = ACTIVE
```

---

## 11.3 Verification

Minimal:

```text
Employee ID
Password
Face Verification
```

Dapat ditambah:

```text
OTP
Admin Approval
```

Untuk risk tinggi:

> Admin approval wajib.

---

## 11.4 Device Change Request

Table:

```text
device_change_requests
```

Fields:

```text
id
employee_id
old_device_id
new_device_id
reason
status
requested_at
reviewed_by
reviewed_at
review_note
```

Status:

```text
PENDING
APPROVED
REJECTED
CANCELLED
```

---

# 12. FACE RECOGNITION

Teknologi:

```text
MobileFaceNet
```

Proses:

```text
Camera
 ↓
Face Detection
 ↓
Face Quality
 ↓
Liveness
 ↓
Face Embedding
 ↓
Similarity Matching
```

Face recognition sebisa mungkin dilakukan:

> On Device.

Server menyimpan:

> Face Template / Embedding.

Raw face image tidak boleh dijadikan penyimpanan utama tanpa kebutuhan dan dasar pemrosesan yang jelas.

---

# 13. FACE SECURITY

Face template harus:

* Dienkripsi
* Access restricted
* Tidak ditampilkan ke user
* Tidak dapat diakses Admin biasa
* Memiliki audit access
* Memiliki retention policy
* Dapat dihapus sesuai kebijakan

Face template tidak boleh dikirim dalam response API biasa.

---

# 14. LIVENESS DETECTION

Tujuan:

Mencegah:

```text
Foto
Screenshot
Video
Video replay
Foto dari HP lain
```

Minimal random challenge:

```text
Lihat kiri
Kedip
Lihat kanan
```

Challenge harus dapat berubah.

Flow:

```text
Camera
 ↓
Face Detection
 ↓
Random Challenge
 ↓
Liveness
 ↓
Face Recognition
```

---

# 15. GPS SECURITY

GPS tidak boleh dipercaya langsung.

Client mengirim:

```text
latitude
longitude
accuracy
timestamp
```

Server melakukan:

```text
Distance Calculation
Timestamp Validation
Geofence Validation
Mock Location Detection
Device Integrity Check
Risk Analysis
```

Server menjadi sumber keputusan akhir.

---

# 16. GEOFENCE

Setiap rumah sakit memiliki:

```text
latitude
longitude
radius
```

Contoh:

```text
Hospital A
Latitude: ...
Longitude: ...
Radius: 100 meter
```

Radius dapat dikonfigurasi oleh Super Admin.

---

# 17. ANTI MOCK LOCATION

Sistem harus mendeteksi indikasi:

```text
Mock GPS
GPS Provider abnormal
Location inconsistency
Device integrity failure
Impossible movement
```

Jika terdeteksi:

```text
HIGH RISK
```

maka absensi dapat:

```text
Ditolak
```

atau:

```text
Masuk Review
```

sesuai konfigurasi.

---

# 18. REQUEST SECURITY

Request sensitif menggunakan:

```text
Timestamp
Nonce
Request ID
Device Signature
Authentication Token
```

Server melakukan:

```text
Timestamp valid?
Nonce sudah digunakan?
Signature valid?
Token valid?
Request ID sudah pernah digunakan?
```

Tujuan:

> Mencegah replay attack.

---

# 19. EMPLOYEE ID SECURITY

Server tidak boleh mempercayai:

```text
employeeId
```

dari body request untuk menentukan identitas user.

Gunakan:

```text
JWT
 ↓
userId
 ↓
employeeId
```

Contoh:

```text
POST /attendance/check-in
```

Server menentukan employee berdasarkan authenticated session.

---

# 20. SHIFT MANAGEMENT

Shift:

```text
PAGI
SIANG
MALAM
```

Contoh:

```text
Pagi
07:00 - 15:00

Siang
15:00 - 23:00

Malam
23:00 - 07:00
```

Shift malam dapat melewati tanggal.

Parameter:

```text
start_time
end_time
grace_period
late_threshold
early_checkout_threshold
```

---

# 21. ATTENDANCE ENGINE

## Check-in

Flow:

```text
Employee
 ↓
Authentication
 ↓
Device Validation
 ↓
Device Integrity
 ↓
GPS
 ↓
Geofence
 ↓
Liveness
 ↓
Face Recognition
 ↓
Shift Validation
 ↓
Request Integrity
 ↓
Risk Engine
 ↓
Server Decision
 ↓
CHECK-IN
```

---

## Check-out

Flow yang sama.

Server menentukan:

```text
ON_TIME
LATE
VERY_LATE
EARLY_CHECKOUT
NORMAL_CHECKOUT
```

---

# 22. NIGHT SHIFT

Contoh:

```text
23 September
23:00

↓

24 September
07:00
```

Check-in:

```text
23 September 22:50
```

Check-out:

```text
24 September 07:05
```

Tetap dianggap:

> Satu shift.

---

# 23. RISK ENGINE

Setiap absensi mendapatkan risk score.

Contoh awal:

```text
Face Match             30
Liveness                20
Trusted Device          15
Device Integrity        10
GPS Valid               10
Geofence                10
Request Signature        5
--------------------------------
TOTAL                  100
```

Contoh kategori:

```text
90 - 100
LOW RISK

70 - 89
MEDIUM RISK

< 70
HIGH RISK
```

Nilai tersebut harus dikalibrasi melalui testing.

---

# 24. HIGH RISK

Jika risk tinggi:

```text
Attendance
     ↓
HIGH RISK
     ↓
REJECT / REVIEW
```

Tidak boleh langsung membuat attendance valid.

---

# 25. DATABASE MODEL

Entity utama:

```text
hospitals
departments
users
employees
roles
permissions
face_templates
devices
device_change_requests
shifts
employee_schedules
attendance
correction_requests
leave_requests
audit_logs
sessions
```

---

# 26. EMPLOYEE MANAGEMENT

Admin dapat:

```text
Create
Read
Update
Deactivate
```

Data:

```text
Employee ID
Nama
Email
No HP
Departemen
Jabatan
Atasan
Status
```

Karyawan yang keluar:

```text
status = INACTIVE
```

Bukan menghapus record.

Histori absensi harus tetap ada.

---

# 27. MOBILE FEATURES

## Dashboard

Menampilkan:

```text
Nama
Shift hari ini
Status kehadiran
Check-in
Check-out
```

---

## Attendance

```text
Check-in
Check-out
Face Verification
Liveness
GPS
Geofence
```

---

## History

```text
Tanggal
Shift
Check-in
Check-out
Status
```

---

## Device

```text
Current Device
Device Status
Replacement Request
```

---

## Correction

```text
Tanggal
Jenis koreksi
Waktu
Alasan
Bukti
Status
```

---

## Leave

```text
Cuti
Sakit
Izin
Dinas
Lainnya
```

---

# 28. WEB ADMIN

Menu:

```text
Dashboard
Karyawan
Departemen
Shift
Jadwal
Absensi
Device
Koreksi
Izin
Laporan
Audit Log
Security
Settings
```

Dashboard:

```text
Total Karyawan
Hadir
Terlambat
Tidak Hadir
Izin
Cuti
```

---

# 29. SUPERVISOR DASHBOARD

Menampilkan:

```text
Jumlah anggota
Hadir
Terlambat
Tidak hadir
Izin
Cuti
```

Fitur:

```text
Team Attendance
Correction Approval
Leave Approval
Reports
```

Supervisor hanya dapat melihat data yang menjadi kewenangannya.

---

# 30. AUDIT LOG

Aktivitas penting:

```text
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
DEVICE_REGISTERED
DEVICE_REVOKED
DEVICE_REPLACED
FACE_REGISTERED
FACE_UPDATED
FACE_VERIFICATION_FAILED
LIVENESS_FAILED
GPS_FAILED
GEOFENCE_FAILED
CHECK_IN
CHECK_OUT
ATTENDANCE_REJECTED
CORRECTION_CREATED
CORRECTION_APPROVED
CORRECTION_REJECTED
LEAVE_CREATED
LEAVE_APPROVED
ROLE_CHANGED
PASSWORD_CHANGED
ADMIN_ACTION
SECURITY_SETTING_CHANGED
```

Data:

```text
id
actor_id
action
target_type
target_id
timestamp
ip_address
device_id
metadata
result
```

Audit log tidak boleh diubah oleh user biasa.

---

# 31. ADMIN SECURITY

Admin dan Super Admin wajib mendapatkan security lebih tinggi.

Disarankan:

```text
Password
+
MFA
```

Gunakan:

```text
TOTP / Authenticator
```

Operasi kritis memerlukan re-authentication:

```text
Revoke Device
Reset Face
Change Role
Change Permission
Change Security Configuration
```

---

# 32. API SECURITY

Semua API menggunakan:

```text
HTTPS / TLS
```

Tambahkan:

```text
Rate Limiting
Input Validation
DTO Validation
CORS
Security Headers
Request Size Limit
Error Sanitization
```

Jangan mengirim database error mentah kepada client.

---

# 33. DATABASE SECURITY

Gunakan:

```text
Least Privilege
Dedicated Database User
Prepared Statements
ORM
Encrypted Backup
Connection Pooling
Migration
```

Database user aplikasi tidak boleh menjadi PostgreSQL superuser.

---

# 34. SESSION SECURITY

Mobile:

```text
Secure Storage
Platform Keystore
```

Web:

```text
Secure Cookie / Secure Token Handling
```

Jangan menyimpan token sensitif secara sembarangan.

Session harus dapat:

```text
View
Revoke
Expire
Rotate
```

---

# 35. PASSWORD SECURITY

Password:

```text
Argon2id
```

Tambahkan:

```text
Minimum Password Policy
Failed Login Tracking
Temporary Lockout
Password Change
Password Reset
```

---

# 36. CORRECTION REQUEST

Karyawan dapat mengajukan:

```text
Lupa Check-in
Lupa Check-out
Kesalahan waktu
Masalah teknis
```

Flow:

```text
Employee
 ↓
Request
 ↓
Supervisor
 ↓
Approve / Reject
 ↓
Attendance Updated
 ↓
Audit Log
```

Admin tidak boleh mengubah histori tanpa audit.

---

# 37. LEAVE MANAGEMENT

Jenis:

```text
CUTI
SAKIT
IZIN
DINAS
LAINNYA
```

Flow:

```text
Employee
 ↓
Submit
 ↓
Supervisor
 ↓
Approve / Reject
```

---

# 38. REPORTING

Laporan:

```text
Daily Attendance
Monthly Attendance
Late Employee
Absent Employee
Overtime
Leave
Correction
Department
Employee
Device
Security
```

Format:

```text
Excel
CSV
PDF
```

Export harus mengikuti permission.

Jangan memberikan seluruh data rumah sakit kepada semua Admin.

---

# 39. PRIVACY & UU PDP

Karena sistem memproses data biometrik, privacy harus menjadi bagian dari arsitektur.

Prinsip:

```text
Privacy by Design
Data Minimization
Purpose Limitation
Access Control
Encryption
Retention Policy
Audit
Privacy Notice
```

Data biometrik hanya digunakan untuk tujuan yang telah ditentukan.

Raw face image tidak disimpan jika tidak diperlukan.

Face template harus mendapatkan perlindungan tambahan.

Sebelum production, implementasi legal harus direview oleh pihak rumah sakit/legal/DPO atau pihak yang berwenang agar sesuai dengan kewajiban UU PDP dan kebijakan internal rumah sakit.

---

# 40. DATA RETENTION

Buat kebijakan retention untuk:

```text
Face Template
Attendance
Audit Log
Device History
Security Event
Correction
Leave
```

Jangan menyimpan data sensitif tanpa batas waktu tanpa dasar kebutuhan.

---

# 41. SECURITY MONITORING

Sistem harus dapat mendeteksi pola:

```text
Banyak login gagal
Banyak device replacement
Banyak face verification gagal
Banyak GPS gagal
Banyak liveness gagal
Login dari lokasi tidak biasa
Request abnormal
Percobaan privilege escalation
```

Event mencurigakan masuk:

```text
Security Log
```

dan dapat memicu:

```text
Alert
```

---

# 42. SECURITY TESTING

Test minimal:

```text
Fake GPS
Mock Location
Photo Attack
Video Attack
Replay Attack
Stolen Password
Stolen Token
Device Switching
JWT Manipulation
Employee ID Manipulation
SQL Injection
Brute Force
Privilege Escalation
Unauthorized Device
Duplicate Attendance
API Enumeration
```

---

# 43. DEFINITION OF DONE

Setiap fitur dianggap selesai jika:

* [ ] Code selesai
* [ ] Compile berhasil
* [ ] Runtime berhasil
* [ ] Unit test sesuai kebutuhan
* [ ] Integration test sesuai kebutuhan
* [ ] Authorization diperiksa
* [ ] Input validation diperiksa
* [ ] Security concern diperiksa
* [ ] Audit log diperiksa
* [ ] Error handling diperiksa
* [ ] Dokumentasi diperbarui

---

# 44. DEVELOPMENT ROADMAP

Project **WAJIB** dikerjakan secara bertahap.

AI Coder tidak boleh mengerjakan semua fitur sekaligus.

Urutan:

```text
STEP 0
Project Analysis & Security Architecture

STEP 1
Initial Project Setup

STEP 2
Database & Data Model

STEP 3
Authentication & RBAC

STEP 4
Web Dashboard Foundation

STEP 5
Employee Management

STEP 6
Shift & Schedule

STEP 7
Mobile Device Binding

STEP 8
Device Replacement

STEP 9
Face Registration

STEP 10
Liveness Detection

STEP 11
GPS & Geofence

STEP 12
Attendance Engine

STEP 13
Anti-Titip-Absen Risk Engine

STEP 14
Attendance History

STEP 15
Correction

STEP 16
Leave

STEP 17
Supervisor Dashboard

STEP 18
Admin Device Management

STEP 19
Audit Log

STEP 20
Reporting

STEP 21
Privacy & PDP

STEP 22
Security Hardening

STEP 23
Testing

STEP 24
Security / Attack Testing

STEP 25
Production Deployment
```

---

# 45. STEP 0 — PROJECT ANALYSIS & SECURITY ARCHITECTURE

AI Coder hanya melakukan:

```text
Requirement Analysis
Architecture Analysis
Security Architecture
Folder Structure
Dependency Planning
Database Planning
API Planning
Risk Analysis
```

Tidak boleh membuat fitur.

Output:

```text
Project Architecture
Security Architecture
Folder Structure
Dependencies
Modules
Potential Risks
Questions
Acceptance Criteria
```

Setelah selesai:

```text
STEP 0 COMPLETE
WAITING FOR NEXT INSTRUCTION
```

---

# 46. STEP 1 — INITIAL PROJECT SETUP

Buat:

```text
/backend
/mobile
/web
```

Backend:

```text
NestJS
TypeScript
ESLint
Prettier
Environment Config
```

Mobile:

```text
Flutter
Dart
Architecture
Environment Config
```

Web:

```text
Next.js
TypeScript
Tailwind
shadcn/ui
```

Belum membuat:

```text
Face Recognition
Attendance
GPS
Dashboard lengkap
```

Acceptance:

```text
Backend dapat berjalan
Mobile dapat berjalan
Web dapat berjalan
```

---

# 47. STEP 2 — DATABASE & DATA MODEL

Buat schema dan migration untuk:

```text
hospitals
departments
users
employees
roles
permissions
face_templates
devices
device_change_requests
shifts
employee_schedules
attendance
correction_requests
leave_requests
audit_logs
sessions
```

Acceptance:

```text
Migration berhasil
Relationship benar
Constraint benar
Index dasar tersedia
```

---

# 48. STEP 3 — AUTHENTICATION & RBAC

Implementasi:

```text
Login
Logout
Refresh Token
JWT
Argon2id
Session
RBAC
Permission Guard
Rate Limit
```

Acceptance:

```text
Employee tidak dapat membuka Admin API
Supervisor tidak dapat membuka Super Admin API
Admin tidak dapat mengubah permission Super Admin
```

---

# 49. STEP 4 — WEB DASHBOARD FOUNDATION

Buat:

```text
Authentication
Layout
Sidebar
Header
Navigation
Role-based menu
Dashboard shell
```

Belum membuat seluruh CRUD.

---

# 50. STEP 5 — EMPLOYEE MANAGEMENT

Implementasi:

```text
Create Employee
Read Employee
Update Employee
Deactivate Employee
```

Security:

```text
Authorization
Input Validation
Audit
```

---

# 51. STEP 6 — SHIFT & SCHEDULE

Implementasi:

```text
Create Shift
Update Shift
Assign Shift
Employee Schedule
Night Shift
Grace Period
Late Threshold
```

Test khusus:

```text
23:00 → 07:00
```

---

# 52. STEP 7 — MOBILE DEVICE BINDING

Implementasi:

```text
Device Registration
Device Key Pair
Secure Storage
Device Integrity
Device Status
Server Validation
```

Test:

```text
Authorized Device
Unauthorized Device
Revoked Device
```

---

# 53. STEP 8 — DEVICE REPLACEMENT

Implementasi:

```text
Replacement Request
Identity Verification
Admin Approval
Old Device Revocation
New Device Activation
Audit Log
```

Test:

```text
Broken Device
Lost Device
Suspicious Device
Duplicate Device
```

---

# 54. STEP 9 — FACE REGISTRATION

Implementasi:

```text
Camera
Face Detection
Face Quality
MobileFaceNet
Embedding
Template Encryption
```

Acceptance:

```text
Wajah valid → berhasil
Blur → reject
Multiple face → reject
Tidak ada wajah → reject
```

---

# 55. STEP 10 — LIVENESS DETECTION

Implementasi:

```text
Random Challenge
Liveness
Anti Photo
Anti Screenshot
Anti Video Replay
```

---

# 56. STEP 11 — GPS & GEOFENCE

Implementasi:

```text
GPS
Accuracy
Geofence
Mock Location Detection
Timestamp
Server Distance Calculation
```

---

# 57. STEP 12 — ATTENDANCE ENGINE

Implementasi:

```text
Check-in
Check-out
Shift Validation
Face
Liveness
Device
GPS
Geofence
Request Integrity
```

---

# 58. STEP 13 — RISK ENGINE

Implementasi:

```text
Risk Score
Risk Category
Low Risk
Medium Risk
High Risk
```

Semua parameter harus dapat dikonfigurasi kemudian.

---

# 59. STEP 14 — ATTENDANCE HISTORY

Mobile:

```text
History
Detail
Filter
```

Web:

```text
Search
Filter
Department
Employee
Date
Status
```

---

# 60. STEP 15 — CORRECTION

Implementasi:

```text
Create Request
Review
Approve
Reject
Audit
```

---

# 61. STEP 16 — LEAVE

Implementasi:

```text
Leave Request
Approval
Rejection
History
```

---

# 62. STEP 17 — SUPERVISOR DASHBOARD

Implementasi:

```text
Team Monitoring
Attendance
Late
Absent
Correction
Leave
Reports
```

Authorization harus membatasi supervisor hanya ke team yang menjadi kewenangannya.

---

# 63. STEP 18 — ADMIN DEVICE MANAGEMENT

Implementasi:

```text
Device List
Device Detail
Revoke
Lost
Replacement Approval
Device History
```

---

# 64. STEP 19 — AUDIT LOG

Implementasi:

```text
Audit Recording
Audit Viewer
Filtering
Search
Security Events
```

Audit log tidak dapat diedit dari dashboard.

---

# 65. STEP 20 — REPORTING

Implementasi:

```text
Daily Report
Monthly Report
Department Report
Employee Report
Late Report
Leave Report
```

Export:

```text
Excel
CSV
PDF
```

---

# 66. STEP 21 — PRIVACY & PDP

Implementasi:

```text
Privacy Notice
Consent / Legal Basis Handling
Retention
Face Data Protection
Data Access
Data Deletion Policy
Audit
```

Catatan:

> Detail legal final harus direview pihak yang memiliki kewenangan legal/privacy di rumah sakit.

---

# 67. STEP 22 — SECURITY HARDENING

Audit seluruh sistem:

```text
Authentication
Authorization
API
Database
Device
Face
GPS
Session
Token
Audit
Encryption
Rate Limit
```

---

# 68. STEP 23 — TESTING

Backend:

```text
Unit Test
Integration Test
E2E
```

Mobile:

```text
Camera
Face
Liveness
GPS
Device
Permission
Offline
```

Web:

```text
UI
RBAC
CRUD
Permission
```

---

# 69. STEP 24 — SECURITY / ATTACK TESTING

Simulasikan:

```text
Fake GPS
Photo Face
Video Face
Replay Request
Token Theft
Device Theft
Account Sharing
JWT Manipulation
Privilege Escalation
SQL Injection
Brute Force
Unauthorized Device
Duplicate Attendance
```

Setiap vulnerability:

```text
Found
↓
Fix
↓
Retest
↓
Pass
```

---

# 70. STEP 25 — PRODUCTION DEPLOYMENT

Infrastructure:

```text
Docker
Docker Compose
Nginx
HTTPS
PostgreSQL
Redis
Backup
Monitoring
Logging
```

Production checklist:

```text
Environment Secret
Database Backup
HTTPS
Firewall
Rate Limit
Monitoring
Alert
Log Rotation
Backup Test
Recovery Test
Security Review
```

---

# 71. API STRUCTURE

Base:

```text
/api/v1
```

Module:

```text
/auth
/users
/employees
/departments
/hospitals
/devices
/device-change
/face
/liveness
/shifts
/schedules
/attendance
/corrections
/leaves
/supervisor
/admin
/superadmin
/reports
/audit
/security
```

---

# 72. SECURITY API RULE

Setiap endpoint harus mempunyai:

```text
Authentication
Authorization
Input Validation
Rate Limit
Audit jika sensitif
Error Handling
```

Endpoint sensitif:

```text
/device/revoke
/device/replace
/face/register
/face/delete
/attendance/check-in
/attendance/check-out
/role/change
/security/config
```

mendapatkan security tambahan.

---

# 73. AI CODER DEVELOPMENT RULE

AI Coder **DILARANG**:

* Mengerjakan semua STEP sekaligus.
* Melompat ke STEP berikutnya.
* Membuat fitur yang belum diminta.
* Menghapus histori data.
* Mengganti arsitektur tanpa alasan.
* Mengabaikan security.
* Menggunakan mock sebagai production implementation tanpa penjelasan.
* Menyimpan password plaintext.
* Mempercayai data client secara langsung.
* Menganggap device ID sebagai satu-satunya security.
* Menghapus audit log.
* Menghapus data biometrik tanpa proses yang benar.

---

# 74. CARA MEMBERIKAN INSTRUKSI KE AI CODER

Jangan:

```text
Buat aplikasi absensi rumah sakit sesuai PRD.
```

Gunakan:

```text
Kerjakan STEP 0.
```

Setelah selesai:

```text
Lanjut STEP 1.
```

Setelah selesai:

```text
Lanjut STEP 2.
```

Dan seterusnya.

---

# 75. FORMAT OUTPUT WAJIB AI CODER

Setiap STEP harus menghasilkan:

```text
## STEP X — [NAME]

### 1. Tujuan

...

### 2. Implementasi

...

### 3. File Dibuat

...

### 4. File Diubah

...

### 5. Dependency

...

### 6. Security Implemented

...

### 7. Testing

...

### 8. Test Result

PASS / FAILED

### 9. Issues

...

### 10. Acceptance Criteria

...

### 11. Status

STEP X COMPLETE
WAITING FOR NEXT INSTRUCTION
```

---

# 76. RULE JIKA TEST GAGAL

Jika test gagal:

```text
STATUS = FAILED
```

AI Coder harus:

1. Menjelaskan error.
2. Menemukan penyebab.
3. Memperbaiki.
4. Menjalankan test ulang.
5. Memastikan PASS.
6. Baru menyatakan STEP selesai.

AI tidak boleh melanjutkan ke STEP berikutnya dalam keadaan:

```text
FAILED
```

---

# 77. DEFINITION OF DONE GLOBAL

Project dianggap selesai jika:

* [ ] Mobile selesai
* [ ] Backend selesai
* [ ] Web selesai
* [ ] Authentication selesai
* [ ] RBAC selesai
* [ ] Device binding selesai
* [ ] Device replacement selesai
* [ ] Face recognition selesai
* [ ] Liveness selesai
* [ ] GPS selesai
* [ ] Geofence selesai
* [ ] Attendance engine selesai
* [ ] Risk engine selesai
* [ ] Shift selesai
* [ ] Correction selesai
* [ ] Leave selesai
* [ ] Supervisor dashboard selesai
* [ ] Admin dashboard selesai
* [ ] Super Admin selesai
* [ ] Audit log selesai
* [ ] Reporting selesai
* [ ] Privacy/PDP requirements direview
* [ ] Security hardening selesai
* [ ] Unit test selesai
* [ ] Integration test selesai
* [ ] E2E test selesai
* [ ] Security test selesai
* [ ] Production deployment selesai
* [ ] Backup & recovery teruji

---

# 78. MASTER PROMPT UNTUK AI CODER

Gunakan prompt berikut ketika memberikan PRD ini ke AI Coder:

> Kamu bertindak sebagai Senior Software Engineer, Security Engineer, Backend Engineer, Mobile Engineer, dan DevOps Engineer.
>
> Baca seluruh PRD terlebih dahulu.
>
> **JANGAN mengerjakan seluruh project sekaligus.**
>
> Project harus dikerjakan secara bertahap berdasarkan STEP yang ada di PRD.
>
> Untuk setiap instruksi saya, kamu hanya boleh mengerjakan STEP yang saya minta.
>
> Jangan mengerjakan STEP berikutnya sebelum saya memberikan instruksi secara eksplisit.
>
> Setiap STEP wajib:
>
> 1. Menganalisis requirement step tersebut.
> 2. Membuat atau mengubah file yang diperlukan.
> 3. Menjaga arsitektur project.
> 4. Menerapkan security requirement.
> 5. Tidak merusak fitur sebelumnya.
> 6. Menjalankan test yang relevan.
> 7. Memperbaiki error sebelum menyatakan selesai.
> 8. Menjelaskan file yang dibuat/diubah.
> 9. Menjelaskan security yang diterapkan.
> 10. Memberikan hasil testing.
>
> Jika testing gagal, jangan lanjut ke STEP berikutnya.
>
> Jangan menggunakan data palsu sebagai pengganti implementasi production tanpa menjelaskannya.
>
> Jangan menyimpan password plaintext.
>
> Jangan mempercayai data penting dari client tanpa validasi server.
>
> Jangan menghapus histori attendance, device, atau audit log.
>
> Jangan mengubah requirement atau architecture tanpa menjelaskan alasan dan meminta persetujuan jika perubahan tersebut signifikan.
>
> Setelah STEP selesai, berhenti dan tunggu instruksi saya.
>
> Format akhir:
>
> `STEP X COMPLETE — WAITING FOR NEXT INSTRUCTION`
>
> Untuk memulai, saya akan memberikan:
>
> **"Kerjakan STEP 0."**

---

# 79. DEVELOPMENT FLOW FINAL

```text
                    PRD
                     │
                     ▼
              ┌─────────────┐
              │   STEP 0    │
              │  Analysis   │
              └──────┬──────┘
                     │
                  REVIEW
                     │
                     ▼
              ┌─────────────┐
              │   STEP 1    │
              │   Setup     │
              └──────┬──────┘
                     │
                  TEST
                     │
                     ▼
              ┌─────────────┐
              │   STEP 2    │
              │  Database   │
              └──────┬──────┘
                     │
                  TEST
                     │
                     ▼
                   ...
                     │
                     ▼
              ┌─────────────┐
              │   STEP 23   │
              │   Testing   │
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │   STEP 24   │
              │   Security  │
              │    Test     │
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │   STEP 25   │
              │ Production  │
              └─────────────┘
```

---

# 80. CORE SECURITY PRINCIPLE

Sistem tidak boleh hanya bertanya:

> **"Apakah wajahnya cocok?"**

Tetapi harus menjawab:

> **"Apakah orangnya benar, wajahnya benar, hidup/original, device-nya sah, device tidak dicurigai, lokasinya benar, berada di geofence, waktunya sesuai shift, request-nya valid, dan seluruh proses dapat diaudit?"**

Barulah sistem memberikan keputusan:

```text
                 ┌──────────────┐
                 │  ATTENDANCE  │
                 └──────┬───────┘
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
     FACE            DEVICE            GPS
       │                │                │
       ▼                ▼                ▼
   LIVENESS         INTEGRITY         GEOFENCE
       │                │                │
       └────────────────┼────────────────┘
                        ▼
                  SHIFT VALIDATION
                        │
                        ▼
                 REQUEST SECURITY
                        │
                        ▼
                   RISK ENGINE
                        │
                 ┌──────┴──────┐
                 ▼             ▼
              APPROVE        REJECT
                 │
                 ▼
             AUDIT LOG
```

**Prinsip final:** sistem ini dibangun **security-first, server-authoritative, privacy-by-design, dan step-by-step**. AI Coder tidak boleh langsung mengerjakan keseluruhan aplikasi.
