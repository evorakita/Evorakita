// Konfigurasi runtime (tanpa folder). Aman untuk commit: anon key sifatnya PUBLIC.
// Cara isi:
// 1) Buka Supabase dashboard → Project Settings → API
// 2) Isi SUPABASE_URL dan SUPABASE_ANON_KEY sesuai project kamu
window.APP_CONFIG = {
  SUPABASE_URL: "https://xwznlbfwtnuccjsztohi.supabase.co",
  // TODO: tempel "anon public key" dari Supabase (bukan service_role!)
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3em5sYmZ3dG51Y2Nqc3p0b2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMzg3MTQsImV4cCI6MjA5OTcxNDcxNH0.Oli8VrxKf6RD9oLyUI61rG2rN489PARZRDf7eg6hwvY",
  // Nama bucket Supabase Storage untuk gambar menu/logo.
  // Isi sesuai bucket yang sudah kamu buat di Supabase.
  // Isi nama bucket Storage kamu di Supabase (Supabase → Storage → buat bucket baru, contoh: "evora-assets")
  // Kalau belum punya bucket, buat dulu di dashboard Supabase dengan visibility PUBLIC
  SUPABASE_ASSET_BUCKET: "evora-assets",
  // untuk magic-link redirect
  SITE_URL: window.location.origin,
};
