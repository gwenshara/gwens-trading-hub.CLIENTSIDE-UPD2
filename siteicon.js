/* Site icon (Normal / Winter). The admin picks it in Settings; the choice is stored in Supabase and every visitor gets it.
   Winter changes: the logo (new face + light-blue letters), the browser tab icon, and (through the Cloudflare worker) the link preview. */
(function () {
  if (window.__emSiteIcon) return; window.__emSiteIcon = 1;
  var CFG = window.EM_SUPABASE || {}, K = "em_site_icon", V = "?v=1";
  var LOGO = { ".logo-f": "logo-winter-face.webp", ".logo-em": "logo-winter-em.webp", ".logo-wk": "logo-winter-wk.webp" };
  var cur = "normal";
  try { var s = localStorage.getItem(K); if (s === "winter" || s === "normal") cur = s; } catch (e) {}

  function iconFor(link) {
    var r = (link.getAttribute("rel") || "").toLowerCase();
    if (r.indexOf("apple-touch-icon") > -1) return "apple-touch-icon-winter.png";
    var z = link.getAttribute("sizes") || "";
    if (z === "16x16") return "favicon-winter-16.png";
    if (z === "32x32") return "favicon-winter-32.png";
    return "favicon-winter.ico";
  }
  function swapIcons(w) {
    var links = document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]');
    if (!links.length && w) {
      var l = document.createElement("link"); l.rel = "icon"; l.href = "favicon-winter.ico" + V; l.setAttribute("data-em-new", "1"); (document.head || document.documentElement).appendChild(l); return;
    }
    Array.prototype.forEach.call(links, function (l) {
      if (w) { if (!l.hasAttribute("data-em-orig")) l.setAttribute("data-em-orig", l.getAttribute("href") || ""); l.setAttribute("href", iconFor(l) + V); }
      else if (l.hasAttribute("data-em-orig")) { l.setAttribute("href", l.getAttribute("data-em-orig")); l.removeAttribute("data-em-orig"); }
      else if (l.hasAttribute("data-em-new")) l.parentNode.removeChild(l);
    });
  }
  function swapLogo(w) {
    Object.keys(LOGO).forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (img) {
        if (w) {
          if (!img.hasAttribute("data-em-orig")) img.setAttribute("data-em-orig", img.getAttribute("src") || "");
          if (img.getAttribute("src") === LOGO[sel] + V) return;
          var pre = new Image(); pre.onload = function () { if (cur === "winter") img.setAttribute("src", LOGO[sel] + V); }; pre.src = LOGO[sel] + V;
        } else if (img.hasAttribute("data-em-orig")) { img.setAttribute("src", img.getAttribute("data-em-orig")); img.removeAttribute("data-em-orig"); }
      });
    });
  }
  function apply(v) {
    cur = v === "winter" ? "winter" : "normal";
    try { localStorage.setItem(K, cur); } catch (e) {}
    swapIcons(cur === "winter"); swapLogo(cur === "winter"); paint();
  }

  /* first paint: use the last known choice right away, swap the logo as soon as it exists */
  if (cur === "winter") {
    swapIcons(true);
    var mo = new MutationObserver(function () { if (document.querySelector(".logo-wk")) { swapLogo(true); mo.disconnect(); } });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ask the server what everyone should see */
  function headers() { var h = { apikey: CFG.anonKey }; if (!/^sb_/.test(CFG.anonKey || "")) h.Authorization = "Bearer " + CFG.anonKey; return h; }
  function pull() {
    if (!CFG.url || !CFG.anonKey) return;
    fetch(CFG.url + "/rest/v1/site_settings?key=eq.site_icon&select=value", { headers: headers(), cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { var v = j && j[0] && j[0].value; if ((v === "winter" || v === "normal") && v !== cur) apply(v); })
      .catch(function () {});
  }
  addEventListener("storage", function (e) { if (e.key === K && (e.newValue === "winter" || e.newValue === "normal") && e.newValue !== cur) apply(e.newValue); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) pull(); });
  setInterval(function () { if (!document.hidden) pull(); }, 60000);

  /* admin-only choice inside Settings (both the catalog menu and the other pages' menu) */
  function admin() { try { return !!(window.EMAuth && EMAuth.isAdmin && EMAuth.isAdmin()); } catch (e) { return false; } }
  function css() {
    if (document.getElementById("em-sico-css")) return;
    var st = document.createElement("style"); st.id = "em-sico-css";
    st.textContent = ".sico-row{display:flex;gap:8px}.sico-b{flex:1;display:flex;align-items:center;gap:8px;background:var(--bg,#1b1b1d);color:var(--text,#f1f1f4);border:1px solid var(--line,#3a3a42);border-radius:10px;padding:8px 10px;font:600 13px Nunito,system-ui,sans-serif;cursor:pointer}" +
      ".sico-b img{width:22px;height:22px;object-fit:contain}.sico-b.on{border-color:#2e8bff;box-shadow:0 0 0 1px #2e8bff inset}.sico-b:disabled{opacity:.6;cursor:wait}" +
      ".sico-m{margin-top:6px;font:500 12px/1.4 Nunito,system-ui,sans-serif;color:var(--mute,#a0a0ab)}";
    document.head.appendChild(st);
  }
  function paint() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-sico] .sico-b"), function (b) { b.classList.toggle("on", b.getAttribute("data-v") === cur); });
  }
  function choose(v, box) {
    var msg = box.querySelector(".sico-m"), btns = box.querySelectorAll(".sico-b");
    if (!window.EMAuth || !EMAuth.rest) return;
    Array.prototype.forEach.call(btns, function (b) { b.disabled = true; }); msg.textContent = "Saving...";
    EMAuth.rest("rpc/set_site_icon", "POST", { p_icon: v }).then(function () {
      apply(v); msg.textContent = "Saved. Everyone now sees the " + v + " icon (open pages update within a minute).";
    }).catch(function (e) {
      var t = String(e && e.message || e);
      msg.textContent = /set_site_icon|schema cache|does not exist|404/i.test(t) ? "Run supabase-setup-47.sql in Supabase first." : t;
    }).then(function () { Array.prototype.forEach.call(btns, function (b) { b.disabled = false; }); });
  }
  function mount() {
    if (!admin()) return;
    Array.prototype.forEach.call(document.querySelectorAll(".stp,.em-setp"), function (p) {
      if (p.querySelector("[data-sico]")) return;
      var th = p.querySelector(".thr,#theme"), after = th && th.closest(".sec"); if (!after) return;
      css();
      var d = document.createElement("div"); d.className = "sec"; d.setAttribute("data-sico", "1");
      d.innerHTML = '<div class="stt">Site icon (admin only)</div><div class="sico-row">' +
        '<button type="button" class="sico-b" data-v="normal"><img src="favicon.ico" alt="">Normal</button>' +
        '<button type="button" class="sico-b" data-v="winter"><img src="favicon-winter-32.png" alt="">Winter</button></div>' +
        '<div class="sico-m">Changes the logo, tab icon and link preview for the whole community.</div>';
      Array.prototype.forEach.call(d.querySelectorAll(".sico-b"), function (b) { b.onclick = function () { choose(b.getAttribute("data-v"), d); }; });
      after.parentNode.insertBefore(d, after.nextSibling); paint();
    });
  }
  function ready(f) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", f); else f(); }
  ready(function () {
    if (cur === "winter") swapLogo(true);
    pull(); mount(); setTimeout(mount, 600); setTimeout(mount, 2000);
    new MutationObserver(function () { mount(); }).observe(document.body, { childList: true });
  });
})();
