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


async function getIcon() {
  try {
    const r = await fetch(SB_URL + "/rest/v1/site_settings?key=eq.site_icon&select=value,updated_at", {
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
      cf: { cacheTtl: 10, cacheEverything: true },
    });
    if (!r.ok) return { icon: "normal", v: 0 };
    const j = await r.json();
    const row = j && j[0];
    return { icon: row && row.value === "winter" ? "winter" : "normal", v: row ? Math.floor(Date.parse(row.updated_at) / 1000) || 0 : 0 };
  } catch (e) { return { icon: "normal", v: 0 }; }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

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

    if (url.pathname === "/og-image.png") {
      const ic = await getIcon();
      if (ic.icon === "winter") {
        const w = await fetch(SITE + "/og-image-winter.png");
        if (w.ok) return new Response(w.body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
      }
      return fetch(request);
    }

    const page = await fetch(request);
    if (request.method !== "GET" || !(page.headers.get("content-type") || "").includes("text/html")) return page;

    const isList = url.pathname === "/list" || url.pathname === "/list.html";
    const code = isList ? cleanCode(url.searchParams.get("c")) : "";
    const [ic, d] = await Promise.all([getIcon(), code ? rpc("get_list_share", { p_code: code }) : null]);
    const hasList = !!(d && d.username);
    const winter = ic.icon === "winter";
    if (!hasList && !winter) return page;

    const set = (value) => ({ element(e) { e.setAttribute("content", value); } });
    let rw = new HTMLRewriter();

    if (winter) {
      rw = rw.on('link[rel="icon"]', { element(e) {
        const z = e.getAttribute("sizes") || "";
        e.setAttribute("href", (z === "16x16" ? "/favicon-winter-16.png" : z === "32x32" ? "/favicon-winter-32.png" : "/favicon-winter.ico") + "?v=1");
      } }).on('link[rel="apple-touch-icon"]', { element(e) { e.setAttribute("href", "/apple-touch-icon-winter.png?v=1"); } });
      if (!hasList) {
        const img = SITE + "/og-image.png?v=w" + ic.v;
        rw = rw.on('meta[property="og:image"]', set(img)).on('meta[name="twitter:image"]', set(img));
      }
    }

    if (hasList) {
      const kind = d.kind === "wishlist" ? "Wishlist" : "Favorites";
      const n = Array.isArray(d.items) ? d.items.length : 0;
      const title = d.username + "\u2019s " + kind + " \u2013 EM Wiki";
      const desc = n + " item" + (n === 1 ? "" : "s") + " \u00b7 Total value: " + spc(d.total || 0) + " Robux";
      const img = SITE + "/list-img/" + code + ".jpg?v=" + (d.updated || 0);
      rw = rw
        .on("title", { element(e) { e.setInnerContent(title); } })
        .on('meta[property="og:title"]', set(title))
        .on('meta[name="twitter:title"]', set(title))
        .on('meta[property="og:description"]', set(desc))
        .on('meta[name="twitter:description"]', set(desc))
        .on('meta[name="description"]', set(desc))
        .on('meta[property="og:image"]', set(img))
        .on('meta[name="twitter:image"]', set(img))
        .on('meta[property="og:url"]', set(SITE + "/list?c=" + code));
    }

    const res = new Response(rw.transform(page).body, page);
    res.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    return res;
  },
};
