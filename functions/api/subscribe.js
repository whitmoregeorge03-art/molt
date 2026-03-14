const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function sanitizeSource(value) {
  if (!value || typeof value !== "string") return "the-molt.com";
  return value.slice(0, 120).replace(/[^a-zA-Z0-9.-]/g, "");
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.MOLT_DB) {
    return json({ ok: false, error: "Waitlist database is not configured yet." }, 500);
  }

  let payload = {};

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const data = await request.formData();
      payload.email = data.get("email");
      payload.source = data.get("source");
    }
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const source = sanitizeSource(payload.source);

  if (!EMAIL_REGEX.test(email)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  try {
    await env.MOLT_DB.prepare(
      "INSERT INTO waitlist (email, source) VALUES (?, ?)"
    )
      .bind(email, source)
      .run();

    return json({ ok: true, duplicate: false });
  } catch (error) {
    const message = String(error?.message || "");

    // Allow idempotent signups (same email submitted multiple times)
    if (message.includes("UNIQUE constraint failed") || message.includes("SQLITE_CONSTRAINT")) {
      return json({ ok: true, duplicate: true });
    }

    return json({ ok: false, error: "Could not save your email right now." }, 500);
  }
}
