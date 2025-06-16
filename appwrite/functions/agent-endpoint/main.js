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
  log("req.method:", req.method);

  // Add more debug info
  log("typeof req.body:", typeof req.body);
  log("req.body length:", req.body?.length || 0);

  // Check for bodyJson with error handling
  let bodyJson = null;
  try {
    bodyJson = req.bodyJson;
    log("req.bodyJson:", bodyJson);
  } catch (e) {
    log("req.bodyJson error:", e.message);
  }

  // 1) Get the raw JSON body from the correct source
  let raw = "";
  let dataSource = "none";

  // Check if called via executions API (data in req.variables.data)
  if (req.variables && req.variables.data) {
    raw = req.variables.data;
    dataSource = "req.variables.data";
    log("🔸 Got data from req.variables.data:", raw);
  }
  // Check bodyJson first (most reliable for JSON)
  else if (bodyJson && typeof bodyJson === "object") {
    raw = JSON.stringify(bodyJson);
    dataSource = "req.bodyJson";
    log("🔸 Got data from req.bodyJson:", raw);
  }
  // Check if called via direct HTTP (data in req.bodyText or req.body)
  else if (req.bodyText && req.bodyText.trim()) {
    raw = req.bodyText.trim();
    dataSource = "req.bodyText";
    log("🔸 Got data from req.bodyText:", raw);
  } else if (req.body && req.body.trim && req.body.trim()) {
    raw = req.body.trim();
    dataSource = "req.body";
    log("🔸 Got data from req.body:", raw);
  } else {
    log("❌ No request data found in any source");
    log("❌ Available data:", {
      variables: req.variables,
      body: req.body,
      bodyText: req.bodyText,
      bodyJson: bodyJson,
      headers: req.headers,
    });

    // Return debug info instead of error for now
    return res.json({
      error: "No request data found",
      debug: {
        variables: req.variables,
        body: req.body,
        bodyText: req.bodyText,
        bodyJson: bodyJson,
        headers: req.headers,
        method: req.method,
      },
    });
  }

  log(`🔸 Data source: ${dataSource}`);

  // 2) Validate
  let incoming;
  try {
    incoming = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (parseError) {
    log("❌ JSON parse error:", parseError.message);
    log("❌ Raw data was:", raw);
    log("❌ Data source was:", dataSource);
    return res.json({
      error: "Invalid JSON",
      details: parseError.message,
      rawData: raw,
      dataSource: dataSource,
    });
  }

  if (!incoming || !Array.isArray(incoming.messages)) {
    log("❌ Invalid messages format:", incoming);
    return res.json({
      error: "Expected { messages: [...] }",
      received: incoming,
      dataSource: dataSource,
    });
  }

  // 3) Forward it
  const body = JSON.stringify(incoming);
  log("🔸 wrapper sending body", body);

  try {
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
  } catch (fetchError) {
    log("❌ Upstream fetch error:", fetchError.message);
    return res.json({
      error: "Upstream service error",
      details: fetchError.message,
    });
  }
};
