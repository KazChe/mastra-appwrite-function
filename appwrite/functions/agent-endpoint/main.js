console.log("🟢 wrapper cold-start");

// start Hono on :4111
import "./.output/index.mjs";

// wait ≤3 s for Mastra server
const waitForServer = async () => {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    try {
      const r = await fetch("http://127.0.0.1:4111/health");
      if (r.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra server did not start");
};

// add header helper (works on every Appwrite runtime)
const add = (res, k, v) => {
  if (typeof res.setHeader === "function") res.setHeader(k, v);
  else {
    (res.headers ??= {})[k] = v;
  }
};

export default async ({ req, res, log }) => {
  await waitForServer();

  const upstream = await fetch(`http://127.0.0.1:4111${req.path || "/"}`, {
    method: req.method,
    headers: req.headers,
    body: req.bodyRaw ?? undefined,
  });

  res.status = upstream.status;
  upstream.headers.forEach((v, k) => add(res, k, v));

  // CORS for browsers
  add(res, "access-control-allow-origin", "*");
  add(res, "access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  add(res, "access-control-allow-headers", "Content-Type, Authorization");

  /* ---------- body relay ---------- */
  if (upstream.body && typeof res.write === "function") {
    // stream when possible
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
  } else {
    // fallback: buffer then send
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  }

  // optional debug – remove later
  log("🔸 proxied", { status: upstream.status, bytes: res.headers?.["content-length"] });
};
