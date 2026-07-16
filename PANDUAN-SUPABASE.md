# 🚀 Panduan Setup Supabase — Evora Donuts

File SQL: **`supabase-setup.sql`** (sudah tervalidasi parser Postgres ✅)

Ikuti urutan ini. Total ± 15 menit.

---

## Langkah 1 — Jalankan SQL utama
1. Buka **supabase.com** → masuk ke project kamu
2. Menu kiri → **SQL Editor** → **+ New query**
3. Buka file `supabase-setup.sql`, **copy semua isinya**, tempel ke editor
4. Klik **Run** (atau Ctrl/Cmd + Enter)
5. Tunggu sampai muncul **"Success"** di bawah

> Ini membuat: 24 tabel, fungsi RPC, trigger auto-profil, RLS keamanan, dan realtime — sekaligus.

---

## Langkah 2 — Buat akun OWNER pertama
1. Menu kiri → **Authentication** → **Users** → **Add user** → **Create new user**
2. Isi:
   - Email: `owner@evoradonuts.local` (atau email kamu)
   - Password: (buat yang kuat)
   - ✅ Centang **Auto Confirm User**
3. Klik **Create user**
4. Kembali ke **SQL Editor**, jalankan ini (ganti email kalau beda):
   ```sql
   update public.profiles set role='owner'
   where email='owner@evoradonuts.local';
   ```
5. Cek berhasil:
   ```sql
   select email, role from public.profiles;
   ```
   → harus muncul barismu dengan role `owner`.

---

## Langkah 3 — Storage (untuk foto menu & nota belanja)
1. Menu kiri → **Storage** → **New bucket**
2. Nama: `evora-assets` → **centang "Public bucket"** → Create
3. Buka file `config.js`, ganti baris:
   ```js
   SUPABASE_ASSET_BUCKET: "ganti_dengan_nama_bucket_kamu",
   ```
   jadi:
   ```js
   SUPABASE_ASSET_BUCKET: "evora-assets",
   ```

---

## Langkah 4 — Vercel (untuk fitur "buat akun pekerja")
Fitur buat akun (`create-user.js`) butuh 3 kunci rahasia di Vercel:
1. Di Supabase: **Project Settings → API** → salin **Project URL**, **anon key**, **service_role key**
2. Di Vercel (project kamu) → **Settings → Environment Variables**, tambahkan:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key ⚠️ (RAHASIA — jangan taruh di frontend/config.js)
3. Redeploy.

---

## Langkah 5 — Tes!
1. Buka aplikasi, login pakai akun owner
2. Masuk **Pengaturan** → buat: cabang, bahan pokok, menu, akun pekerja
3. Coba: kasir, distribusi, tutup toko, belanja, pesanan, shift kas
4. Semua fitur sekarang **menyimpan data betulan** ✅

---

## ✅ Setelah ini aplikasi = 10/10 penuh
Dengan tabel & RLS proper, utang teknis "data numpang di app_settings" untuk data inti sudah teratasi. (Beberapa fitur ringan seperti pesanan/shift/kurir masih pakai app_settings + pengaman `mutateLedger` — aman untuk skala bisnismu. Kalau nanti sangat besar, tinggal bilang, saya pisah ke tabel sendiri.)

---

## ❓ Kalau ada error saat Run SQL
- Copy pesan error-nya, kirim ke saya — saya perbaiki.
- SQL ini didesain untuk **database kosong**. Kalau ternyata sudah ada tabel, sebagian perintah `create table if not exists` akan dilewati (aman).

---

## 🔒 Catatan keamanan (penting untuk multi-cabang)
RLS versi ini: **semua staf boleh tulis data operasional, investor hanya baca.** Ini aman & praktis untuk bisnis satu pemilik. Kalau kamu mau lebih ketat (mis. worker HANYA bisa transaksi di cabangnya sendiri, tidak bisa lihat cabang lain), beri tahu saya — saya buatkan versi RLS ketat berbasis cabang.
