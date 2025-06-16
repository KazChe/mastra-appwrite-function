// appwrite/functions/agent-endpoint/main.js

console.log("🟢 wrapper cold-start");
import "./.output/index.mjs"; // boots Mastra’s Hono on :4111

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

export default async ({ req, res, log }, context) => {
  await waitForMastra();

  // Debug dump of the incoming request
  // Recursively inspect req object up to depth 3
  const inspectObject = (obj, depth = 0, maxDepth = 10) => {
    if (depth >= maxDepth) return '[Max Depth Reached]';
    if (!obj || typeof obj !== 'object') return obj;
    
    const result = {};
    for (const key in obj) {
      try {
        const value = obj[key];
        result[key] = inspectObject(value, depth + 1, maxDepth);
      } catch (e) {
        result[key] = '[Inspection Error]';
      }
    }
    log("🔍 Full request inspection:", JSON.stringify(result, null, 2));
  };
  
  const reqInspected = inspectObject(req);
  log('🔍 Full request inspection:', JSON.stringify(reqInspected, null, 2));
  // const debugReq = {
  //   reqRaw: req,
  //   contextRaw: context,
  //   bodyRaw: req.bodyRaw,
  //   payload: req.payload,
  //   body: req.body,
  //   headers: req.headers,
  //   query: req.query,
  //   path: req.path,
  //   method: req.method,
  //   env: req.env,
  // };

  // log("🔸🔸🔸 full req dump", JSON.stringify(debugReq, null, 2));

  // 1) Grab the raw JSON body from req.payload
  const raw = typeof req.payload === "string" ? req.payload.trim() : "";

  // 2) Validate
  let incoming;
  try {
    incoming = JSON.parse(raw);
  } catch {
    res.status = 400;
    return res.send("Error: invalid JSON");
  }
  if (!Array.isArray(incoming.messages)) {
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
