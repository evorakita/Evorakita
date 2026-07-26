// /api/create-user.js
// Serverless function Vercel — BUKAN dipanggil langsung dari browser dengan
// service role key (itu akan bocor). Endpoint ini yang PEGANG service role key
// (dari environment variable, aman di server), lalu browser cuma kirim
// Authorization Bearer <access_token owner yang sedang login>.
//
// ENV YANG WAJIB ADA DI VERCEL (Project Settings → Environment Variables):
//   SUPABASE_URL                → sama dengan yang di config.js
//   SUPABASE_SERVICE_ROLE_KEY   → dari Supabase Dashboard → Settings → API
//                                  (JANGAN PERNAH taruh ini di config.js/frontend!)

const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // 1. Verifikasi token pemanggil (harus owner/manager yang sedang login)
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: "Token tidak ada. Login dulu." });
      return;
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      res.status(401).json({ error: "Token tidak valid atau sudah kedaluwarsa." });
      return;
    }

    const { data: callerProfile, error: callerErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (callerErr || !callerProfile || !["owner", "manager"].includes(callerProfile.role)) {
      res.status(403).json({ error: "Cuma owner/manager yang boleh membuat akun baru." });
      return;
    }

    // 2. Ambil & validasi body
    const {
      emailOrUsername, password, role, displayName,
      branchId, investorId, gajiHarian, areaId, cities, city
    } = req.body || {};

    if (!emailOrUsername || !password) {
      res.status(400).json({ error: "Email/username dan password wajib diisi." });
      return;
    }
    if (String(password).trim().length < 6) {
      res.status(400).json({ error: "Password minimal 6 karakter." });
      return;
    }
    const allowedRoles = ["owner", "manager", "area_manager", "worker", "investor", "distribusi"];
    if (!allowedRoles.includes(role)) {
      res.status(400).json({ error: "Role tidak dikenali: " + role });
      return;
    }
    // Manager cuma boleh membuat akun worker (bukan owner/manager lain) — cegah eskalasi hak akses.
    // Kalau kamu mau manager bisa buat akun lain juga, longgarkan baris ini.
    if (callerProfile.role === "manager" && role !== "worker") {
      res.status(403).json({ error: "Manager cuma boleh membuat akun worker." });
      return;
    }

    // 3. Buat user di Supabase Auth
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: emailOrUsername,
      password: String(password).trim(),
      email_confirm: true // langsung aktif, tidak perlu verifikasi email (workaround krn banyak pakai username palsu)
    });
    if (createErr) {
      res.status(400).json({ error: createErr.message || "Gagal membuat akun di Auth." });
      return;
    }

    // 4. Insert baris profiles yang sesuai
    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      user_id: created.user.id,
      email: emailOrUsername,
      display_name: displayName || null,
      role,
      branchId: role === "worker" ? branchId : null,
      investorId: role === "investor" ? investorId : null,
      gajiHarian: role === "worker" ? gajiHarian : null,
      areaId: role === "manager" ? areaId : null,
      cities: role === "manager" ? cities : null,
      city: role === "manager" ? city : null,
      active: true
    });
    if (profileErr) {
      // Rollback: kalau insert profiles gagal, hapus lagi user Auth-nya biar tidak nyangkut
      // (akun Auth tanpa baris profiles = user yang bisa login tapi app-nya nge-block terus).
      await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
      res.status(500).json({ error: "Gagal menyimpan profil: " + profileErr.message });
      return;
    }

    res.status(200).json({ ok: true, user_id: created.user.id });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
};
