console.log("🟢 wrapper cold-start");
import "./.output/index.mjs"; // starts Hono on :4111

// wait until the health probe is up
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

// header helper
const add = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

export default async ({ req, res, log }) => {
  await wait();

  /* -------- call the agent -------- */
  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body:
      req.bodyRaw ??
      JSON.stringify({
        messages: [
          {
            role: "user",
            content: "What's the weather?",
          },
        ],
      }),
  });

  const text = await upstream.text(); // ALWAYS read it as text
  log("🔸 upstream raw", text); // will appear in Logs pane

  /* -------- send it back -------- */
  res.status = upstream.status;
  add(res, "content-type", "application/json");
  add(res, "access-control-allow-origin", "*");
  return res.send(text); // buffer then send
};
