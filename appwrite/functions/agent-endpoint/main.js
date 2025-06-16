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
  throw new Error("Mastra didn't start");
}

const addHeader = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

export default async (context) => {
  const { req, res, log } = context;

  await waitForMastra();

  // Get data from the context directly - this is where Appwrite puts execution data
  let incoming;

  // Check if data was passed via executions API
  if (context.req && context.req.body) {
    try {
      incoming = JSON.parse(context.req.body);
    } catch {
      incoming = context.req.body;
    }
  } else if (context.payload) {
    incoming = context.payload;
  } else {
    // Default test data if no input
    incoming = {
      messages: [{ role: "user", content: "What's the weather in San Jose?" }],
    };
  }

  log("🔸 Using data:", JSON.stringify(incoming));

  const body = JSON.stringify(incoming);

  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  const text = await upstream.text();

  addHeader(res, "access-control-allow-origin", "*");
  addHeader(res, "content-type", "application/json");

  return res.send(text);
};
