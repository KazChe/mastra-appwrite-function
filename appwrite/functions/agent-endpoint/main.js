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

  let incoming;

  // Get data from executions API (using "body" field)
  if (context.req?.body && context.req.body.trim()) {
    try {
      incoming = JSON.parse(context.req.body);
      log("🔸 Using request data:", JSON.stringify(incoming));
    } catch (e) {
      log("❌ Failed to parse body:", e.message);
      incoming = { messages: [{ role: "user", content: "What's the weather in San Jose?" }] };
    }
  } else {
    // Fallback
    incoming = { messages: [{ role: "user", content: "What's the weather in San Jose?" }] };
    log("🔸 Using fallback data");
  }

  const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(incoming),
  });

  const text = await upstream.text();

  addHeader(res, "access-control-allow-origin", "*");
  addHeader(res, "content-type", "application/json");

  /*
  * Depreciation notice
  * use req.bodyText instead of req.bodyRaw. Use res.text instead of res.send. 
  * Use req.bodyText or req.bodyJson instead of req.body depending on the expected input data type.
  */
  return res.text(text);
};
// // appwrite/functions/agent-endpoint/main.js

// console.log("🟢 wrapper cold-start");
// import "./.output/index.mjs";

// async function waitForMastra() {
//   const deadline = Date.now() + 3000;
//   while (Date.now() < deadline) {
//     try {
//       if ((await fetch("http://127.0.0.1:4111/health")).ok) return;
//     } catch {}
//     await new Promise((r) => setTimeout(r, 150));
//   }
//   throw new Error("Mastra didn't start");
// }

// const addHeader = (res, k, v) => (typeof res.setHeader === "function" ? res.setHeader(k, v) : ((res.headers ??= {})[k] = v));

// export default async (context) => {
//   const { req, res, log } = context;

//   await waitForMastra();

//   let incoming;

//   // Get data from executions API (using "body" field)
//   if (context.req?.body && context.req.body.trim()) {
//     try {
//       incoming = JSON.parse(context.req.body);
//       log("🔸 Using request data:", JSON.stringify(incoming));
//     } catch (e) {
//       log("❌ Failed to parse body:", e.message);
//       incoming = { messages: [{ role: "user", content: "What's the weather in San Jose?" }] };
//     }
//   } else {
//     // Fallback
//     incoming = { messages: [{ role: "user", content: "What's the weather in San Jose?" }] };
//     log("🔸 Using fallback data");
//   }

//   const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body: JSON.stringify(incoming),
//   });

//   const text = await upstream.text();

//   addHeader(res, "access-control-allow-origin", "*");
//   addHeader(res, "content-type", "application/json");
//   /*
//   * Depreciation notice
//   * Use req.bodyText instead of req.bodyRaw.
//   * Use res.text instead of res.send.
//   * Use req.bodyText or req.bodyJson instead of req.body depending on the expected input data type.
//   */
//   return res.text(text);
// };
