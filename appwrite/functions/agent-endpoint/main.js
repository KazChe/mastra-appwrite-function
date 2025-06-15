// appwrite/functions/agent-endpoint/main.js
console.log("🟢 wrapper cold-start");

import "./.output/index.mjs"; // boots Mastra on :4111

/* ── wait until Mastra’s /health endpoint responds ───────────────────── */
async function waitForMastra() {
  const deadline = Date.now() + 3000; // 3 s max
  while (Date.now() < deadline) {
    try {
      if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra server did not start");
}

/* header helper (Edge & Node runtimes) */
function addHeader(res, k, v) {
  if (typeof res.setHeader === "function") res.setHeader(k, v);
  else {
    (res.headers ??= {})[k] = v;
  }
}

export default async ({ req, res, log }) => {
  await waitForMastra();

  /* build payload for Mastra agent ------------------------------------ */
  let userMessage = "Hi 👋";
  try {
    if (req.bodyRaw) userMessage = JSON.parse(req.bodyRaw).message ?? userMessage;
  } catch {
    log("⚠️ bad JSON from caller; using default message");
  }

  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  /* ── DEBUG: log full upstream text (remove in production) ──────────── */
  const rawText = await upstream.clone().text(); // clone so body is still readable
  log("🔸 upstream raw", rawText);

  /* copy status & headers --------------------------------------------- */
  res.status = upstream.status;
  upstream.headers.forEach((v, k) => addHeader(res, k, v));

  addHeader(res, "access-control-allow-origin", "*");
  addHeader(res, "access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  addHeader(res, "access-control-allow-headers", "Content-Type, Authorization");

  /* relay body (stream if possible) ----------------------------------- */
  if (upstream.body && typeof res.write === "function") {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    return res; // explicit return (stream path)
  }

  // fallback: buffered send
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
  return res; // explicit return (buffer path)
};