// appwrite/functions/agent-endpoint/main.js

console.log("🟢 wrapper cold-start");
import "./.output/index.mjs"; // boots Mastra's Hono on :4111

async function waitForMastra() {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra didn't start");
}

const addHeader = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

export default async ({ req, res, log }, context) => {
  await waitForMastra();

  log("=== DEBUGGING REQUEST ===");
  log("req.variables:", req.variables);
  log("req.body:", req.body);
  log("req.bodyText:", req.bodyText);
  log("req.headers:", req.headers);

  // 1) Get the raw JSON body from the correct source
  let raw = "";

  // Check if called via executions API (data in req.variables.data)
  if (req.variables && req.variables.data) {
    raw = req.variables.data;
    log("🔸 Got data from req.variables.data:", raw);
  }
  // Check if called via direct HTTP (data in req.bodyText or req.body)
  else if (req.bodyText) {
    raw = req.bodyText;
    log("🔸 Got data from req.bodyText:", raw);
  } else if (req.body) {
    raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    log("🔸 Got data from req.body:", raw);
  } else {
    log("❌ No request data found");
    res.status = 400;
    return res.send("Error: No request data found");
  }

  // 2) Validate
  let incoming;
  try {
    incoming = typeof raw === "string" ? JSON.parse(raw.trim()) : raw;
  } catch (parseError) {
    log("❌ JSON parse error:", parseError.message);
    log("❌ Raw data was:", raw);
    res.status = 400;
    return res.send("Error: invalid JSON");
  }

  if (!Array.isArray(incoming.messages)) {
    log("❌ Invalid messages format:", incoming);
    res.status = 400;
    return res.send('Error: expected { "messages": [ ... ] }');
  }

  // 3) Forward it
  const body = JSON.stringify(incoming);
  log("🔸 wrapper sending body", body);

  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  // 4) Log & relay
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
