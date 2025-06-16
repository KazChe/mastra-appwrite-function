console.log('🟢 wrapper cold-start');
import './.output/index.mjs';                                    // boots Mastra

async function wait() {
  const end = Date.now() + 3000;
  while (Date.now() < end) {
    try { if ((await fetch('http://127.0.0.1:4111/health')).ok) return; }
    catch {}
    await new Promise(r => setTimeout(r,150));
  }
  throw new Error('Mastra server did not start');
}

const add = (r,k,v)=>typeof r.setHeader==='function'
  ? r.setHeader(k,v)
  : (r.headers ??= {})[k]=v;

export default async ({ req, res, log }) => {
  await wait();

  const body = req.bodyRaw && req.bodyRaw.trim().length
    ? req.bodyRaw
    : JSON.stringify({
        messages:[{ role:'user', content:'Hi 👋 (no body supplied)' }]
      });

  const upstream = await fetch(
    'http://127.0.0.1:4111/api/agents/weatherAgent/generate',
    { method:'POST', headers:{ 'content-type':'application/json' }, body }
  );

  const rawText = await upstream.clone().text();    // DEBUG
  log('🔸 upstream raw', rawText);                  // remove when happy

  res.status = upstream.status;
  upstream.headers.forEach((v,k)=>add(res,k,v));
  add(res,'access-control-allow-origin','*');

  if (upstream.body && typeof res.write==='function') {
    for await (const chunk of upstream.body) res.write(chunk);
    res.end(); return res;
  }

  res.send(Buffer.from(rawText));
  return res;
};