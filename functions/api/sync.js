// GET/PUT /api/sync — เก็บ blob ที่เข้ารหัสแล้วจากเครื่องผู้ใช้ 1 ก้อนต่อรหัส sync (KV binding: SYNC)
// server ไม่เห็นรหัส sync และอ่านข้อมูลไม่ได้ — header X-Sync-Id คือ SHA-256 ของรหัส
// ponytail: ไม่มี rate limit; ถ้ามีคนยิง PUT รัวๆ จะกินโควต้า KV ฟรี (1,000 writes/วัน) — เพิ่ม Rate Limiting rule เมื่อเจอ
const ID_RE = /^[0-9a-f]{64}$/;
const MAX_BYTES = 1024 * 1024;

export async function onRequest({ request, env }) {
  const id = request.headers.get('x-sync-id') || '';
  if (!ID_RE.test(id)) return new Response('bad sync id', { status: 400 });

  if (request.method === 'GET') {
    const blob = await env.SYNC.get(id);
    if (blob == null) return new Response('not found', { status: 404 });
    return new Response(blob, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }

  if (request.method === 'PUT') {
    if (Number(request.headers.get('content-length')) > MAX_BYTES) return new Response('too large', { status: 413 });
    const body = await request.text();
    if (body.length > MAX_BYTES) return new Response('too large', { status: 413 });
    try {
      const { v, iv, ct } = JSON.parse(body);
      if (v !== 1 || typeof iv !== 'string' || typeof ct !== 'string') throw 0;
    } catch {
      return new Response('bad body', { status: 400 });
    }
    await env.SYNC.put(id, body);
    return new Response(null, { status: 204 });
  }

  return new Response('method not allowed', { status: 405, headers: { allow: 'GET, PUT' } });
}
