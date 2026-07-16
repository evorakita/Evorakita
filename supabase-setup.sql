-- ═══════════════════════════════════════════════════════════════════════════
--  EVORA DONUTS — PAKET SQL SUPABASE LENGKAP (sekali jalan)
--  Untuk database KOSONG. Jalankan di: Supabase → SQL Editor → New query → Run.
--
--  Isi:
--   1. Extension
--   2. Semua tabel (camelCase, dikutip "..." agar cocok dengan kode aplikasi)
--   3. Tabel app_settings (untuk fitur baru: pesanan, kurir, shift, toping, dll)
--   4. Fungsi RPC (submit_transaksi_lapak, hapus_akun_langsung)
--   5. Trigger auto-buat profil saat user daftar
--   6. RLS (Row Level Security) — keamanan multi-cabang
--   7. Realtime
--
--  CATATAN PENTING soal keamanan: aplikasi ini client-side & anon key bersifat
--  publik, jadi RLS di bawah ini adalah SATU-SATUNYA lapisan keamanan data.
--  Versi di bawah memakai kebijakan berbasis ROLE dari tabel profiles.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. EXTENSION ──────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- untuk gen_random_uuid()

-- Jangan validasi isi fungsi saat dibuat — supaya fungsi boleh menyebut tabel
-- yang tabelnya dibuat belakangan di file ini (urutan aman untuk sekali-jalan).
set check_function_bodies = off;

-- ─── 2. HELPER: baca role & cabang user yang sedang login ───────────────────
-- Dipakai oleh RLS. SECURITY DEFINER agar bisa baca profiles tanpa kena RLS sendiri.
create or replace function public.current_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where user_id = auth.uid() limit 1), 'none');
$$;

create or replace function public.current_branch() returns text
language sql stable security definer set search_path = public as $$
  select (select "branchId" from public.profiles where user_id = auth.uid() limit 1);
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = 'owner';
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  -- staf internal yang boleh menulis data operasional
  select public.current_role() in ('owner','manager','worker','distribusi');
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  3. TABEL
-- ═══════════════════════════════════════════════════════════════════════════

-- profiles (identitas & peran) ───────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'worker',           -- owner|manager|worker|investor|distribusi
  display_name text,
  "branchId" text,
  "investorId" text,
  cities text,                                    -- untuk manager (pisah koma)
  "gajiHarian" numeric default 0,
  aktif boolean default true,
  created_at timestamptz default now()
);

-- invites (referensi undangan akun) ─────────────────────────────────────────
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text,
  role text,
  "displayName" text,
  "branchId" text,
  "investorId" text,
  created_by uuid,
  created_at timestamptz default now()
);

-- branches (cabang & central kitchen) ───────────────────────────────────────
create table if not exists public.branches (
  id text primary key,
  name text not null,
  type text default 'lapak',                      -- lapak | central_kitchen
  city text,
  "tipeCabang" text,                              -- mandiri | investasi
  "investorId" text,
  alamat text,
  created_at timestamptz default now()
);

-- investors ─────────────────────────────────────────────────────────────────
create table if not exists public.investors (
  id text primary key,
  nama text not null,
  "persenBagi" numeric default 0,
  hp text,
  created_at timestamptz default now()
);

-- bahanPokok (bahan baku + HPP) ─────────────────────────────────────────────
create table if not exists public."bahanPokok" (
  id text primary key,
  nama text not null,
  "hargaBeli" numeric default 0,
  kapasitas numeric default 1,
  "satuanBeli" text,
  created_at timestamptz default now()
);

-- menuVarian (menu, box, resep) ─────────────────────────────────────────────
create table if not exists public."menuVarian" (
  id text primary key,
  nama text not null,
  tipe text default 'satuan',                     -- satuan | paket | toping
  "hargaJual" numeric default 0,
  "imageUrl" text,
  "imagePath" text,
  "isiBox" int,
  "boxCost" numeric default 0,
  "baseMenuId" text,
  "mixMode" boolean default false,
  "boxMode" text,                                 -- satu | campur | slot
  "resepBahanPokok" jsonb default '[]'::jsonb,
  "resepToping" jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- topingTambahan (toping & glaze) ───────────────────────────────────────────
create table if not exists public."topingTambahan" (
  id text primary key,
  nama text not null,
  "hargaBeli" numeric default 0,
  kapasitas numeric default 1,
  "hargaJual" numeric default 0,
  jenis text default 'topping',                   -- glaze | topping
  "satuanStok" text default 'gram',
  "isiPerBeli" numeric,
  "hargaPerSatuan" numeric,
  "porsiPerPcs" numeric,
  created_at timestamptz default now()
);

-- transactions (penjualan kasir) ────────────────────────────────────────────
create table if not exists public.transactions (
  id text primary key,
  date text not null,
  ts text,
  "branchId" text,
  items jsonb default '[]'::jsonb,
  total numeric default 0,
  "totalHPP" numeric default 0,
  "metodeBayar" text default 'tunai',
  "jumlahBayar" numeric,
  "nonTunaiBayar" numeric,
  kembalian numeric,
  subtotal numeric,
  diskon numeric default 0,
  "diskonTipe" text,
  edited boolean default false,
  "offlineQueued" boolean default false,
  created_at timestamptz default now()
);

-- stokLapak (stok donat di lapak) ───────────────────────────────────────────
create table if not exists public."stokLapak" (
  id text primary key,
  "branchId" text,
  "menuId" text,
  stok numeric default 0,
  "lastUpdate" text
);

-- stokTidakTerjual (donat dibuang/rugi) ─────────────────────────────────────
create table if not exists public."stokTidakTerjual" (
  id text primary key,
  "branchId" text,
  date text,
  "menuId" text,
  "menuNama" text,
  "qtyTidakTerjual" numeric default 0,
  ts text
);

-- setoranHarian ─────────────────────────────────────────────────────────────
create table if not exists public."setoranHarian" (
  id text primary key,
  "branchId" text,
  date text,
  omzet numeric default 0,
  pengeluaran numeric default 0,
  "bersihSistem" numeric default 0,
  "tunaiFisik" numeric default 0,
  "nonTunai" numeric default 0,
  "totalDiterima" numeric default 0,
  "selisihKas" numeric default 0,
  "catatanKas" text,
  status text default 'menunggu',                 -- menunggu | selesai
  locked boolean default false,
  "konfirmasiTs" text,
  ts text
);

-- setoranBulanan (owner → investor) ─────────────────────────────────────────
create table if not exists public."setoranBulanan" (
  id text primary key,
  "branchId" text,
  "investorId" text,
  bulan text,
  omzet numeric default 0,
  modal numeric default 0,
  "pLapak" numeric default 0,
  "pOwner" numeric default 0,
  laba numeric default 0,
  "bagianInvestor" numeric default 0,
  persen numeric default 0,
  status text default 'menunggu',
  "konfirmasiTs" text,
  "confirmedBy" text,
  locked boolean default false,
  "formulaVersion" text,
  ts text
);

-- absensi ───────────────────────────────────────────────────────────────────
create table if not exists public.absensi (
  id text primary key,
  user_id uuid,
  "branchId" text,
  date text,
  checkin_ts text,
  checkout_ts text
);

-- absensiBulanan (rekap terkunci) ───────────────────────────────────────────
create table if not exists public."absensiBulanan" (
  id text primary key,
  user_id uuid,
  bulan text,
  hadir int default 0,
  total_menit int default 0,
  locked boolean default false,
  ts text
);

-- gajiPembayaran ────────────────────────────────────────────────────────────
create table if not exists public."gajiPembayaran" (
  id text primary key,
  user_id uuid,
  bulan text,
  jumlah numeric default 0,
  "gajiHarian" numeric default 0,
  "gajiHarianAvg" numeric default 0,
  hadir int default 0,
  "gajiDetail" jsonb default '[]'::jsonb,
  status text default 'dikirim',                  -- dikirim | dikonfirmasi
  "confirmedAt" text,
  ts text
);

-- pengeluaranLapak ──────────────────────────────────────────────────────────
create table if not exists public."pengeluaranLapak" (
  id text primary key,
  "branchId" text,
  "branchName" text,
  date text,
  ts text,
  keterangan text,
  jumlah numeric default 0
);

-- pengeluaranOwner ──────────────────────────────────────────────────────────
create table if not exists public."pengeluaranOwner" (
  id text primary key,
  nama text,
  jumlah numeric default 0,
  kategori text,
  "branchId" text,
  date text,
  ts text,
  frekuensi text,
  aktif boolean default true,
  "autoGajiUserId" text,
  "createdAt" text
);

-- produksiCK (produksi central kitchen) ─────────────────────────────────────
create table if not exists public."produksiCK" (
  id text primary key,
  date text,
  ts text,
  "menuId" text,
  "menuNama" text,
  jumlah numeric default 0,
  created_at timestamptz default now()
);

-- distribusiCK (kiriman CK → lapak) ─────────────────────────────────────────
create table if not exists public."distribusiCK" (
  id text primary key,
  date text,
  ts text,
  "produksiId" text,
  "menuId" text,
  "menuNama" text,
  "totalProduksi" numeric,
  "branchId" text,
  "branchName" text,
  "jumlahKirim" numeric default 0,
  "jumlahTerima" numeric,
  selisih numeric,
  "catatanSelisih" text,
  "hppPerPcs" numeric,
  "hppTotal" numeric,
  status text default 'pending',                  -- pending | perjalanan | diterima | dibatalkan
  "kurirNama" text,
  "kurirAmbilTs" text,
  "kurirSampaiTs" text,
  "confirmedAt" text,
  created_at timestamptz default now()
);

-- pengambilanBelanja (uang belanja per bahan, 2 langkah) ────────────────────
create table if not exists public."pengambilanBelanja" (
  id text primary key,
  date text,
  ts text,
  jumlah numeric default 0,
  keterangan text,
  "bahanId" text,
  "bahanNama" text,
  "jenisItem" text,
  "qtyYield" numeric,
  "qtyDatang" numeric,
  "qtyOwner" numeric,
  "jumlahTerpakai" numeric,
  status text default 'menunggu',                 -- menunggu | diterima | dibatalkan
  "inputBy" text,
  "terimaBy" text,
  "tsTerima" text,
  "fotoUrl" text,
  "fotoPath" text,
  sumber text,
  version text
);

-- danaPemeliharaan ──────────────────────────────────────────────────────────
create table if not exists public."danaPemeliharaan" (
  id text primary key,
  tipe text,                                      -- setor | tarik
  jumlah numeric default 0,
  keterangan text,
  date text,
  ts text
);

-- tutupBuku & tutupBukuTahunan (snapshot) ───────────────────────────────────
create table if not exists public."tutupBuku" (
  id text primary key,
  bulan text,
  data jsonb,
  locked boolean default false,
  ts text
);
create table if not exists public."tutupBukuTahunan" (
  id text primary key,
  tahun text,
  data jsonb,
  locked boolean default false,
  ts text
);

-- app_settings (key/value) — dipakai fitur: pesanan, kurir, shift, toping,
-- carry donat, stok bahan ledger, gaji histori, dll. ────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value jsonb
);

-- ═══════════════════════════════════════════════════════════════════════════
--  4. RPC FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- submit_transaksi_lapak: simpan transaksi + kurangi stok ATOMIK (anti oversell)
create or replace function public.submit_transaksi_lapak(
  p_id text, p_branch_id text, p_date text, p_ts text,
  p_items jsonb, p_total numeric, p_total_hpp numeric, p_pcs_konsumsi jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  k text; need numeric; cur numeric;
begin
  -- 1) Cek stok cukup untuk tiap menu (kunci baris agar aman dari race)
  for k, need in select key, value::numeric from jsonb_each_text(coalesce(p_pcs_konsumsi,'{}'::jsonb)) loop
    if need is null or need <= 0 then continue; end if;
    select stok into cur from public."stokLapak"
      where "branchId" = p_branch_id and "menuId" = k for update;
    if cur is null then cur := 0; end if;
    if cur < need then
      raise exception 'STOK_KURANG:%', json_build_object('menuId', k, 'sisa', cur)::text;
    end if;
  end loop;

  -- 2) Kurangi stok
  for k, need in select key, value::numeric from jsonb_each_text(coalesce(p_pcs_konsumsi,'{}'::jsonb)) loop
    if need is null or need <= 0 then continue; end if;
    update public."stokLapak" set stok = stok - need, "lastUpdate" = p_ts
      where "branchId" = p_branch_id and "menuId" = k;
  end loop;

  -- 3) Simpan transaksi
  insert into public.transactions (id, date, ts, "branchId", items, total, "totalHPP")
  values (p_id, p_date, p_ts, p_branch_id, coalesce(p_items,'[]'::jsonb), p_total, p_total_hpp)
  on conflict (id) do nothing;
end;
$$;

-- hapus_akun_langsung: dipanggil app; sebenarnya penghapusan auth via Vercel.
-- Di sini hanya menonaktifkan profil (soft) agar aman tanpa service_role di client.
create or replace function public.hapus_akun_langsung(p_user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Hanya owner yang boleh menghapus akun.';
  end if;
  update public.profiles set aktif = false where user_id = p_user_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
--  5. TRIGGER: auto-buat profil saat user baru daftar (dari user_metadata)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, role, display_name, "branchId", "investorId")
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'worker'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'branchId',
    new.raw_user_meta_data->>'investorId'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
--  6. ROW LEVEL SECURITY (RLS)
--  Prinsip:
--   - Semua orang login boleh BACA data master & operasional (aplikasi butuh
--     lihat menu, cabang, stok, dll). Untuk bisnis satu pemilik ini wajar.
--   - MENULIS data operasional: hanya staf internal (owner/manager/worker/
--     distribusi). Investor hanya-baca.
--   - profiles: user lihat dirinya; owner lihat/kelola semua.
--   - app_settings: baca semua login; tulis hanya staf.
--  Kamu bisa perketat lagi nanti (mis. worker hanya cabangnya) — lihat CATATAN
--  di bawah file ini.
-- ═══════════════════════════════════════════════════════════════════════════

-- Aktifkan RLS + kebijakan seragam untuk tabel operasional.
do $$
declare t text;
  op_tables text[] := array[
    'branches','investors','bahanPokok','menuVarian','topingTambahan',
    'transactions','stokLapak','stokTidakTerjual','setoranHarian','setoranBulanan',
    'absensi','absensiBulanan','gajiPembayaran','pengeluaranLapak','pengeluaranOwner',
    'produksiCK','distribusiCK','pengambilanBelanja','danaPemeliharaan',
    'tutupBuku','tutupBukuTahunan','app_settings','invites'
  ];
begin
  foreach t in array op_tables loop
    execute format('alter table public.%I enable row level security;', t);
    -- hapus policy lama jika ada (biar bisa dijalankan ulang)
    execute format('drop policy if exists %I on public.%I;', t||'_read', t);
    execute format('drop policy if exists %I on public.%I;', t||'_write', t);
    -- BACA: semua user login
    execute format($f$create policy %I on public.%I for select to authenticated using (true);$f$, t||'_read', t);
    -- TULIS (insert/update/delete): hanya staf internal
    execute format($f$create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff());$f$, t||'_write', t);
  end loop;
end $$;

-- profiles: kebijakan khusus ────────────────────────────────────────────────
alter table public.profiles enable row level security;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
drop policy if exists profiles_owner_all on public.profiles;
-- baca: user lihat dirinya sendiri; owner & manager lihat semua
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.current_role() in ('owner','manager'));
-- update diri sendiri (mis. ganti nama) — TAPI tidak boleh ubah role sendiri di UI
create policy profiles_self_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- owner boleh semua atas profiles
create policy profiles_owner_all on public.profiles for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ═══════════════════════════════════════════════════════════════════════════
--  7. REALTIME — supaya perubahan langsung tampil di semua HP
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare t text;
  rt_tables text[] := array[
    'branches','investors','bahanPokok','menuVarian','topingTambahan',
    'transactions','stokLapak','stokTidakTerjual','setoranHarian','setoranBulanan',
    'absensi','absensiBulanan','gajiPembayaran','pengeluaranLapak','pengeluaranOwner',
    'produksiCK','distribusiCK','pengambilanBelanja','danaPemeliharaan','profiles','app_settings'
  ];
begin
  for t in select unnest(rt_tables) loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null; when others then null;
    end;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  SELESAI ✅
--
--  LANGKAH SETELAH INI:
--   1. Buat 1 akun OWNER pertama:
--      - Authentication → Users → Add user → isi email (mis. owner@evoradonuts.local)
--        + password. Centang "Auto Confirm".
--      - Lalu jalankan (ganti UUID-nya dengan user_id yang barusan dibuat):
--          update public.profiles set role='owner' where email='owner@evoradonuts.local';
--   2. Storage: buat bucket PUBLIC (mis. "evora-assets") untuk foto menu/nota,
--      lalu isi SUPABASE_ASSET_BUCKET di config.js.
--   3. Vercel (untuk create-user.js): set env SUPABASE_URL, SUPABASE_ANON_KEY,
--      SUPABASE_SERVICE_ROLE_KEY.
--
--  CATATAN KEAMANAN (opsional, untuk perketat nanti):
--   Kebijakan di atas memakai model "semua staf boleh tulis". Untuk kontrol
--   lebih ketat (worker hanya boleh transaksi di cabangnya sendiri), kita bisa
--   ganti policy _write pada tabel tertentu jadi berbasis current_branch().
--   Beri tahu saya kalau mau versi ketat ini.
-- ═══════════════════════════════════════════════════════════════════════════
