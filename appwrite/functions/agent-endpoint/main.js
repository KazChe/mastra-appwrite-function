// appwrite/functions/agent-endpoint/main.js
console.log("🟢 wrapper cold-start");

import "./.output/index.mjs"; // boots Mastra on :4111

async function waitForMastra() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra didn’t start in time");
}

const addHeader = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

export default async ({ req, res, log }) => {
  await waitForMastra();

  // ◉ SIMPLE BODY LOGIC: forward whatever the caller sent,
  //   or fall back to a single user message array
  const body = req.bodyRaw?.trim().length
    ? req.bodyRaw
    : JSON.stringify({
        messages: [{ role: "user", content: "San Jose, California" }],
      });

  log("🔸 wrapper sending body", body);

  // call the Mastra Weather-Agent
  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  const raw = await upstream.clone().text();
  log("🔸 upstream raw", raw);

  // relay status + headers + CORS
  res.status = upstream.status;
  upstream.headers.forEach((v, k) => addHeader(res, k, v));
  addHeader(res, "access-control-allow-origin", "*");

  // stream if possible, else buffer
  if (upstream.body && typeof res.write === "function") {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    return res;
  }

  res.send(Buffer.from(raw));
  return res;
};