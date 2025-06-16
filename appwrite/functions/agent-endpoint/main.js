// appwrite/functions/agent-endpoint/main.js
console.log("🟢 wrapper cold-start");

import "./.output/index.mjs"; // boots Mastra’s Hono on :4111

/* wait until Mastra replies on /health (≤ 3 s) */
async function wait() {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    try {
      if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra server did not start");
}

/* add header helper (works on all runtimes) */
const add = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

export default async ({ req, res, log }) => {
  await wait();

  /* caller may send { "message": "..." } or full messages[]; support both */
  // let body;
  // try {
  //   if (req.bodyRaw?.trim()) {
  //     const parsed = JSON.parse(req.bodyRaw);
  //     body = Array.isArray(parsed.messages)
  //       ? req.bodyRaw // caller sent full schema
  //       : JSON.stringify({ messages: [{ role: "user", content: parsed.message }] });
  //   }
  // } catch {
  //   /* bad JSON – ignore */
  // }

  // if (!body) {
  //   body = JSON.stringify({
  //     messages: [{ role: "user", content: "Hi! (no message provided)" }],
  //   });
  // }
  const body =
    req.bodyRaw && req.bodyRaw.trim().length
      ? req.bodyRaw
      : JSON.stringify({ messages: [{ role: "user", content: "Hi! (no body)" }] });

 log("🔸🔸🔸 wrapper sending body", body);

  /* call the Weather-Agent — NO tools, NO model, Mastra adds those */
  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  /* debug – view raw reply in Logs; remove when satisfied */
  const raw = await upstream.clone().text();
  log("🔸 upstream raw", raw);

  /* relay status + headers + body */
  res.status = upstream.status;
  upstream.headers.forEach((v, k) => add(res, k, v));
  add(res, "access-control-allow-origin", "*");

  if (upstream.body && typeof res.write === "function") {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    return res; // explicit return (stream path)
  }

  res.send(Buffer.from(raw));
  return res; // explicit return (buffer path)
};
