console.log("🟢 wrapper cold-start");
import "./.output/index.mjs"; // boots Hono on 4111

const add = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

async function wait() {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    try {
      if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Mastra failed to start");
}

export default async ({ req, res, log }) => {
  await wait();

  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: req.bodyRaw ?? JSON.stringify({ message: "Hi" }),
  });

  res.status = upstream.status;
  upstream.headers.forEach((v, k) => add(res, k, v));
  add(res, "access-control-allow-origin", "*");

  if (upstream.body && typeof res.write === "function") {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end();
    return res;
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
  return res;
};