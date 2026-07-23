// api/delete-user.js — hapus akun user (hanya boleh dilakukan owner)
// Dipanggil app via: POST /api/delete-user  body: { userId }  header: Authorization Bearer <owner token>
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    if (!SUPABASE_URL || !ANON || !SERVICE)
      return res.status(500).json({ error: "Env di Vercel belum lengkap (SUPABASE_URL/ANON/SERVICE)." });

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) return res.status(401).json({ error: "Butuh Authorization Bearer token." });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const targetUserId = String(body.userId || body.p_user_id || "").trim();
    if (!targetUserId) return res.status(400).json({ error: "userId wajib diisi." });

    // Validasi token & pastikan pemanggil adalah OWNER
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    const userJson = await userResp.json();
    if (!userResp.ok) return res.status(401).json({ error: userJson?.msg || "Token tidak valid." });
    const requesterId = userJson?.id;
    if (!requesterId) return res.status(401).json({ error: "Tidak bisa membaca user id." });

    const profResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=role&user_id=eq.${requesterId}&limit=1`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    );
    const profJson = await profResp.json();
    const requesterRole = Array.isArray(profJson) && profJson[0]?.role;
    if (requesterRole !== "owner") return res.status(403).json({ error: "Hanya owner yang boleh menghapus akun." });
    if (targetUserId === requesterId) return res.status(400).json({ error: "Tidak bisa menghapus akun sendiri." });

    // Hapus dari auth (service_role)
    const delResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${targetUserId}`, {
      method: "DELETE",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    if (!delResp.ok) {
      const t = await delResp.text();
      // fallback: kalau tak bisa hapus auth, nonaktifkan profil saja
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${targetUserId}`, {
        method: "PATCH",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ aktif: false }),
      }).catch(() => {});
      return res.status(200).json({ ok: true, softDeleted: true, note: "Auth delete gagal (" + t + "), profil dinonaktifkan." });
    }

    // Tandai profil nonaktif (jaga konsistensi bila baris profiles masih ada)
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${targetUserId}`, {
      method: "PATCH",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ aktif: false }),
    }).catch(() => {});

    return res.json({ ok: true, userId: targetUserId });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
};
