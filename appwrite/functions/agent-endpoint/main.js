// appwrite/functions/agent-endpoint/main.js
import * as mod from "./.output/index.mjs"; // import the module object

// Resolve the Hono app whichever way it was exported
const honoApp =
  mod.app ??
  mod.default ??
  mod;

export default async ({ req, res }) => {
  const honoReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.bodyRaw ?? undefined,
  });

  const honoRes = await honoApp.fetch(honoReq); // works for all three cases

  res.status = honoRes.status;
  honoRes.headers.forEach((v, k) => res.setHeader(k, v));

  if (honoRes.body) {
    const reader = honoRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value); // supports streaming tokens
    }
  }
  return res.end();
};
