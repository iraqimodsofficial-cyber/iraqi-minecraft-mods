const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

export async function onRequest({ request, env }) {
  try {
    if (!env.DB) return reply({ error: "قاعدة البيانات غير مربوطة" }, 503);

    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      settings_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();

    if (request.method === "GET") {
      const row = await env.DB.prepare(
        "SELECT settings_json FROM site_settings WHERE id = 1"
      ).first();
      if (!row) return reply({});
      try { return reply(JSON.parse(row.settings_json)); }
      catch { return reply({}); }
    }

    if (request.method !== "PUT") {
      return reply({ error: "Method not allowed" }, 405);
    }

    if (!env.ADMIN_PASSWORD) return reply({ error: "Admin setup incomplete" }, 503);
    if (request.headers.get("X-Admin-Password") !== env.ADMIN_PASSWORD) {
      return reply({ error: "كلمة المرور غير صحيحة" }, 401);
    }

    const body = await request.json();
    const allowed = {};
    for (const key of ["title", "username", "description", "youtube", "instagram", "tiktok", "avatar", "banner", "lang", "accent"]) {
      if (body[key] !== undefined) allowed[key] = String(body[key]).slice(0, key === "avatar" || key === "banner" ? 500000 : 2000);
    }
    const json = JSON.stringify(allowed);
    if (json.length > 850000) return reply({ error: "حجم الصور كبير. اختر صوراً أصغر." }, 413);

    await env.DB.prepare(`INSERT INTO site_settings (id, settings_json, updated_at)
      VALUES (1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = CURRENT_TIMESTAMP`
    ).bind(json).run();

    return reply({ success: true });
  } catch {
    return reply({ error: "حدث خطأ في الخادم" }, 500);
  }
}
