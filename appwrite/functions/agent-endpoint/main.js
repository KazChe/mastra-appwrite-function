// appwrite/functions/agent-endpoint/main.js
console.log("🟢 wrapper cold-start");

// Side-effect: importing spins up Mastra on localhost:4111
import "./.output/index.mjs";

export default async ({ req, res }) => {
  // Forward the HTTP call to Mastra’s internal listener
  const proxied = await fetch(`http://127.0.0.1:4111${req.path || "/"}`, {
    method: req.method,
    headers: req.headers,
    body: req.bodyRaw ?? undefined,
  });

  res.status = proxied.status;
  proxied.headers.forEach((v, k) => res.setHeader(k, v));

  if (proxied.body) for await (const chunk of proxied.body) res.write(chunk);
  res.end();
};