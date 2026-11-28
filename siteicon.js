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
    swapIcons(cur === "winter"); swapLogo(cur === "winter"); snow(cur === "winter"); paint();
  }

  if (cur === "winter") {
    swapIcons(true);
    var mo = new MutationObserver(function () { if (document.querySelector(".logo-wk")) { swapLogo(true); mo.disconnect(); } });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

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


  var snowOn = false, cv = null, cx = null, raf = 0, dots = [], flakes = [], fimg = null, nextSpawn = 0, SH = 0, SW = 0, dpr = 1, rects = [], lastT = 0, lastM = 0;
  function headerBottom() {
    var y = 0, sy = window.pageYOffset || 0;
    [document.getElementById("car"), document.querySelector(".emnav")].forEach(function (e) { if (e) { var r = e.getBoundingClientRect(); y = Math.max(y, r.bottom + sy); } });
    return Math.min(Math.ceil(y), 700);
  }
  function measure() {
    var h = headerBottom(), w = document.documentElement.clientWidth;
    if (h !== SH || w !== SW) {
      SH = h; SW = w; dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      cv.style.width = w + "px"; cv.style.height = h + "px";
      var want = Math.min(160, Math.round(w / 11)); while (dots.length < want) dots.push(newDot(true)); dots.length = want;
    }
    var sx = window.pageXOffset || 0, sy = window.pageYOffset || 0;
    rects = Array.prototype.map.call(document.querySelectorAll("#car .cb .in"), function (e) { var r = e.getBoundingClientRect(); return { x: r.left + sx, y: r.top + sy, w: r.width, h: r.height }; });
  }
  function newDot(any) { return { x: Math.random() * (SW || 800), y: any ? Math.random() * (SH || 200) : -6, r: 0.8 + Math.random() * 1.5, v: 18 + Math.random() * 28, a: 0.45 + Math.random() * 0.5, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.2 }; }
  function newFlake() { var z = 12 + Math.random() * 7; return { x: Math.random() * SW, y: -z, z: z, v: 28 + Math.random() * 26, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.6, p: Math.random() * 6.28, s: 0.5 + Math.random(), over: Math.random() < 0.5, a: 0.85 + Math.random() * 0.15 }; }
  function drawFlake(f) {
    cx.save(); cx.globalAlpha = f.a; cx.translate(f.x, f.y); cx.rotate(f.r); cx.drawImage(fimg, -f.z / 2, -f.z / 2, f.z, f.z); cx.restore();
  }
  function hole(r) {
    var x = r.x + 2, y = r.y + 2, w = r.w - 4, h = r.h - 4, q = Math.min(16, w / 2, h / 2); if (w <= 0 || h <= 0) return;
    cx.beginPath(); cx.moveTo(x + q, y); cx.arcTo(x + w, y, x + w, y + h, q); cx.arcTo(x + w, y + h, x, y + h, q); cx.arcTo(x, y + h, x, y, q); cx.arcTo(x, y, x + w, y, q); cx.closePath(); cx.fill();
  }
  function frame(t) {
    raf = 0; if (!snowOn || document.hidden) return;
    var dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    if (t - lastM > 250 || (document.getElementById("car") && t - lastM > 30)) { measure(); lastM = t; }
    var sec = t / 1000;
    dots.forEach(function (d, i) { d.y += d.v * dt; d.x += Math.sin(sec * d.s + d.p) * 9 * dt; if (d.y > SH + 4) dots[i] = newDot(false); });
    if (t > nextSpawn && flakes.length < 5 && fimg && fimg.complete) { flakes.push(newFlake()); nextSpawn = t + 1500 + Math.random() * 3500; }
    flakes.forEach(function (f) { f.y += f.v * dt; f.x += Math.sin(sec * f.s + f.p) * 14 * dt; f.r += f.vr * dt; });
    flakes = flakes.filter(function (f) { return f.y < SH + f.z; });
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, SW, SH);
    cx.fillStyle = "#fff";
    dots.forEach(function (d) { cx.globalAlpha = d.a; cx.beginPath(); cx.arc(d.x, d.y, d.r, 0, 6.2832); cx.fill(); });
    cx.globalAlpha = 1;
    flakes.forEach(function (f) { if (!f.over) drawFlake(f); });
    cx.globalCompositeOperation = "destination-out"; cx.fillStyle = "#000"; rects.forEach(hole); cx.globalCompositeOperation = "source-over";
    flakes.forEach(function (f) { if (f.over) drawFlake(f); });
    raf = requestAnimationFrame(frame);
  }
  function snow(on) {
    if (on && !snowOn) {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches) return;
      if (!document.body) return;
      snowOn = true; cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true");
      cv.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:5";
      cx = cv.getContext("2d"); document.body.appendChild(cv);
      fimg = new Image(); fimg.src = "snowflake.png" + V; dots = []; flakes = []; SH = SW = 0; lastT = 0; lastM = 0; nextSpawn = 0;
      measure(); raf = requestAnimationFrame(frame);
    } else if (!on && snowOn) {
      snowOn = false; if (raf) cancelAnimationFrame(raf); raf = 0; if (cv && cv.parentNode) cv.parentNode.removeChild(cv); cv = null;
    }
  }
  document.addEventListener("visibilitychange", function () { if (snowOn && !document.hidden && !raf) { lastT = 0; raf = requestAnimationFrame(frame); } });

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
    if (cur === "winter") { swapLogo(true); snow(true); }
    pull(); mount(); setTimeout(mount, 600); setTimeout(mount, 2000);
    new MutationObserver(function () { mount(); }).observe(document.body, { childList: true });
  });
})();
