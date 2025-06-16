/*  ───────────────────  Mastra weather wrapper  ─────────────────── */

console.log("🟢 wrapper cold-start");

// side-effect: boot Hono on :4111
import "./.output/index.mjs";

/* Wait ≤3 s until Mastra’s /health responds */
async function waitForMastra() {
  const deadline = Date.now() + 3000;
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

/* Header helper compatible with all Appwrite runtimes */
function addHeader(res, k, v) {
  if (typeof res.setHeader === "function") res.setHeader(k, v);
  else {
    (res.headers ??= {})[k] = v;
  }
}

/* Playground request template (taken verbatim, user message empty) */
const template = {
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
    { role: "user", content: "" }, // ← filled at runtime
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
        },
      },
    },
  ],
  tool_choice: "auto",
};

/* ───────────────────────────────────────────────────────── */

export default async ({ req, res, log }) => {
  await waitForMastra();

  /* Parse caller’s JSON body { "message": "…"} */
  let userText = "Hi 👋";
  try {
    if (req.bodyRaw?.trim().length) {
      userText = JSON.parse(req.bodyRaw).message ?? userText;
    }
  } catch {
    log("⚠️ bad JSON from caller; using default text");
  }

  /* Build payload for Mastra */
  const payload = { ...template, messages: [...template.messages] };
  payload.messages[1].content = userText; // inject user text
  const body = JSON.stringify(payload);

  /* Call the Weather-Agent */
  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

  /* Debug log – remove in production */
  const raw = await upstream.clone().text();
  log("🔸 upstream raw", raw);

  /* Copy status + headers */
  res.status = upstream.status;
  upstream.headers.forEach((v, k) => addHeader(res, k, v));
  addHeader(res, "access-control-allow-origin", "*");

  /* Relay body – stream when possible */
  if (upstream.body && typeof res.write === "function") {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    return res;
  }

  /* Fallback: buffer entire body */
  res.send(Buffer.from(raw));
  return res;
};
