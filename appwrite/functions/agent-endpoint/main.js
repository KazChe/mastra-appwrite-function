// appwrite/functions/agent-endpoint/main.js
console.log("🟢 wrapper cold-start");

// 1. Import bundle (this starts the Hono server on :4111)
import "./.output/index.mjs";

// 2. Ping until the server responds (max 3 seconds)
const waitForServer = async () => {
  const max = Date.now() + 3000;
  while (Date.now() < max) {
    try {
      const r = await fetch("http://127.0.0.1:4111/health").catch(() => null);
      if (r?.ok) return;
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra server did not start in time");
};

export default async ({ req, res, log }) => {
  await waitForServer();

  const proxied = await fetch(`http://127.0.0.1:4111${req.path || "/"}`, {
    method: req.method,
    headers: req.headers,
    body: req.bodyRaw ?? undefined,
  });

  res.status = proxied.status;
  for (const [key, value] of proxied.headers.entries()) {
    res.headers[key] = value;
  }
  if (proxied.body) for await (const chunk of proxied.body) res.write(chunk);
  res.end();
};
