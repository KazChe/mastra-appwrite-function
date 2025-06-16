// appwrite/functions/agent-endpoint/main.js
console.log("🟢 wrapper cold-start");
import "./.output/index.mjs"; // boots Mastra on :4111

/* ── wait until Mastra’s /health endpoint is alive (≤3 s) ─────────── */
async function wait() {
  const stop = Date.now() + 3000;
  while (Date.now() < stop) {
    try {
      if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra server did not start");
}

/* header helper (Edge & Node runtimes) */
const add = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

/* playground-perfect template */
function buildPayload(userText) {
  return {
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
        You are a helpful weather assistant that provides accurate weather information.

        Your primary function is to help users get weather details for specific locations.
        - Always ask for a location if none is provided
        - If the location name isn’t in English, translate it
        - Include humidity, wind, precipitation
        - Keep responses concise
        Use the weatherTool to fetch current weather.`,
      },
      { role: "user", content: userText },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "weatherTool",
          description: "Get current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name" },
            },
            required: ["location"],
            additionalProperties: false,
            $schema: "http://json-schema.org/draft-07/schema#",
          },
        },
      },
    ],
    tool_choice: "auto",
  };
}

/* ─────────────────────────────────────────────────────────────────── */

export default async ({ req, res, log }) => {
  await wait();

  /* pull caller’s text (expects { "message": "…"} ) */
  let userText = "Hi! (no message provided)";
  try {
    if (req.bodyRaw?.trim().length) {
      userText = JSON.parse(req.bodyRaw).message ?? userText;
    }
  } catch {
    log("⚠️ bad JSON from caller; using default text");
  }

  const body = JSON.stringify(buildPayload(userText));

  /* call the Weather-Agent */
  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  /* DEBUG – see full reply in Logs; remove when happy */
  const raw = await upstream.clone().text();
  log("🔸 upstream raw", raw);

  /* relay status + headers + body */
  res.status = upstream.status;
  upstream.headers.forEach((v, k) => add(res, k, v));
  add(res, "access-control-allow-origin", "*");

  if (upstream.body && typeof res.write === "function") {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    return res;
  }

  res.send(Buffer.from(raw));
  return res;
};