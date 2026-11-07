// GET /api/feed : reads the podcast's RSS feed and returns the episodes as JSON.
// The site uses it to show new episodes, release dates, lengths, Spotify links,
// descriptions and an audio player, without anyone editing the page.
const RSS_URL = "https://anchor.fm/s/1196ef450/podcast/rss";

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&amp;/g, "&");

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]).trim() : "";
};

const paragraphs = (html) => {
  if (!html) return [];
  const text = html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/\r/g, "");
  return decode(text).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
};

export default async () => {
  try {
    const res = await fetch(RSS_URL, { headers: { "User-Agent": "BehindTheMarginsSite/1.0" } });
    if (!res.ok) throw new Error("feed " + res.status);
    const xml = await res.text();
    const channel = xml.split("<item")[0];
    const showLink = tag(channel, "link");
    const episodes = [];
    for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
      const it = m[0];
      const title = tag(it, "title");
      let n = tag(it, "itunes:episode");
      if (!/^\d+$/.test(n)) { const t = title.match(/episode\s*(\d+)/i); n = t ? t[1] : ""; }
      if (!n) continue;
      const pub = new Date(tag(it, "pubDate"));
      const enc = it.match(/<enclosure[^>]*\surl="([^"]+)"/i);
      episodes.push({
        n: +n,
        title,
        date: isNaN(pub) ? "" : pub.toISOString().slice(0, 10),
        duration: tag(it, "itunes:duration"),
        link: tag(it, "link"),
        audio: enc ? decode(enc[1]) : "",
        summary: paragraphs(tag(it, "description")),
      });
    }
    episodes.sort((a, b) => a.n - b.n);
    return new Response(JSON.stringify({ show: { link: showLink }, episodes }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Netlify-CDN-Cache-Control": "public, durable, s-maxage=1800, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Feed unavailable" }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
};

export const config = { path: "/api/feed" };
