console.log("🟢 wrapper cold-start");

import "./.output/index.mjs"; // starts Hono on :4111

// ── wait ≤3 s for localhost:4111 to come up ───────────────
async function waitForServer() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch("http://127.0.0.1:4111/health");
      if (r.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra server did not start in time");
}

// unified header helper
function addHeader(res, k, v) {
  if (typeof res.setHeader === "function") res.setHeader(k, v);
  else {
    (res.headers ??= {})[k] = v;
  }
}

export default async ({ req, res, log }) => {
  await waitForServer();

  const upstream = await fetch(`http://127.0.0.1:4111${req.path || "/"}`, {
    method: req.method,
    headers: req.headers,
    body: req.bodyRaw ?? undefined,
  });

  res.status = upstream.status;
  upstream.headers.forEach((v, k) => addHeader(res, k, v));

  // CORS
  addHeader(res, "access-control-allow-origin", "*");
  addHeader(res, "access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  addHeader(res, "access-control-allow-headers", "Content-Type, Authorization");

  // ── body handling: stream if we can, else buffer ─────────
  if (typeof res.write === "function" && upstream.body) {
    for await (const chunk of upstream.body) res.write(chunk);
    return res.end();
  }

  // fallback: buffer then send
  const chunks = upstream.body ? Array.from(await upstream.arrayBuffer()) : [];
  return res.send(Buffer.from(chunks));
};