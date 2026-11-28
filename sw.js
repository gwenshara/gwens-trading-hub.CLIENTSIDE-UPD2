self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: "EM Wiki", body: e.data ? e.data.text() : "" }; }
  e.waitUntil((async function () {
    var wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    var test = d.kind === "test";
    if (!test && wins.some(function (c) { return c.visibilityState === "visible" && c.focused; })) return;
    wins.forEach(function (c) { try { c.postMessage({ type: "em-sound" }); } catch (_) {} });
    var icon = "icon-192.png";
    if (d.icon) {
      try {
        var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 2500);
        var r = await fetch(d.icon, { signal: ctl.signal }); clearTimeout(tm);
        if (r.ok) icon = d.icon;
      } catch (_) {}
    }
    await self.registration.showNotification(d.title || "EM Wiki", {
      body: d.body || "",
      tag: d.tag || "em",
      renotify: true,
      icon: icon,
      badge: "icon-192.png",
      vibrate: [120, 60, 120],
      data: { url: d.url || "forum-discussions.html" }
    });
  })());
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "forum-discussions.html", self.registration.scope).href;
  var page = function (u) { return u.split("#")[0].split("?")[0]; };
  e.waitUntil((async function () {
    var wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    var same = wins.find(function (c) { return page(c.url) === page(url); }) || wins[0];
    if (same) {
      try { await same.focus(); if (same.url !== url) await same.navigate(url); return; } catch (_) {}
    }
    await self.clients.openWindow(url);
  })());
});

self.addEventListener("pushsubscriptionchange", function () {
  self.clients.matchAll({ includeUncontrolled: true }).then(function (cl) {
    cl.forEach(function (c) { c.postMessage({ type: "em-resub" }); });
  });
});
