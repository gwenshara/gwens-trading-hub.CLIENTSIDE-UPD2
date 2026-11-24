// Supabase Edge Function: push-notify
// Sends Web Push notifications. Called only by the database triggers (supabase-setup-18.sql).
// No external libraries: Web Push encryption (RFC 8291) + VAPID (RFC 8292) with the built-in WebCrypto.
//
// Secrets to set in Supabase (Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SECRET, VAPID_SUBJECT (e.g. mailto:you@example.com)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are added automatically by Supabase.

const enc = new TextEncoder();
const b64uToBytes = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const bytesToB64u = (u8: Uint8Array) => {
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const concat = (...a: Uint8Array[]) => {
  const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of a) { out.set(x, o); o += x.length; }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

/* RFC 8291 aes128gcm payload encryption. fixed = test hooks only. */
export async function encryptPayload(
  plain: Uint8Array, uaPublicB64: string, authB64: string,
  fixed?: { asPrivateJwk?: JsonWebKey; salt?: Uint8Array },
) {
  const uaPub = b64uToBytes(uaPublicB64);
  const auth = b64uToBytes(authB64);
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  let asPriv: CryptoKey, asPubRaw: Uint8Array;
  if (fixed && fixed.asPrivateJwk) {
    const j = fixed.asPrivateJwk;
    asPriv = await crypto.subtle.importKey("jwk", j, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const pj = { kty: j.kty, crv: j.crv, x: j.x, y: j.y } as JsonWebKey;
    const pk = await crypto.subtle.importKey("jwk", pj, { name: "ECDH", namedCurve: "P-256" }, true, []);
    asPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", pk));
  } else {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPriv = kp.privateKey;
    asPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  }
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPriv, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPubRaw), 32);
  const salt = (fixed && fixed.salt) || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const padded = concat(plain, new Uint8Array([2])); // 0x02 = last record
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, padded));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPubRaw.length]), asPubRaw, ct);
}

/* RFC 8292 VAPID header */
export async function vapidHeader(endpoint: string, pubB64: string, privB64: string, subject: string) {
  const pub = b64uToBytes(pubB64);
  const jwk = {
    kty: "EC", crv: "P-256", d: privB64,
    x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)),
  } as JsonWebKey;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = bytesToB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body)));
  return "vapid t=" + head + "." + body + "." + bytesToB64u(sig) + ", k=" + pubB64;
}

// ---- server ----
const J = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

/* signed picture link: only a notification we sent can fetch a member's picture */
const sigFor = async (name: string, secret: string) => {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToB64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(name.toLowerCase())))).slice(0, 24);
};

Deno.serve(async (req) => {
  /* GET ?av=NAME&sig=...: the sender's profile picture, used as the notification icon */
  if (req.method === "GET") {
    const u = new URL(req.url), name = u.searchParams.get("av") || "", sig = u.searchParams.get("sig") || "";
    const sec = Deno.env.get("PUSH_SECRET"), b0 = Deno.env.get("SUPABASE_URL"), sv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!sec || !b0 || !sv || !/^[A-Za-z0-9_]{3,20}$/.test(name) || sig !== await sigFor(name, sec)) return new Response("not found", { status: 404 });
    const r = await fetch(b0 + "/rest/v1/profiles?select=avatar&username=eq." + encodeURIComponent(name) + "&limit=1", { headers: { apikey: sv, Authorization: "Bearer " + sv } });
    const a = r.ok ? (await r.json())[0]?.avatar : null;
    const m = typeof a === "string" ? a.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!m) return new Response("no picture", { status: 404 });
    const bin = atob(m[2]), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Response(bytes, { headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=600", "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") return J({ error: "POST only" }, 405);
  const secret = Deno.env.get("PUSH_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) return J({ error: "forbidden" }, 401);

  const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@gwenvaluehub.com";
  const base = Deno.env.get("SUPABASE_URL"), svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!pub || !priv || !base || !svc) return J({ error: "missing secrets" }, 500);

  let b: any;
  try { b = await req.json(); } catch { return J({ error: "bad json" }, 400); }
  const kind = String(b.kind || "dm");
  const hdr = { apikey: svc, Authorization: "Bearer " + svc };

  // who gets it: explicit user ids (looked up in chunks of 100), or everybody subscribed except one person
  const UUID = /^[0-9a-f-]{36}$/i;
  const cols = "select=id,user_id,endpoint,p256dh,auth,prefs";
  let rows: any[] = [];
  if (Array.isArray(b.user_ids) && b.user_ids.length) {
    const ids: string[] = b.user_ids.filter((x: string) => UUID.test(x));
    for (let i = 0; i < ids.length; i += 100) {
      const r = await fetch(base + "/rest/v1/push_subs?" + cols + "&user_id=in.(" + ids.slice(i, i + 100).join(",") + ")", { headers: hdr });
      if (!r.ok) return J({ error: "db " + r.status }, 500);
      rows = rows.concat(await r.json());
    }
  } else if (b.all_except && UUID.test(b.all_except)) {
    const r = await fetch(base + "/rest/v1/push_subs?" + cols + "&user_id=neq." + b.all_except, { headers: hdr });
    if (!r.ok) return J({ error: "db " + r.status }, 500);
    rows = await r.json();
  } else return J({ error: "no recipients" }, 400);
  const subs = rows.filter((s: any) => !s.prefs || s.prefs[kind] !== false);

  /* for messages, the sender's profile picture becomes the notification icon (the title starts with their username) */
  let icon = "";
  if (kind === "dm" || kind === "group") {
    const nm = String(b.title || "").split(" ")[0];
    if (/^[A-Za-z0-9_]{3,20}$/.test(nm)) icon = base + "/functions/v1/push-notify?av=" + encodeURIComponent(nm) + "&sig=" + await sigFor(nm, secret);
  }
  const payload = enc.encode(JSON.stringify({
    icon,
    title: String(b.title || "EM Wiki").slice(0, 80),
    body: String(b.body || "").slice(0, 180),
    url: String(b.url || "forum-discussions.html").slice(0, 200),
    tag: String(b.tag || kind).slice(0, 80),
    kind,
  }));

  let sent = 0; const dead: string[] = [];
  await Promise.all(subs.map(async (s: any) => {
    try {
      const body = await encryptPayload(payload, s.p256dh, s.auth);
      const res = await fetch(s.endpoint, {
        method: "POST",
        headers: {
          Authorization: await vapidHeader(s.endpoint, pub, priv, subject),
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: String(b.ttl || 86400),
          Urgency: "high",
        },
        body,
      });
      if (res.status === 404 || res.status === 410) dead.push(s.id); else if (res.ok) sent++;
    } catch (_e) { /* one bad device must not stop the others */ }
  }));
  if (dead.length) {
    await fetch(base + "/rest/v1/push_subs?id=in.(" + dead.join(",") + ")", { method: "DELETE", headers: hdr });
  }
  return J({ sent, removed: dead.length });
});
