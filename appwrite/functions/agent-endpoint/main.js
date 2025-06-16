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

  return res.send(text);
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

//   // DEBUG: Log everything to see where your data is
//   log("=== FULL DEBUG ===");
//   log("context keys:", Object.keys(context));
//   log("context.req keys:", Object.keys(context.req || {}));
//   log("context.req.body:", context.req?.body);
//   log("context.req.bodyText:", context.req?.bodyText);
//   log("context.req.variables:", context.req?.variables);
//   log("context.payload:", context.payload);
//   log("context.data:", context.data);

//   // Check for data in different locations
//   let incoming;
//   let dataSource = "fallback";

//   // Method 1: context.req.body (what we tried)
//   if (context.req?.body) {
//     try {
//       const parsed = JSON.parse(context.req.body);
//       if (parsed.data) {
//         incoming = JSON.parse(parsed.data);
//         dataSource = "context.req.body.data";
//       } else if (parsed.messages) {
//         incoming = parsed;
//         dataSource = "context.req.body.messages";
//       }
//     } catch (e) {
//       log("Failed to parse context.req.body:", e.message);
//     }
//   }

//   // Method 2: Direct in context
//   if (!incoming && context.data) {
//     try {
//       incoming = typeof context.data === "string" ? JSON.parse(context.data) : context.data;
//       dataSource = "context.data";
//     } catch (e) {
//       log("Failed to parse context.data:", e.message);
//     }
//   }

//   // Method 3: Check if it's directly in context.req.variables
//   if (!incoming && context.req?.variables) {
//     try {
//       incoming = context.req.variables;
//       dataSource = "context.req.variables";
//     } catch (e) {
//       log("Failed to use context.req.variables:", e.message);
//     }
//   }

//   // Method 4: Fallback
//   if (!incoming) {
//     incoming = {
//       messages: [{ role: "user", content: "What's the weather in San Jose?" }],
//     };
//     dataSource = "fallback";
//   }

//   log(`🔸 Using data from ${dataSource}:`, JSON.stringify(incoming));

//   const body = JSON.stringify(incoming);

//   const upstream = await fetch("http://127.0.0.1:4111/api/agents/weatherAgent/generate", {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body,
//   });

//   const text = await upstream.text();

//   addHeader(res, "access-control-allow-origin", "*");
//   addHeader(res, "content-type", "application/json");

//   return res.send(text);
// };
