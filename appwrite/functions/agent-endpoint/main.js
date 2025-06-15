// appwrite/functions/agent-endpoint/index.js
import { Client, Users } from 'node-appwrite';
import { app } from './.output/index.mjs'; // ESM import is fine

export default async ({ req, res, log, error }) => {
  // --- (optional) example call to Appwrite Users service -------------
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const users = new Users(client);
  try {
    log(`Total users: ${(await users.list()).total}`);
  } catch (err) {
    error(`Could not list users: ${err.message}`);
  }

  // --- pass the request straight to the Mastra (Hono) server ----------
  const honoReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.bodyRaw ?? undefined,
  });
  const honoRes = await app.fetch(honoReq);

  res.status = honoRes.status;
  honoRes.headers.forEach((v, k) => res.setHeader(k, v));

  if (honoRes.body) {
    const reader = honoRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value); // supports streaming
    }
  }
  return res.end(); // always return
};
