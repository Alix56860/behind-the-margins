// /api/reviews : star ratings and comments for each episode.
//   GET                      -> all reviews (newest first)
//   POST {ep,stars,text,name,client} -> add or update this visitor's review of an episode
//   DELETE ?id=...  (header x-admin-key) -> remove a review (used by /admin.html)
import { getStore } from "@netlify/blobs";

const EPISODE_ID = /^ep\d{1,3}$/;
const MAX_REVIEWS = 5000;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const clean = (s, max) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

// Words that are never allowed in a public comment on a student site.
const BLOCKED = /\b(fuck\w*|shit\w*|bitch\w*|cunt\w*|nigg\w*|fag\w*|whore\w*|slut\w*|dick\w*|porn\w*|viagra|casino|crypto\s*giveaway)\b/i;

const publicView = (list, client) =>
  list.map(({ client: c, ip, ...r }) => (client && c === client ? { ...r, mine: client } : r))
      .sort((a, b) => b.at - a.at);

export default async (req, context) => {
  const store = getStore({ name: "reviews", consistency: "strong" });
  const url = new URL(req.url);
  let list = (await store.get("all", { type: "json" })) || [];

  if (req.method === "GET") return json({ reviews: publicView(list, url.searchParams.get("client")) });

  if (req.method === "POST") {
    let b; try { b = await req.json(); } catch { return json({ error: "That didn’t go through. Please try again." }, 400); }
    if (b.website) return json({ reviews: publicView(list) }); // honeypot: silently ignore bots
    const ep = clean(b.ep, 8), client = clean(b.client, 64);
    const stars = Math.max(0, Math.min(5, Math.round(+b.stars || 0)));
    const text = clean(b.text, 1500), name = clean(b.name, 60);
    if (!EPISODE_ID.test(ep) || !client) return json({ error: "That didn’t go through. Please refresh the page and try again." }, 400);
    if (!stars && !text) return json({ error: "Pick a star rating or write a comment first." }, 400);
    if (BLOCKED.test(text) || BLOCKED.test(name)) return json({ error: "Please keep comments friendly and suitable for students." }, 400);
    if ((text.match(/https?:\/\//g) || []).length > 1) return json({ error: "Please don’t include links in your comment." }, 400);

    const ip = context.ip || "";
    const hourAgo = Date.now() - 3600e3;
    if (list.filter((r) => r.ip === ip && r.at > hourAgo).length >= 10) return json({ error: "You’ve posted a lot in the last hour. Please try again later." }, 429);

    const i = list.findIndex((r) => r.ep === ep && r.client === client);
    const rec = { id: i >= 0 ? list[i].id : crypto.randomUUID(), ep, stars, text, name, at: Date.now(), client, ip };
    if (i >= 0) list[i] = rec; else list.push(rec);
    if (list.length > MAX_REVIEWS) list = list.slice(-MAX_REVIEWS);
    await store.setJSON("all", list);
    return json({ reviews: publicView(list, client) });
  }

  if (req.method === "DELETE") {
    const key = process.env.ADMIN_KEY;
    if (!key || req.headers.get("x-admin-key") !== key) return json({ error: "Wrong admin key." }, 401);
    const id = url.searchParams.get("id");
    const before = list.length;
    list = list.filter((r) => r.id !== id);
    if (list.length !== before) await store.setJSON("all", list);
    return json({ removed: before - list.length, reviews: publicView(list) });
  }

  return json({ error: "Not allowed" }, 405);
};

export const config = { path: "/api/reviews" };
