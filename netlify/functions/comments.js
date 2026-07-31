import { getStore } from '@netlify/blobs';

const MAX_COMMENTS = 500;
const MAX_NAME_LEN = 60;
const MAX_TEXT_LEN = 1000;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default async (req) => {
  const store = getStore('comments');

  if (req.method === 'GET') {
    const data = (await store.get('list', { type: 'json' })) || [];
    return json(data);
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    // Honeypot field: real users never fill this in.
    if (typeof body.website === 'string' && body.website.trim()) {
      return json({ ok: true }, 201);
    }

    const name = (body.name || '').toString().trim().slice(0, MAX_NAME_LEN) || 'Anonymous';
    const text = (body.text || '').toString().trim().slice(0, MAX_TEXT_LEN);

    if (!text) {
      return json({ error: 'Comment text is required' }, 400);
    }

    const data = (await store.get('list', { type: 'json' })) || [];
    const comment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      text,
      createdAt: new Date().toISOString(),
    };
    data.push(comment);
    while (data.length > MAX_COMMENTS) data.shift();
    await store.setJSON('list', data);

    return json(comment, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
};
