import { getStore } from '@netlify/blobs';

const QUERY = 'hemp legislation OR hemp ban Texas';
const FEED_URL = `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=en-US&gl=US&ceid=US:en`;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 12;

function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseRss(xml) {
  const items = [];
  const blocks = xml.split('<item>').slice(1);
  for (const block of blocks.slice(0, MAX_ITEMS)) {
    const titleMatch = block.match(/<title>(.*?)<\/title>/s);
    const linkMatch = block.match(/<link>(.*?)<\/link>/s);
    const dateMatch = block.match(/<pubDate>(.*?)<\/pubDate>/s);
    const sourceMatch = block.match(/<source[^>]*>(.*?)<\/source>/s);
    if (titleMatch && linkMatch) {
      items.push({
        title: decodeEntities(titleMatch[1]),
        link: decodeEntities(linkMatch[1]),
        pubDate: dateMatch ? decodeEntities(dateMatch[1]) : null,
        source: sourceMatch ? decodeEntities(sourceMatch[1]) : null,
      });
    }
  }
  return items;
}

function json(payload) {
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

export default async () => {
  const store = getStore('news-cache');
  const cached = await store.get('latest', { type: 'json' });

  if (cached && Date.now() - cached.fetchedAt < ONE_DAY_MS) {
    return json(cached);
  }

  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CitizensBlueprintBot/1.0)' },
    });
    if (!res.ok) throw new Error(`Feed returned ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml);
    const payload = { items, fetchedAt: Date.now(), query: QUERY };
    await store.setJSON('latest', payload);
    return json(payload);
  } catch (err) {
    if (cached) return json(cached);
    return json({ items: [], fetchedAt: Date.now(), query: QUERY, error: 'unavailable' });
  }
};
