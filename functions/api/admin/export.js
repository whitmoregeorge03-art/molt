function unauthorized() {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getTokenFromRequest(request, url) {
  const fromHeader = request.headers.get("x-admin-token") || "";

  const auth = request.headers.get("authorization") || "";
  const fromBearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  const fromQuery = url.searchParams.get("token") || "";

  return fromHeader || fromBearer || fromQuery;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.MOLT_DB || !env.MOLT_EXPORT_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "Export is not configured." }), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  const url = new URL(request.url);
  const providedToken = getTokenFromRequest(request, url);

  if (!providedToken || providedToken !== env.MOLT_EXPORT_TOKEN) {
    return unauthorized();
  }

  const result = await env.MOLT_DB.prepare(
    "SELECT id, email, source, created_at FROM waitlist ORDER BY id DESC"
  ).all();

  const rows = result?.results || [];
  const header = "id,email,source,created_at";
  const body = rows
    .map((row) => [
      csvEscape(row.id),
      csvEscape(row.email),
      csvEscape(row.source),
      csvEscape(row.created_at)
    ].join(","))
    .join("\n");

  const csv = `${header}${body ? "\n" + body : ""}`;

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="molt-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store"
    }
  });
}
