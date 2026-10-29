
export async function onRequest({ request, env }) {
  const cors = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password"
  };

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: cors });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM mods ORDER BY id DESC"
      ).all();

      return json(results);
    }

    if (request.method === "POST") {
      if (!env.ADMIN_PASSWORD) {
        return json({ error: "Admin password is not configured" }, 503);
      }

      const password = request.headers.get("X-Admin-Password");

      if (password !== env.ADMIN_PASSWORD) {
        return json({ error: "Unauthorized" }, 401);
      }

      const body = await request.json();
      const name = String(body.name || "").trim();
      const description = String(body.description || "");
      const image_url = String(body.image_url || "");
      const download_url = String(body.download_url || "").trim();
      const file_size = String(body.file_size || "");

      if (!name || !download_url) {
        return json({ error: "Name and download link are required" }, 400);
      }

      const result = await env.DB.prepare(
        `INSERT INTO mods (name, description, image_url, download_url, file_size)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(name, description, image_url, download_url, file_size).run();

      return json({ success: true, id: result.meta.last_row_id }, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return json({ error: "Server error" }, 500);
  }
}
