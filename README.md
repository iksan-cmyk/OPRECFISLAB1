# Open Recruitment — Calon Asisten Fisika Laboratorium I

Website registrasi untuk seleksi Calon Asisten Fisika Laboratorium I (Fislab 1). SPA client-side murni: **tanpa build step, tanpa package.json, tanpa test/lint config**. Cukup edit file dan buka langsung di browser.

Bahasa UI: Bahasa Indonesia, gaya santai/informal ("Semangat bre🔥🔥", dsb). Nada ini bagian dari desain, bukan kebetulan — jangan diubah jadi formal tanpa alasan eksplisit.

## Fitur

- **Formulir pendaftaran** (2 step) — data diri, pilihan judul praktikum, upload dokumen (CV, transkrip, bukti follow), autosave draft ke `localStorage`.
- **Cek status seleksi** via NRP — halaman publik terpisah, menampilkan salah satu dari 5 status beserta jadwal interview (jika sudah lolos berkas).
- **Admin panel** — login (Supabase Auth), kelola daftar pendaftar, lihat/download dokumen lewat signed URL, ubah status, input jadwal interview.

## Struktur file

```
index.html          SPA publik: lobby, form 2 step, halaman sukses (page-based, dikontrol showPage())
script.js            Logic publik: navigasi, validasi, autosave, upload Storage, insert ke Supabase
pengumuman.html       Halaman cek status via NRP (file terpisah, bukan bagian SPA)
pengumuman.js         Logic cek status via NRP
style.css             Variabel warna global (--navy, --blue, --accent, dst) — dipakai index.html, admin.html, pengumuman.html
admin.html            Admin panel (tidak di-link dari navigasi publik)
admin.js              Logic admin: auth, tabel pendaftar, update status, jadwal interview, signed URL dokumen
admin.css             Override style khusus admin
image/meme.png        Aset di halaman sukses
```

## Tech stack

- Vanilla HTML/CSS/JS, tanpa framework maupun bundler
- [Supabase](https://supabase.com) sebagai backend: Postgres (tabel `pendaftar_aslab`), Storage (bucket dokumen), Auth (login admin)
- `@supabase/supabase-js@2` di-load lewat CDN `<script>` di `index.html`, `admin.html`, `pengumuman.html` — **jangan** diinstal via npm/bundler
- Font: Work Sans + Friz Quadrata via CDN

## Konfigurasi Supabase

`SUPABASE_URL` dan `SUPABASE_ANON_KEY` dideklarasikan berulang (blok `/* ── Supabase config ── */`) di tiga file: `script.js`, `admin.js`, `pengumuman.js`. Karena tidak ada build step, config ini **harus disalin manual dan identik** di ketiganya — kalau ubah satu, ubah semua.

Ketentuan penamaan:
- Gunakan nama variabel `SUPABASE_ANON_KEY`, jangan diganti `SUPABASE_PUBLISHABLE_KEY` walau value-nya berawalan `sb_publishable_`.
- `SUPABASE_SECRET_KEY` **tidak** dipakai di project ini — jangan pernah ditaruh di kode manapun (semua akses lewat anon key + RLS).

## Skema database — tabel `pendaftar_aslab`

| kolom | tipe | keterangan |
|---|---|---|
| `id` | uuid/serial (PK) | auto |
| `created_at` | timestamptz | auto |
| `nama_lengkap` | text | |
| `nrp` | text | |
| `email` | text | |
| `no_wa` | text | |
| `motivasi` | text | |
| `skala_prioritas` | int (1–10) | |
| `bisa_tinkercad_proteus` | boolean | |
| `ipk` | numeric (0–4) | |
| `judul_a1` / `judul_a2` | text | judul sebelum ETS |
| `judul_b1` / `judul_b2` | text | judul sesudah ETS |
| `penjelasan_sebelum_ets` | text | |
| `penjelasan_sesudah_ets` | text | |
| `kesediaan_hadir` | text (`bersedia` / `tidak_bersedia`) | |
| `file_cv_path` | text | path Storage |
| `file_transkrip_path` | text | path Storage |
| `file_bukti_follow_path` | text | path Storage |
| `status` | text/enum | hanya ditulis admin, default `pending` |
| `jadwal_interview` | timestamptz, nullable | diisi admin, dibaca publik |

Enum `status` (5 state): `pending` · `lolos_berkas` · `gagal` · `lolos_final` · `ditolak_final`.

### Storage

- Bucket: `pendaftar_dokumen` (harus **private**, akses hanya lewat signed URL)
- Pola path: `<nrp>/<folder>_<timestamp>.<ext>` dengan `folder` ∈ `cv | transkrip | bukti_follow`

### Aturan upload

| dokumen | tipe file | maks. ukuran |
|---|---|---|
| CV | PDF saja | 10 MB |
| Transkrip | PDF atau gambar (JPG/PNG/WEBP) | 5 MB |
| Bukti follow | PDF atau gambar (JPG/PNG/WEBP) | 5 MB |

### RLS

- `pendaftar_aslab` SELECT: `authenticated` (admin) bebas semua kolom; `anon` diizinkan tapi dibatasi column-level GRANT ke 4 kolom saja (`nama_lengkap`, `nrp`, `status`, `jadwal_interview`) — dipakai oleh halaman cek status publik.
- `pendaftar_aslab` UPDATE: hanya `authenticated`.
- `storage.objects` bucket `pendaftar_dokumen`: signed URL hanya bisa digenerate oleh `authenticated`.

## Halaman cek status (pengumuman.html)

Peserta input NRP → fetch baris di `pendaftar_aslab` (4 kolom yang di-GRANT) → tampilkan pesan sesuai status:

| status | badge | pesan |
|---|---|---|
| `pending` | `--gray400` | Masih dalam proses seleksi, sabar ya bre 😌 |
| `lolos_berkas` | `--accent` | Lolos seleksi berkas! Cek jadwal interview kamu di bawah 🔥 |
| `gagal` | `--red` | Belum lolos di tahap ini, semangat next time bre 🙏 |
| `lolos_final` | `--green` | Selamat, kamu resmi jadi Aslab Fislab 1! 🔥🔥 |
| `ditolak_final` | `--red` | Belum lolos di tahap final, makasih udah ikutan bre 🙏 |

Kalau status `lolos_berkas` dan `jadwal_interview` sudah diisi, tanggal ditampilkan via `toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })`. Kalau belum diisi, tampilkan "Jadwal interview menyusul, pantau terus ya".

## Admin panel

- Login via Supabase Auth (email + password); akun dibuat manual lewat Supabase Dashboard — **tidak ada halaman signup**.
- Per baris tabel pendaftar: tombol **Detail** (modal dokumen + signed URL, semua baris), dropdown **status** (semua baris), kontrol **jadwal interview** — input `datetime-local` + tombol Simpan — khusus baris berstatus `lolos_berkas`, menggantikan tombol "Dokumen" yang sudah dihapus.
- Kalau status diubah keluar dari `lolos_berkas`, `jadwal_interview` **tidak** di-clear (dibiarkan untuk histori).

## Menjalankan secara lokal

Tidak ada build step — cukup buka `index.html` di browser (atau serve lewat static server sederhana kalau butuh, misalnya `python3 -m http.server`). Pastikan konfigurasi Supabase di ketiga file JS sudah terisi.

## Known issues / catatan pengembangan

- **Input file di `#step-2` sempat tidak punya `id`**, padahal `submitForm()` membacanya via `getElementById(...)`, menyebabkan `TypeError: Cannot read properties of null (reading 'files')`. Perbaikan: tambahkan `id="file_cv"`, `id="file_transkrip"`, `id="file_bukti_follow"` ke ketiga `<input type="file">`, sekaligus perbaiki hint text yang salah menulis "Maks. 10 MB" untuk transkrip & bukti_follow (seharusnya 5 MB). Cek riwayat PR/commit terkait untuk memastikan status perbaikan ini sudah masuk di branch yang kamu pakai.

## Deployment

Belum ada pipeline deployment otomatis. Kalau deploy manual (mis. Vercel), siapkan environment/DNS sesuai kebutuhan hosting static site — tidak ada langkah build khusus karena project ini tanpa bundler.

## Git remotes

- `origin` → fork dengan admin panel (push ke sini)
- `upstream` → repo publik asli tanpa admin panel