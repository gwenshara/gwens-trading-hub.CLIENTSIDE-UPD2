/* Push notifications for EM Wiki. Loaded by auth.js on every page. */
(function () {
if (window.EMPush) return;
var CFG = window.EM_SUPABASE || {}, A = window.EMAuth;
if (!A || !A.configured || !CFG.url) return;
var VAPID = "BNokfIDjymS58VLEgotXbHGI9NOvRlTdz8HfrmKd54n8UU6mFICeJGTWMlAilwrbHUGw9ltz_Y-34AOTyD-C51Y";
var SOUND = "notification.m4a?v=1";
var KINDS = [
  ["dm", "Messages", "Private and trade chats"],
  ["group", "Group chats", "Includes middleman chats"],
  ["mm", "Middleman requests", "When you are chosen as middleman"],
  ["vote", "New value votes", "When someone starts a vote"]
];
function ld(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function sv(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
var supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
function u8(b64) { b64 = b64.replace(/-/g, "+").replace(/_/g, "/"); while (b64.length % 4) b64 += "="; var s = atob(b64), o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i); return o; }
function same(a, b) { if (!a || !b || a.byteLength !== b.byteLength) return false; var x = new Uint8Array(a), y = new Uint8Array(b); for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false; return true; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

var regP = null;
function register() { if (!regP) regP = navigator.serviceWorker.register("sw.js").then(function () { return navigator.serviceWorker.ready; }); return regP; }

/* custom sound: only plays while the site is open in some tab (browsers cannot set a sound for closed-site notifications) */
var lastSnd = 0;
function ding() {
  if (ld("em_push_snd") === "0") return;
  if (Date.now() - lastSnd < 4000) return; lastSnd = Date.now();
  try { var a = new Audio(SOUND); a.volume = 1; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
}

async function getSub(reg) { return reg.pushManager.getSubscription(); }
async function save(sub, prefs) {
  var j = sub.toJSON();
  return A.rest("rpc/push_subscribe", "POST", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_prefs: prefs || null });
}
async function subscribe() {
  var reg = await register(), sub = await getSub(reg), key = u8(VAPID);
  if (sub && sub.options && sub.options.applicationServerKey && !same(sub.options.applicationServerKey, key.buffer)) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return { sub: sub, prefs: await save(sub) };
}

/* turns the browser's cryptic push errors into steps a person can follow */
function friendly(x) {
  var m = (x && x.message) ? String(x.message) : "Something went wrong.";
  if (/push service|registration failed|AbortError/i.test(m)) {
    if (navigator.brave) return "Brave blocks notifications by default. Open brave://settings/privacy, turn on \u201cUse Google Services for Push Messaging\u201d, restart Brave, then press Turn on again.";
    return "Your browser couldn't reach its push service. Update the browser, turn off any VPN or ad blocker for this site, then try again. If it still fails, use Chrome.";
  }
  return m;
}

var API = window.EMPush = {
  supported: supported,
  async state() {
    if (!supported) return ios && !standalone ? "ios-install" : "unsupported";
    if (Notification.permission === "denied") return "blocked";
    if (Notification.permission !== "granted" || ld("em_push_on") !== "1") return "off";
    try { var reg = await register(), sub = await getSub(reg); return sub ? "on" : "off"; } catch (e) { return "off"; }
  },
  async enable() {
    if (!supported) throw new Error(ios && !standalone ? "On iPhone/iPad: tap Share, then Add to Home Screen, open the site from there and try again." : "This browser can't show push notifications.");
    var perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications are blocked. Allow them for this site in your browser settings, then try again.");
    var r = await subscribe(); sv("em_push_on", "1"); sv("em_push_ask", String(Date.now()));
    return r.prefs;
  },
  async disable() {
    sv("em_push_on", "0");
    try { var reg = await register(), sub = await getSub(reg); if (sub) { var ep = sub.endpoint; await sub.unsubscribe(); await A.rest("rpc/push_unsubscribe", "POST", { p_endpoint: ep }); } } catch (e) {}
  },
  async prefs() {
    var reg = await register(), sub = await getSub(reg); if (!sub) return null;
    return save(sub);
  },
  async setPrefs(p) {
    var reg = await register(), sub = await getSub(reg); if (!sub) throw new Error("Turn notifications on first.");
    return A.rest("rpc/push_set_prefs", "POST", { p_endpoint: sub.endpoint, p_prefs: p });
  },
  test() { return A.rest("rpc/push_test", "POST", {}); },
  ding: ding
};

/* ---------- settings panel ---------- */
var css = document.createElement("style");
css.textContent =
".pn-mo{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}.pn-mo[hidden]{display:none}" +
".pn-box{position:relative;background:var(--b2,#232327);color:var(--text,#fff);border:1px solid var(--bl,#3a3a42);border-radius:16px;padding:20px 20px 16px;width:min(420px,100%);max-height:90vh;overflow:auto;font:600 13px Montserrat,Inter,system-ui,sans-serif}" +
".pn-box h3{margin:0 0 4px;font:800 18px Montserrat,Inter,system-ui,sans-serif}.pn-sub{opacity:.7;font-weight:500;margin:0 0 14px;line-height:1.4}" +
".pn-x{position:absolute;top:10px;right:12px;background:none;border:0;color:inherit;font-size:18px;cursor:pointer;opacity:.7}" +
".pn-st{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:var(--b3,#2a2a30);margin-bottom:12px}.pn-st i{width:10px;height:10px;border-radius:50%;background:#80848e;flex:none}.pn-st.on i{background:#3bb26b}.pn-st.bad i{background:#e5484d}" +
".pn-btn{border:0;border-radius:10px;padding:9px 14px;font:700 13px Montserrat,Inter,system-ui,sans-serif;cursor:pointer;background:#2e8bff;color:#fff}.pn-btn.alt{background:var(--b3,#2a2a30);color:var(--text,#fff);border:1px solid var(--bl,#3a3a42)}.pn-btn:disabled{opacity:.5;cursor:default}" +
".pn-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 2px;border-top:1px solid var(--bl,#3a3a42);cursor:pointer}.pn-row small{display:block;opacity:.65;font-weight:500;margin-top:2px}.pn-row input{width:18px;height:18px;flex:none;accent-color:#2e8bff}" +
".pn-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pn-err{color:#e5484d;margin-top:8px;min-height:1em}.pn-note{opacity:.6;font-weight:500;font-size:12px;margin-top:10px;line-height:1.4}" +
".pn-toast{position:fixed;right:16px;bottom:16px;z-index:8900;background:var(--b2,#232327);color:var(--text,#fff);border:1px solid var(--bl,#3a3a42);border-radius:14px;padding:12px 14px;width:min(320px,calc(100% - 32px));box-shadow:0 8px 30px rgba(0,0,0,.35);font:600 13px Montserrat,Inter,system-ui,sans-serif}.pn-toast p{margin:0 0 10px;line-height:1.4}.pn-toast div{display:flex;gap:8px}";
document.head.appendChild(css);

var modal = null;
function openPanel() {
  if (!modal) {
    modal = document.createElement("div"); modal.className = "pn-mo"; modal.hidden = true; document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest(".pn-x")) modal.hidden = true; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal) modal.hidden = true; });
  }
  modal.hidden = false; paint("");
}
async function paint(err) {
  var st = await API.state(), prefs = null;
  if (st === "on") { try { prefs = await API.prefs(); } catch (e) {} }
  prefs = prefs || { dm: true, group: true, mm: true, vote: true };
  var msg = { on: "On for this device", off: "Off on this device", blocked: "Blocked in your browser settings", "ios-install": "Needs the Home Screen app on iPhone/iPad", unsupported: "Not supported in this browser" }[st];
  var h = '<div class="pn-box" role="dialog" aria-modal="true"><button class="pn-x" type="button" aria-label="Close">\u2715</button><h3>Notifications</h3>' +
    '<p class="pn-sub">Get a notification when you are away from the site.</p>' +
    '<div class="pn-st ' + (st === "on" ? "on" : st === "blocked" ? "bad" : "") + '"><i></i><span>' + esc(msg) + '</span></div>';
  if (st === "on") {
    KINDS.forEach(function (k) { h += '<label class="pn-row"><span>' + k[1] + '<small>' + k[2] + '</small></span><input type="checkbox" data-k="' + k[0] + '"' + (prefs[k[0]] !== false ? " checked" : "") + "></label>"; });
    h += '<label class="pn-row"><span>Play the EM sound<small>While the site is open in another tab</small></span><input type="checkbox" id="pn-snd"' + (ld("em_push_snd") === "0" ? "" : " checked") + "></label>";
    h += '<div class="pn-acts"><button class="pn-btn" id="pn-test" type="button">Send a test</button><button class="pn-btn alt" id="pn-off" type="button">Turn off</button></div>';
  } else if (st === "off") {
    h += '<div class="pn-acts"><button class="pn-btn" id="pn-on" type="button">Turn on notifications</button></div>';
  } else if (st === "ios-install") {
    h += '<p class="pn-note" style="margin-top:0">On iPhone/iPad: tap Share, then <b>Add to Home Screen</b>, open the site from the new icon, and turn notifications on there.</p>';
  } else if (st === "blocked") {
    h += '<p class="pn-note" style="margin-top:0">Click the lock icon next to the address, allow Notifications for this site, then reload.</p>';
  }
  h += '<div class="pn-err" id="pn-err">' + esc(err || "") + '</div>';
  h += '<p class="pn-note">No alert while you are looking at the site, or while your status is Do not disturb. If several messages arrive from one person, you only get the first.</p></div>';
  modal.innerHTML = h;
  var q = function (s) { return modal.querySelector(s); }, e = q("#pn-err");
  var busy = function (b, on) { if (b) { b.disabled = on; } };
  if (q("#pn-on")) q("#pn-on").onclick = async function () { var b = this; busy(b, true); try { await API.enable(); paint(""); } catch (x) { busy(b, false); e.textContent = friendly(x); } };
  if (q("#pn-off")) q("#pn-off").onclick = async function () { busy(this, true); await API.disable(); paint(""); };
  if (q("#pn-test")) q("#pn-test").onclick = async function () { var b = this; busy(b, true); e.textContent = ""; try { await API.test(); e.style.color = "#3bb26b"; e.textContent = "Sent. It should arrive in a few seconds."; } catch (x) { e.style.color = "#e5484d"; e.textContent = x.message; } setTimeout(function () { busy(b, false); }, 4000); };
  if (q("#pn-snd")) q("#pn-snd").onchange = function () { sv("em_push_snd", this.checked ? "1" : "0"); if (this.checked) ding(); };
  modal.querySelectorAll("[data-k]").forEach(function (c) {
    c.onchange = async function () {
      var p = {}; modal.querySelectorAll("[data-k]").forEach(function (x) { p[x.dataset.k] = x.checked; });
      try { await API.setPrefs(p); } catch (x) { e.style.color = "#e5484d"; e.textContent = x.message; }
    };
  });
}

/* "Notifications" entry in the account menu (the menu is redrawn by auth.js, so keep re-adding it) */
function addMenu() {
  var m = document.querySelector(".em-auth .em-menu");
  if (!m || m.querySelector("#em-pn")) return;
  var b = document.createElement("button"); b.id = "em-pn"; b.type = "button"; b.textContent = "Notifications";
  b.addEventListener("click", function () { m.hidden = true; openPanel(); });
  var vp = m.querySelector("#em-vp"); if (vp && vp.nextSibling) m.insertBefore(b, vp.nextSibling); else m.appendChild(b);
}

/* one gentle question, once, for people who have not decided */
function askOnce() {
  if (!supported || Notification.permission !== "default") return;
  var t = +ld("em_push_ask") || 0; if (Date.now() - t < 14 * 864e5) return;
  var el = document.createElement("div"); el.className = "pn-toast";
  el.innerHTML = '<p><b>Get notified?</b><br>We can tell you about new messages and value votes when you are away from the site.</p><div><button class="pn-btn" type="button" data-y>Turn on</button><button class="pn-btn alt" type="button" data-n>Not now</button></div>';
  document.body.appendChild(el);
  el.querySelector("[data-n]").onclick = function () { sv("em_push_ask", String(Date.now())); el.remove(); };
  el.querySelector("[data-y]").onclick = function () { el.remove(); openPanel(); };
}

/* ---------- the guide: pick your device, read a few basic steps and fixes ---------- */
var GUIDE = {
  windows: { t: "Windows PC", steps: [
    "Log in, open <b>\u2699 Settings</b>, press <b>Turn on</b>, then <b>Allow</b> when the browser asks.",
    "Press <b>Manage</b>, then <b>Send a test</b>. A notification should pop up in the corner of your screen."
  ], fix: [
    ["Nothing shows up", "Windows: Settings, System, Notifications. Turn <b>Notifications</b> on, turn <b>Do not disturb</b> off, and make sure your browser (Chrome, Edge...) is switched on in the list."],
    ["It says \"push service error\"", "Brave: open <b>brave://settings/privacy</b>, turn on <b>Use Google Services for Push Messaging</b> and restart Brave. Other browsers: update it and turn off any VPN or ad blocker for this site."],
    ["It says \"Blocked\"", "Click the lock icon left of the address, set <b>Notifications</b> to <b>Allow</b>, then reload the page."],
    ["Only works while the browser is open", "In Chrome: Settings, System, turn on <b>Continue running background apps when Chrome is closed</b>."]
  ] },
  mac: { t: "Mac", steps: [
    "Log in, open <b>\u2699 Settings</b>, press <b>Turn on</b>, then <b>Allow</b> when the browser asks.",
    "Press <b>Manage</b>, then <b>Send a test</b>. A notification should appear at the top right of your screen."
  ], fix: [
    ["Nothing shows up", "Mac: System Settings, Notifications, pick your browser and allow notifications. Turn <b>Focus</b> / Do not disturb off."],
    ["It says \"push service error\"", "Brave: open <b>brave://settings/privacy</b>, turn on <b>Use Google Services for Push Messaging</b> and restart Brave. Other browsers: update it and turn off any VPN or ad blocker for this site."],
    ["It says \"Blocked\"", "Click the lock icon left of the address (in Safari: Safari, Settings, Websites, Notifications), set this site to <b>Allow</b>, then reload."]
  ] },
  android: { t: "Android phone", steps: [
    "Open the site in <b>Chrome</b>, log in, open <b>\u2699 Settings</b>, press <b>Turn on</b>, then <b>Allow</b>.",
    "Press <b>Manage</b>, then <b>Send a test</b>. You should get a notification, even with the browser closed."
  ], fix: [
    ["Nothing shows up", "Android Settings, Apps, Chrome, Notifications: make sure they are on. Turn <b>Do not disturb</b> off."],
    ["It arrives late or never", "Android Settings, Battery, Chrome: choose <b>Unrestricted</b> (battery saving can delay notifications)."],
    ["It says \"push service error\"", "Brave: open <b>brave://settings/privacy</b>, turn on <b>Use Google Services for Push Messaging</b> and restart Brave. Other browsers: update it and turn off any VPN or ad blocker for this site."],
    ["It says \"Blocked\"", "Tap the lock icon next to the address, then Permissions, Notifications, <b>Allow</b>. Reload the page."]
  ] },
  ios: { t: "iPhone / iPad", steps: [
    "Needs iOS 16.4 or newer. Open the site in <b>Safari</b>, tap <b>Share</b>, then <b>Add to Home Screen</b>.",
    "Open the site from the <b>new icon on your Home Screen</b> (not from Safari), log in, open <b>\u2699 Settings</b>, press <b>Turn on</b>, then <b>Allow</b>.",
    "Press <b>Manage</b>, then <b>Send a test</b>."
  ], fix: [
    ["The box says \"Needs the Home Screen app\"", "You are still in Safari. Close it and open the site from the Home Screen icon."],
    ["Nothing shows up", "iPhone Settings, Notifications, find the site's icon and allow notifications. Turn <b>Focus</b> / Do not disturb off."],
    ["It stopped working", "Delete the Home Screen icon, add it again, log in and press Turn on again."]
  ] }
};
var guideEl = null;
function openGuide() {
  if (!guideEl) {
    guideEl = document.createElement("div"); guideEl.className = "pn-mo"; guideEl.hidden = true; document.body.appendChild(guideEl);
    guideEl.addEventListener("click", function (e) { if (e.target === guideEl || e.target.closest(".pn-x")) guideEl.hidden = true; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && guideEl) guideEl.hidden = true; });
  }
  guideEl.hidden = false;
  var phone = /android|iphone|ipad|ipod/i.test(navigator.userAgent) || ios;
  var opts = phone ? [["android", "Android"], ["ios", "iPhone / iPad"]] : [["windows", "Windows"], ["mac", "Mac"]];
  function home() {
    guideEl.innerHTML = '<div class="pn-box" role="dialog" aria-modal="true"><button class="pn-x" type="button" aria-label="Close">\u2715</button><h3>How notifications work</h3>' +
      '<p class="pn-sub">You get a notification on your ' + (phone ? "phone" : "computer") + ' when something happens while you are away from the site.</p>' +
      '<ul style="margin:0 0 14px;padding-left:18px;line-height:1.6;font-weight:500"><li>New private, trade, group and middleman messages.</li><li>New value votes.</li><li>The first message from someone notifies you. If they keep writing, you are notified again after 2 minutes.</li><li>No notification while you are looking at the site or while your status is Do not disturb.</li></ul>' +
      '<div class="stt" style="font:700 13px Montserrat,Inter,system-ui,sans-serif;margin-bottom:8px">What device are you using?</div>' +
      '<div class="pn-acts" style="margin-top:0">' + opts.map(function (o) { return '<button class="pn-btn" type="button" data-d="' + o[0] + '" style="flex:1;padding:14px">' + o[1] + "</button>"; }).join("") + "</div></div>";
    guideEl.querySelectorAll("[data-d]").forEach(function (b) { b.onclick = function () { show(b.dataset.d); }; });
  }
  function show(k) {
    var g = GUIDE[k];
    guideEl.innerHTML = '<div class="pn-box" role="dialog" aria-modal="true"><button class="pn-x" type="button" aria-label="Close">\u2715</button><h3>' + g.t + "</h3>" +
      '<p class="pn-sub">Set it up in a few steps</p><ol style="margin:0 0 14px;padding-left:20px;line-height:1.6;font-weight:500">' + g.steps.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ol>" +
      '<div class="stt" style="font:700 13px Montserrat,Inter,system-ui,sans-serif;margin-bottom:4px">If it does not work</div>' +
      g.fix.map(function (f) { return '<div class="pn-row" style="cursor:default;display:block"><b>' + f[0] + "</b><small>" + f[1] + "</small></div>"; }).join("") +
      '<p class="pn-note">When the site is closed, your device plays its own notification sound. The EM sound only plays while the site is open in another tab.</p>' +
      '<div class="pn-acts"><button class="pn-btn alt" type="button" data-b>\u2190 Back</button></div></div>';
    guideEl.querySelector("[data-b]").onclick = home;
  }
  home();
}

/* The "Get notified?" box now lives in Settings (catalog Settings menu and the gear on the other pages) */
function hookGuide(el) { var g = el.querySelector("[data-g]"); if (g) g.onclick = function () { var host = el.closest(".stp,.em-setp"); if (host) host.hidden = true; openGuide(); }; }
async function paintNotif(el) {
  if (!A.user()) { el.innerHTML = 'Log in to get notifications.<br><button class="alt" type="button" data-g>Guide</button>'; hookGuide(el); return; }
  var st = await API.state(), h;
  if (st === "on") h = '<span class="sd on"></span>On for this device<br><button class="alt" type="button" data-m>Manage</button>';
  else if (st === "off") h = '<b>Get notified?</b><small>We can tell you about new messages and value votes when you are away from the site.</small><button type="button" data-y>Turn on</button><div class="er"></div>';
  else if (st === "blocked") h = '<span class="sd bad"></span>Blocked in your browser settings<small>Click the lock icon next to the address, allow Notifications for this site, then reload.</small>';
  else if (st === "ios-install") h = 'Needs the Home Screen app on iPhone/iPad<small>Tap Share, then Add to Home Screen, open the site from the new icon, and turn notifications on there.</small>';
  else h = "Not supported in this browser";
  el.innerHTML = h + '<br><button class="alt" type="button" data-g>Guide: how it works</button>';
  hookGuide(el);
  var y = el.querySelector("[data-y]"), m = el.querySelector("[data-m]");
  if (y) y.onclick = function () {
    var er = el.querySelector(".er"); y.disabled = true; er.textContent = "";
    API.enable().then(function () { paintNotif(el); }).catch(function (x) { y.disabled = false; er.textContent = friendly(x); });
  };
  if (m) m.onclick = function () { var host = el.closest(".stp,.em-setp"); if (host) host.hidden = true; openPanel(); };
}
function mountAll() { document.querySelectorAll(".em-setnotif").forEach(function (el) { paintNotif(el).catch(function (x) { el.textContent = "Could not check notifications: " + (x && x.message ? x.message : "unknown error"); }); }); }
setTimeout(mountAll, 1500);
API.openPanel = openPanel; API.openGuide = openGuide; API.mount = mountAll;
document.addEventListener("click", function (e) { if (e.target.closest("#setb,.em-setb")) setTimeout(mountAll, 0); }, true);

function start() {
  if (!A.user()) return;
  addMenu();
  try { new MutationObserver(addMenu).observe(document.querySelector(".em-auth") || document.body, { childList: true, subtree: true }); } catch (e) {}
  if (!supported) return;
  register().catch(function () {});
  navigator.serviceWorker.addEventListener("message", function (e) {
    var d = e.data || {};
    if (d.type === "em-sound") ding();
    if (d.type === "em-resub" && ld("em_push_on") === "1") subscribe().catch(function () {});
  });
  /* keep this device's address fresh once per visit (also fixes a changed address) */
  if (Notification.permission === "granted" && ld("em_push_on") === "1" && !sessionStorage.getItem("em_push_sync")) {
    try { sessionStorage.setItem("em_push_sync", "1"); } catch (e) {}
    subscribe().catch(function () {});
  }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(start, 300); }); else setTimeout(start, 300);
})();
