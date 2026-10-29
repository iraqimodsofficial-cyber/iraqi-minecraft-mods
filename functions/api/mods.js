
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password"
      }
    });
  }

  try {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM mods ORDER BY id DESC"
      ).all();

      return reply(results);
    }

    if (!["POST", "PUT", "DELETE"].includes(request.method)) {
      return reply({ error: "Method not allowed" }, 405);
    }

    if (!env.ADMIN_PASSWORD) {
      return reply({ error: "Admin setup incomplete" }, 503);
    }

    if (
      request.headers.get("X-Admin-Password") !==
      env.ADMIN_PASSWORD
    ) {
      return reply({ error: "كلمة المرور غير صحيحة" }, 401);
    }

    if (request.method === "POST" || request.method === "PUT") {
      const body = await request.json();
      const name = String(body.name || "").trim();
      const description = String(body.description || "");
      const image_url = String(body.image_url || "");
      const download_url = String(body.download_url || "").trim();
      const file_size = String(body.file_size || "");

      if (!name || !download_url) {
        return reply({
          error: "اسم المود ورابط التحميل مطلوبان"
        }, 400);
      }

      if (request.method === "POST") {
        const result = await env.DB.prepare(
          `INSERT INTO mods
          (name, description, image_url, download_url, file_size)
          VALUES (?, ?, ?, ?, ?)`
        ).bind(
          name, description, image_url, download_url, file_size
        ).run();

        return reply({
          success: true,
          id: result.meta.last_row_id
        }, 201);
      }

      const id = Number(new URL(request.url).searchParams.get("id"));

      if (!Number.isInteger(id) || id < 1) {
        return reply({ error: "معرّف المود غير صحيح" }, 400);
      }

      const result = await env.DB.prepare(
        `UPDATE mods
         SET name = ?, description = ?, image_url = ?,
             download_url = ?, file_size = ?
         WHERE id = ?`
      ).bind(
        name, description, image_url, download_url, file_size, id
      ).run();

      return reply({ success: true, changes: result.meta.changes });
    }

    const id = Number(new URL(request.url).searchParams.get("id"));

    if (!Number.isInteger(id) || id < 1) {
      return reply({ error: "معرّف المود غير صحيح" }, 400);
    }

    const result = await env.DB.prepare(
      "DELETE FROM mods WHERE id = ?"
    ).bind(id).run();

    return reply({ success: true, changes: result.meta.changes });
  } catch {
    return reply({ error: "حدث خطأ في الخادم" }, 500);
  }
}
