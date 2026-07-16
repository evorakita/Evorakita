# 🍩 Evora Donuts — Aplikasi Operasional Bisnis Donat

Aplikasi manajemen bisnis donat multi-cabang: kasir, distribusi kurir, gudang bahan, produksi Central Kitchen, gaji, pesanan & reseller, shift kas, dan laporan lengkap. Berbasis **React (CDN) + Supabase**, tanpa build tool.

---

## 📦 Isi repo

| File / folder | Fungsi |
|---|---|
| `index.html` | Halaman utama (pembungkus) |
| `app.bundle.js` | Seluruh aplikasi (hasil build) |
| `styles.css` | Tampilan |
| `config.js` | Setelan Supabase (URL + anon key — **publik & aman**) |
| `supabaseClient.js` | Penghubung ke Supabase |
| `manifest.webmanifest`, `logo-*.png`, `logo.jpg` | Ikon & PWA |
| `api/create-user.js` | Serverless: buat akun (owner only) |
| `api/delete-user.js` | Serverless: hapus akun (owner only) |
| `supabase-setup.sql` | **SQL setup database** (jalankan sekali) |
| `PANDUAN-SUPABASE.md` | Panduan setup langkah demi langkah |
| `tests/logic.test.js` | Test otomatis logika uang & stok |

---

## 🚀 Cara Deploy (ringkas)

### 1. Setup Supabase
Ikuti **`PANDUAN-SUPABASE.md`**. Ringkasnya:
- SQL Editor → jalankan `supabase-setup.sql`
- Buat akun owner pertama, set role `owner`
- Buat bucket Storage PUBLIC (mis. `evora-assets`)

### 2. Isi `config.js`
```js
SUPABASE_URL: "https://xxxx.supabase.co",   // dari Supabase → Settings → API
SUPABASE_ANON_KEY: "eyJ...",                 // anon public key
SUPABASE_ASSET_BUCKET: "evora-assets",       // nama bucket kamu
```

### 3. Deploy ke Vercel
- Import repo ini ke Vercel
- **Framework Preset: Other** (tidak ada build step — file statis + serverless `/api`)
- Set **Environment Variables** (Settings → Environment Variables):
  | Nama | Isi |
  |---|---|
  | `SUPABASE_URL` | Project URL |
  | `SUPABASE_ANON_KEY` | anon key |
  | `SUPABASE_SERVICE_ROLE_KEY` | service_role key ⚠️ **RAHASIA** |
- Deploy.

> ⚠️ **service_role key** hanya boleh di Environment Variables Vercel — **jangan** taruh di `config.js` atau file mana pun yang di-commit.

---

## 🧪 Menjalankan test
```bash
npm test
```
Menguji logika inti: diskon, box campur/slot, carry-over donat (FIFO), shift kas, piutang, rantai uang kurir, rumus laba.

---

## 🔑 Peran (role) yang didukung
`owner` · `manager` (kepala area) · `worker` (lapak) · `worker`+CK (dapur) · `distribusi` (kurir) · `investor`

---

## 📊 Fitur utama
Kasir (tunai/QRIS/transfer/campur + diskon) · Box campur & per-slot · Pilih glaze · Analisa produk & glaze terlaris · Stok & opname toping · Belanja bahan 2-langkah · Notifikasi stok menipis · Donat carry-over (sisa dijual besok, FIFO) · Pesanan & Reseller (+piutang) · Shift kas · Distribusi kurir (rantai serah-terima) · Absensi & gaji · Tutup buku bulanan/tahunan · Bagi hasil investor.

---

*Aplikasi ini client-side; keamanan data bergantung pada RLS Supabase (sudah termasuk di `supabase-setup.sql`).*
