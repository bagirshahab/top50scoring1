# Sistem Penjurian Karya HTML — AI For All Hackathon 2026

Website penjurian untuk menilai karya HTML peserta hackathon. Terdiri dari:

- **Login Admin** — menambah karya HTML peserta, membuat akun juri, dan melihat dashboard ranking.
- **Login Juri** — melihat preview tiap karya lalu memberi penilaian 5 parameter berbobot (slider atau ketik manual).
- **Ranking otomatis berbobot** — nilai berbobot (0–100) dari semua juri langsung dirata-ratakan dan diurutkan dari tertinggi.
- **Leaderboard publik** — halaman transparan tanpa login (`leaderboard.html`) yang bisa dibagikan ke umum.

Dibangun dengan **Vercel Serverless Functions** + **Neon Postgres**, memakai palette merah resmi hackathon.

---

## 1. Isi Folder

```
penjurian/
├── index.html         # Halaman login (admin & juri)
├── admin.html         # Dashboard admin
├── juri.html          # Panel juri
├── leaderboard.html   # Leaderboard PUBLIK (tanpa login, untuk transparansi)
├── style.css          # Tema merah hackathon (semua halaman)
├── app.js             # Helper frontend (auth, fetch, toast)
├── admin.js           # Logika dashboard admin
├── juri.js            # Logika panel juri
├── schema.sql         # Skrip pembuatan tabel database
├── package.json       # Dependensi (neon, bcryptjs, jsonwebtoken)
├── vercel.json        # Konfigurasi routing Vercel
├── .env.example       # Contoh variabel lingkungan
└── api/               # Backend serverless
    ├── _lib.js             # Helper bersama (DB, JWT, CORS)
    ├── login.js            # POST  /api/login
    ├── works.js            # GET/POST/DELETE /api/works
    ├── judges.js           # GET/POST/DELETE /api/judges
    ├── scores.js           # GET/POST /api/scores (weighted scoring)
    ├── my-scores.js        # GET  /api/my-scores
    ├── ranking.js          # GET  /api/ranking (admin, lengkap)
    ├── public-leaderboard.js # GET /api/public-leaderboard (publik, data aman saja)
    ├── preview.js          # GET  /api/preview (render HTML karya)
    └── health.js           # GET  /api/health (cek koneksi DB)
```

---

## 2. Parameter Penilaian (5 kriteria berbobot)

Tiap juri menilai setiap karya dengan skala **1–100** pada 5 parameter. Setiap parameter punya **bobot (weight)** berbeda:

| Parameter | Bobot | Keterangan |
|-----------|:----:|------------|
| Problem & Impact | 25% | Seberapa jelas masalah didefinisikan dan seberapa besar dampaknya |
| Solution Fit & Insight | 25% | Seberapa pas solusi dengan masalah, dan kedalaman insight di baliknya |
| Evidence & Consistency | 15% | Kualitas bukti dan konsistensi klaim |
| Feasibility & Risk Honesty | 15% | Kelayakan realistis dan kejujuran soal risiko/keterbatasan |
| Visual & User Experience | 20% | Kualitas desain visual dan pengalaman pengguna |

**Nilai berbobot per juri (0–100):**
```
weighted = (problem×25 + solution×25 + evidence×15 + feasibility×15 + ux×20) / 100
```

**Nilai akhir karya** = rata-rata `weighted` dari semua juri → otomatis dirangking dari tertinggi.

Di panel juri, tiap parameter menampilkan:
- **Slider** dan **kotak input angka** yang tersinkron dua arah (geser atau ketik manual).
- **Badge persentase bobot** (mis. `25%`) agar juri tahu mana yang porsinya lebih besar.
- Tombol **`?`** — arahkan kursor (hover) atau fokus untuk melihat **penjelasan lengkap** tiap parameter.

> Mau ganti nama/bobot parameter? Ubah array `PARAMS` di `juri.js`, objek `WEIGHTS` di `api/scores.js`, dan kolom di `schema.sql`. Pastikan total bobot = 100.

---

## 3. Langkah Setup Database (Neon Postgres)

> Catatan: project hackathon Anda yang lain (form submission, bursa) sudah memakai Neon. Anda **boleh pakai database Neon yang sama** — tabel penjurian diberi prefiks `pj_` sehingga tidak bentrok.

1. Buka [https://neon.tech](https://neon.tech) → login → pilih project Anda (atau **Create Project** baru).
2. Masuk ke menu **SQL Editor**.
3. Buka file `schema.sql`, salin seluruh isinya, tempel ke SQL Editor, lalu klik **Run**. Ini membuat tabel: `pj_works`, `pj_judges`, `pj_scores`, `pj_admins`.
4. Masuk ke menu **Connection Details** → pilih **Pooled connection** → salin connection string. Bentuknya:
   ```
   postgres://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/DBNAME?sslmode=require
   ```
   Simpan string ini untuk langkah berikutnya (jadi nilai `DATABASE_URL`).

> **Sudah pernah pakai versi parameter lama?** Jika tabel `pj_scores` lama Anda masih memakai kolom `innovation/functionality/design/impact/technical`, jalankan blok **MIGRATION** yang ada di bagian bawah `schema.sql` untuk mengganti ke parameter berbobot baru. (Blok itu menghapus nilai lama karena arti parameter berubah, lalu menambah kolom `problem/solution/evidence/feasibility/ux` + `weighted` — juri cukup menilai ulang.)

---

## 4. Variabel Lingkungan (Environment Variables)

Salin `.env.example` menjadi `.env.local` (untuk uji lokal), dan isi nilai yang sama di Vercel untuk production.

| Variabel | Keterangan |
|----------|------------|
| `DATABASE_URL` | Connection string Neon (langkah 3). |
| `JWT_SECRET` | String acak panjang untuk tanda tangan sesi. Buat dengan: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_USERNAME` | Username admin (mis. `admin`). |
| `ADMIN_PASSWORD` | Password admin — buat yang kuat. |
| `ALLOWED_ORIGIN` | Boleh `*`. Untuk lebih aman isi `https://aiforallhackathon.com`. |
| `LEADERBOARD_PUBLIC` | Opsional. Set `false` untuk menyembunyikan leaderboard publik (mis. sebelum penjurian selesai). Default `true` (tampil). |
| `JUDGING_OPENS_AT` | Opsional. Waktu buka penjurian (ISO 8601, mis. `2026-11-06T00:00:00+07:00`). Sebelum waktu ini, halaman utama menampilkan countdown dan juri tidak bisa login (admin tetap bisa). Default `2026-11-06T00:00:00+07:00`. |
| `JUDGING_CLOSES_AT` | Opsional. Waktu tutup penjurian (ISO 8601, mis. `2026-11-08T15:00:00+07:00`). Pada/setelah waktu ini, halaman utama menampilkan "Judging Closed" dan juri tidak bisa login lagi (admin tetap bisa lewat `/login?admin=1`). Default `2026-11-08T15:00:00+07:00`. |

Admin login memakai `ADMIN_USERNAME` / `ADMIN_PASSWORD` (tidak perlu disimpan di DB). Akun juri dibuat lewat dashboard admin dan tersimpan ter-hash di tabel `pj_judges`.

---

## 5. Uji Coba Lokal (opsional)

```bash
# di dalam folder penjurian/
npm install
npm install -g vercel        # jika belum ada CLI vercel
vercel dev                   # jalan di http://localhost:3000
```

Cek koneksi DB: buka `http://localhost:3000/api/health` — harus menampilkan `"db": "connected"`.

---

## 6. Deploy ke Vercel

### Opsi A — Deploy sebagai project Vercel terpisah (paling sederhana)

1. Push folder `penjurian/` ke sebuah repo Git (atau subfolder repo yang sudah ada).
2. Di [vercel.com](https://vercel.com) → **Add New → Project** → import repo.
3. Pada **Root Directory**, pilih folder `penjurian`.
4. Buka **Settings → Environment Variables**, isi semua variabel dari langkah 4.
5. Klik **Deploy**. Setelah selesai Anda dapat URL seperti `https://penjurian-xxxx.vercel.app`.
6. Lanjut ke **langkah 7** untuk memasang ke `aiforallhackathon.com/penjurian`.

### Opsi B — Via CLI

```bash
cd penjurian
vercel            # deploy preview
vercel --prod     # deploy production
```
Lalu set environment variables lewat dashboard Vercel (langkah 4) dan **redeploy**.

---

## 7. Menyajikan di `https://aiforallhackathon.com/penjurian`

Domain `aiforallhackathon.com` kemungkinan sudah terpasang ke project Vercel utama Anda. Ada 2 cara memunculkan penjurian di path `/penjurian`:

### Cara 1 — Rewrite dari project utama (direkomendasikan)

Deploy penjurian sebagai project Vercel sendiri (Opsi A), lalu di **project utama** (yang memegang domain `aiforallhackathon.com`), tambahkan rewrite pada `vercel.json`-nya:

```json
{
  "rewrites": [
    {
      "source": "/penjurian",
      "destination": "https://penjurian-xxxx.vercel.app/index.html"
    },
    {
      "source": "/penjurian/:path*",
      "destination": "https://penjurian-xxxx.vercel.app/:path*"
    }
  ]
}
```

Ganti `penjurian-xxxx.vercel.app` dengan domain hasil deploy penjurian. Redeploy project utama. Sekarang `https://aiforallhackathon.com/penjurian` menampilkan sistem penjurian.

> Catatan: karena di-rewrite, path aset (`style.css`, `app.js`, `/api/...`, `/preview/...`) tetap diminta relatif dan diteruskan ke project penjurian — sudah ditangani oleh pola `:path*` di atas.

### Cara 2 — Subdomain khusus (lebih bersih)

Jika lebih mudah, pakai subdomain `penjurian.aiforallhackathon.com`:

1. Di dashboard Vercel project penjurian → **Settings → Domains** → **Add** `penjurian.aiforallhackathon.com`.
2. Vercel menampilkan record DNS (biasanya `CNAME` → `cname.vercel-dns.com`).
3. Tambahkan record itu di penyedia DNS domain Anda.
4. Tunggu propagasi (beberapa menit) → akses `https://penjurian.aiforallhackathon.com`.

Lalu cukup taruh tautan "Penjurian" di navigasi website utama.

---

## 8. Cara Pakai

### Halaman utama = Countdown
- URL utama (`/`) menampilkan **halaman countdown** menuju waktu buka penjurian (`JUDGING_OPENS_AT`, default 6 Nov 2026).
- Selama countdown berjalan, juri **tidak bisa login** — baik dari UI maupun server (API menolak login juri sebelum waktunya). Admin **tetap bisa** login untuk menyiapkan karya & akun juri.
- Begitu waktunya tiba, halaman countdown otomatis menampilkan tombol **Enter Judging Platform** menuju halaman login (`/login`).

### Admin
1. Buka `/login` (atau dari countdown) → pilih tab **Admin** → login dengan `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
2. Tab **Karya**: unggah file `.html` peserta (atau tempel kodenya), isi nama tim & judul → **Simpan**. Tiap karya dapat kode unik `KARYA-01`, `KARYA-02`, ...
3. Tab **Juri**: buat akun untuk tiap juri (3–5 orang). Catat username & passwordnya, bagikan ke juri.
4. Tab **Ranking**: pantau hasil. Begitu juri submit, skor berbobot langsung masuk, dirata-ratakan antar juri, dan diurutkan dari tertinggi. Klik baris untuk melihat rincian nilai tiap juri. Tombol **🌐 Public Leaderboard** membuka halaman transparan untuk dibagikan.

### Juri
1. Setelah penjurian dibuka, buka `/login` → tab **Juri** → login dengan akun dari admin.
2. Lihat daftar karya (dengan preview mini). Klik satu karya.
3. Lihat preview penuh di kiri. Di kanan, nilai 5 parameter — **geser slider** atau **ketik angka langsung** (1–100). Lihat badge bobot `%` dan arahkan kursor ke `?` untuk detail tiap parameter. Skor berbobot (0–100) terhitung otomatis. Tulis catatan (opsional) → **Simpan Penilaian**.
4. Nilai bisa diubah kapan saja selama masa penjurian. Karya yang sudah dinilai ditandai ✓.

### Leaderboard Publik (transparansi)
- Halaman `leaderboard.html` **tidak perlu login** dan hanya menampilkan data aman: peringkat, kode karya, nama tim/judul, jumlah juri, dan skor berbobot. **Tidak** menampilkan nama juri, nilai per juri, komentar, atau akun.
- Admin bisa membukanya lewat tombol **🌐 Public Leaderboard** di tab Ranking.
- **Cara share ke publik:** bagikan link ini → **`https://top50scoring.vercel.app/leaderboard`** (tanpa `.html`, berkat `cleanUrls` di `vercel.json`). (Jika nanti memakai domain kustom: `https://aiforallhackathon.com/penjurian/leaderboard`.)
- Halaman auto-refresh tiap 30 detik dan menampilkan podium Top 3.
- Ingin menyembunyikan sementara (mis. sebelum hasil final)? Set env `LEADERBOARD_PUBLIC=false` di Vercel lalu redeploy. Set `true` (atau hapus) untuk menampilkan lagi.

---

## 9. Fitur Tambahan yang Sudah Disertakan

- **Penilaian berbobot** (25/25/15/15/20) dengan skor akhir 0–100 yang adil sesuai porsi.
- **Input ganda** — slider + ketik angka manual yang tersinkron, plus badge bobot & tooltip detail parameter.
- **Leaderboard publik** terpisah untuk transparansi, dengan podium Top 3 & auto-refresh, dan toggle tampil/sembunyi via ENV.
- **Identitas unik tiap karya** (`KARYA-01` + UUID) menyatukan nilai dari semua juri.
- **Upsert penilaian** — satu juri satu nilai per karya, bisa diperbarui tanpa duplikat.
- **Preview aman** memakai `<iframe sandbox>`.
- **Statistik ringkas** (jumlah karya, juri, penilaian masuk, peringkat #1).
- **Rincian per juri** + catatan, terlihat di dashboard admin.
- **Responsif** (desktop & mobile) dan proteksi XSS pada data yang ditampilkan.
- **Endpoint `/api/health`** untuk memastikan koneksi DB benar setelah deploy.

---

## 10. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `/api/health` menampilkan error DB | Pastikan `DATABASE_URL` benar dan `schema.sql` sudah dijalankan di Neon. |
| Login admin gagal | Cek `ADMIN_USERNAME` / `ADMIN_PASSWORD` di Environment Variables, lalu **redeploy**. |
| Login selalu "Sesi berakhir" | `JWT_SECRET` belum di-set atau berbeda antar deploy — set lalu redeploy. |
| Preview karya kosong | Pastikan karya diunggah dengan isi HTML valid (bukan file kosong). |
| Perubahan env tidak berpengaruh | Setelah mengubah env di Vercel, wajib **Redeploy**. |
| Leaderboard publik "terkunci" | Env `LEADERBOARD_PUBLIC` di-set `false`. Ubah ke `true` (atau hapus) lalu redeploy. |
| Error kolom `problem/weighted` tidak ada | DB masih pakai skema lama. Jalankan blok MIGRATION di `schema.sql`. |
```
