// /api/reset-password.js
// Sama seperti create-user.js: service role key cuma hidup di server (env var),
// browser cuma kirim Bearer token punya owner/manager yang sedang login.

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
      res.status(403).json({ error: "Cuma owner/manager yang boleh reset password." });
      return;
    }

    const { userId, password } = req.body || {};
    if (!userId || !password) {
      res.status(400).json({ error: "userId dan password wajib diisi." });
      return;
    }
    if (String(password).trim().length < 6) {
      res.status(400).json({ error: "Password minimal 6 karakter." });
      return;
    }

    // Manager cuma boleh reset password worker di bawahnya sendiri, bukan sesama manager/owner.
    if (callerProfile.role === "manager") {
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles").select("role").eq("user_id", userId).maybeSingle();
      if (!targetProfile || targetProfile.role !== "worker") {
        res.status(403).json({ error: "Manager cuma boleh reset password akun worker." });
        return;
      }
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: String(password).trim()
    });
    if (updErr) {
      res.status(400).json({ error: updErr.message || "Gagal reset password." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
};
