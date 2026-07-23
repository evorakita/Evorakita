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
    const { emailOrUsername, password, role, displayName = null, branchId = null, investorId = null, areaId = null } = body;

    const raw = String(emailOrUsername || "").trim();
    const pwd = String(password || "").trim();
    const finalRole = String(role || "").trim();

    if (!raw) return res.status(400).json({ error: "Username/Email wajib diisi." });
    if (!pwd || pwd.length < 6) return res.status(400).json({ error: "Password minimal 6 karakter." });
    if (!["worker", "investor", "owner", "manager", "distribusi"].includes(finalRole))
      return res.status(400).json({ error: "Role harus worker/investor/owner/manager/distribusi." });

    const email = (raw.includes("@") ? raw : `${raw.toLowerCase()}@evoradonuts.local`).toLowerCase();
    if (finalRole === "worker" && !branchId) return res.status(400).json({ error: "Pilih cabang untuk worker." });
    if (finalRole === "investor" && !investorId) return res.status(400).json({ error: "Pilih investor untuk investor." });
    // area opsional saat create manager — assign later via Area Operasional
    // if (finalRole === "manager" && !areaId) return res.status(400).json({ error: "Pilih area operasional untuk manager." });

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    const userJson = await userResp.json();
    if (!userResp.ok) return res.status(401).json({ error: userJson?.msg || "Token tidak valid." });
    const ownerId = userJson?.id;
    if (!ownerId) return res.status(401).json({ error: "Tidak bisa membaca owner id." });

    const profResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=role&user_id=eq.${ownerId}&limit=1`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    );
    const profJson = await profResp.json();
    const ownerRole = Array.isArray(profJson) && profJson[0]?.role;
    if (ownerRole !== "owner") return res.status(403).json({ error: "Hanya owner yang boleh membuat akun." });

    const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: pwd,
        email_confirm: true,
        user_metadata: {
          role: finalRole,
          display_name: displayName || email.split("@")[0],
          areaId: finalRole === "manager" ? areaId : null,
          branchId: finalRole === "worker" ? branchId : null,
          investorId: finalRole === "investor" ? investorId : null,
        },
        app_metadata: { role: finalRole },
      }),
    });
    const createJson = await createResp.json();
    if (!createResp.ok)
      return res.status(400).json({ error: createJson?.msg || createJson?.error || "Gagal membuat user." });

    const newUserId = createJson?.id || createJson?.user?.id;
    if (!newUserId) return res.status(400).json({ error: "User dibuat tapi id tidak ditemukan." });

    const profilePayload = {
      user_id: newUserId,
      email,
      role: finalRole,
      display_name: displayName || email.split("@")[0],
      branchId: finalRole === "worker" ? branchId : null,
      investorId: finalRole === "investor" ? investorId : null,
      areaId: finalRole === "manager" ? areaId : null,
      aktif: true,
      status: "active",
    };
    const profInsertResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(profilePayload),
    });
    if (!profInsertResp.ok) {
      const errText = await profInsertResp.text();
      console.warn("profiles insert warning:", errText);
    }

    await fetch(`${SUPABASE_URL}/rest/v1/invites`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        email,
        role: finalRole,
        displayName: displayName || null,
        branchId: finalRole === "worker" ? branchId : null,
        investorId: finalRole === "investor" ? investorId : null,
        created_by: ownerId,
      }),
    }).catch(() => {});

    return res.json({ ok: true, email, userId: newUserId });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
};
