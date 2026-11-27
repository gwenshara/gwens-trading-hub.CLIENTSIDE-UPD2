/* Cloudflare Worker: makes Discord show a preview image of a shared list.
   Paste this whole file in Cloudflare > Workers & Pages > your worker > Edit code, then Deploy.
   Routes to add (Settings > Domains & Routes > Add > Route):
     gwenvaluehub.com/list.html*
     gwenvaluehub.com/list-img/*
   Nothing secret is in here: the Supabase address and the public (anon) key are the same ones your site already shows. */
const SB_URL = "https://fopalskmdgkxnnxzmgfc.supabase.co";
const SB_KEY = "sb_publishable_ExIZoF8wG6njXVeERTw4yQ_azZQ5aED";
const SITE = "https://gwenvaluehub.com";

async function rpc(name, body) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  return r.json();
}
const cleanCode = (c) => String(c || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
const spc = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 1) the preview picture: /list-img/<code>.jpg
    if (url.pathname.startsWith("/list-img/")) {
      const code = cleanCode(url.pathname.split("/").pop().replace(/\.jpe?g$/i, ""));
      const data = code ? await rpc("get_list_image", { p_code: code }) : null;
      const m = typeof data === "string" && data.match(/^data:image\/jpeg;base64,(.+)$/);
      if (!m) return new Response("Not found", { status: 404 });
      const bin = atob(m[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60" } });
    }

    // 2) the page: /list.html?c=<code>  (same page, but with this person's preview tags)
    const page = await fetch(request);
    const code = cleanCode(url.searchParams.get("c"));
    if (!code || !(page.headers.get("content-type") || "").includes("text/html")) return page;
    const d = await rpc("get_list_share", { p_code: code });
    if (!d || !d.username) return page;

    const kind = d.kind === "wishlist" ? "Wishlist" : "Favorites";
    const n = Array.isArray(d.items) ? d.items.length : 0;
    const title = d.username + "\u2019s " + kind + " \u2013 EM Wiki";
    const desc = n + " item" + (n === 1 ? "" : "s") + " \u00b7 Total value: " + spc(d.total || 0) + " Robux";
    const img = SITE + "/list-img/" + code + ".jpg?v=" + (d.updated || 0);
    const set = (value) => ({ element(e) { e.setAttribute("content", value); } });

    const out = new HTMLRewriter()
      .on("title", { element(e) { e.setInnerContent(title); } })
      .on('meta[property="og:title"]', set(title))
      .on('meta[name="twitter:title"]', set(title))
      .on('meta[property="og:description"]', set(desc))
      .on('meta[name="twitter:description"]', set(desc))
      .on('meta[name="description"]', set(desc))
      .on('meta[property="og:image"]', set(img))
      .on('meta[name="twitter:image"]', set(img))
      .on('meta[property="og:url"]', set(SITE + "/list.html?c=" + code))
      .transform(page);
    // never let the page (and so the preview tags) be cached, so a changed list shows up right away
    const res = new Response(out.body, out);
    res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    return res;
  },
};
