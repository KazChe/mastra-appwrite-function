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

  log("=== COMPLETE REQUEST DEBUG ===");

  // Log everything possible
  log("typeof req:", typeof req);
  log("req keys:", Object.keys(req || {}));

  // Check all possible properties
  const reqProps = [
    "variables",
    "body",
    "bodyText",
    "bodyJson",
    "bodyRaw",
    "bodyBinary",
    "payload",
    "data",
    "query",
    "params",
    "headers",
    "method",
    "url",
  ];

  reqProps.forEach((prop) => {
    if (req.hasOwnProperty(prop)) {
      log(`req.${prop}:`, req[prop]);
    } else {
      log(`req.${prop}: [UNDEFINED]`);
    }
  });

  // Check context
  log("typeof context:", typeof context);
  log("context keys:", Object.keys(context || {}));
  log("context:", context);

  // Try to access data through context
  if (context && context.req) {
    log("context.req:", context.req);
  }

  // Check for any data property
  if (req.data) {
    log("Found req.data:", req.data);
  }

  // Check entire req object structure
  log("Full req object:", JSON.stringify(req, null, 2));

  return res.json({
    debug: "Check logs for complete request inspection",
    reqKeys: Object.keys(req || {}),
    contextKeys: Object.keys(context || {}),
    hasVariables: !!req.variables,
    hasBody: !!req.body,
    hasBodyText: !!req.bodyText,
    hasData: !!req.data,
  });
};
