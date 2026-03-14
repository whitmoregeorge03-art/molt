function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
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
    return json({ ok: false, error: "Admin list is not configured." }, 500);
  }

  const url = new URL(request.url);
  const providedToken = getTokenFromRequest(request, url);

  if (!providedToken || providedToken !== env.MOLT_EXPORT_TOKEN) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "200", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(5000, requestedLimit))
    : 200;

  const [rowsResult, countResult] = await Promise.all([
    env.MOLT_DB.prepare(
      "SELECT id, email, source, created_at FROM waitlist ORDER BY id DESC LIMIT ?"
    ).bind(limit).all(),
    env.MOLT_DB.prepare("SELECT COUNT(*) AS total FROM waitlist").all()
  ]);

  const rows = rowsResult?.results || [];
  const total = Number(countResult?.results?.[0]?.total || 0);

  return json({
    ok: true,
    total,
    returned: rows.length,
    rows
  });
}
