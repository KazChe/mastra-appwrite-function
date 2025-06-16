// appwrite/functions/agent-endpoint/main.js
console.log("🟢 wrapper cold-start");
import "./.output/index.mjs";

async function waitForMastra() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra didn’t start");
}

const addHeader = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

export default async ({ req, res, log }) => {
  await waitForMastra();

  // ← HERE: check both req.bodyRaw *and* req.payload
  let raw = "";
  if (typeof req.bodyRaw === "string" && req.bodyRaw.trim()) {
    raw = req.bodyRaw.trim();
  } else if (typeof req.payload === "string" && req.payload.trim()) {
    raw = req.payload.trim();
  }

  // If still empty, error out
  if (!raw) {
    res.status = 400;
    return res.send("Error: request body is required");
  }

  // Forward exactly what the client sent
  const body = raw;
  log("🔸 wrapper sending body", body);

  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  const text = await upstream.clone().text();
  log("🔸 upstream raw", text);

  res.status = upstream.status;
  upstream.headers.forEach((v, k) => addHeader(res, k, v));
  addHeader(res, "access-control-allow-origin", "*");

  if (upstream.body && typeof res.write === "function") {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    return res;
  }

  res.send(Buffer.from(text));
  return res;
};