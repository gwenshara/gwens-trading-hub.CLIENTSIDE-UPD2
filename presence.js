/* Online status + roles. Loaded by auth.js on every page. */
(function(){
if(window.EMPresence)return;
var ROLES={official_middleman:{n:"Official Middleman",c:"#8b4dff"},moderator:{n:"Moderator",c:"#2e8bff"},donator:{n:"Donator",c:"#ff5fa2"},top_trader:{n:"Top Trader",c:"#e8b422"},tester:{n:"Tester",c:"#1fc2a5"},value_handler:{n:"Value Handler",c:"#ff8a3d"}};
var ST={online:{n:"Online",c:"#3bb26b"},idle:{n:"Idle",c:"#f0b232"},dnd:{n:"Do not disturb",c:"#e5484d"},offline:{n:"Offline",c:"#80848e"}};
var FRESH=150000; /* seen within 2.5 minutes = connected */
function eff(r){var t=r&&r.last_seen?Date.parse(r.last_seen):0;if(!t||Date.now()-t>FRESH)return"offline";return r.status||"online"}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function dot(r){var s=eff(r);return '<i class="em-dot" title="'+ST[s].n+'" style="background:'+ST[s].c+'"></i>'}
function tags(r){return((r&&r.roles)||[]).filter(function(k){return ROLES[k]}).map(function(k){return '<i class="em-role" style="--rc:'+ROLES[k].c+'">'+ROLES[k].n+'</i>'}).join("")}
var css=document.createElement("style");
css.textContent=".em-dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--b1,#1c1c1f);box-sizing:content-box;vertical-align:middle}"
+".em-avd{position:relative;display:inline-block}.em-avd>.em-dot{position:absolute;right:-1px;bottom:-1px;width:13px;height:13px}"
+".em-role{display:inline-block;font:800 10px Montserrat,sans-serif;font-style:normal;color:var(--rc);border:1.5px solid var(--rc);background:color-mix(in srgb,var(--rc) 16%,transparent);border-radius:999px;padding:2px 8px;margin:2px 4px 2px 0;white-space:nowrap}"
+".em-roles{display:flex;flex-wrap:wrap;margin-top:6px}"
+".em-stm{position:relative;display:inline-block;margin-top:6px}.em-stb{display:inline-flex;align-items:center;gap:8px;background:var(--b3,#2a2a30);color:var(--text,#fff);border:1px solid var(--bl,#3a3a42);border-radius:999px;padding:5px 12px;font:700 13px Montserrat,sans-serif;cursor:pointer}"
+".em-stp{position:absolute;left:0;top:calc(100% + 4px);z-index:20;background:var(--b2,#232327);border:1px solid var(--bl,#3a3a42);border-radius:12px;padding:5px;min-width:190px}.em-stp button{display:flex;align-items:center;gap:10px;width:100%;background:none;border:none;color:var(--text,#fff);font:700 13px Montserrat,sans-serif;padding:8px 10px;border-radius:8px;cursor:pointer;text-align:left}.em-stp button:hover{background:var(--b3,#2a2a30)}"
+".em-rle{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}.em-rle label{display:flex;align-items:center;gap:6px;font:700 12px Montserrat,sans-serif;cursor:pointer}";
document.head.appendChild(css);
function beat(s){if(!window.EMAuth||!EMAuth.configured||!EMAuth.user())return Promise.resolve();return EMAuth.rest("rpc/set_presence","POST",s?{s:s}:{}).catch(function(){})}
var P=window.EMPresence={ROLES:ROLES,STATUS:ST,eff:eff,dot:dot,tags:tags,esc:esc,beat:beat};
function start(){beat();setInterval(function(){if(!document.hidden)beat()},60000);document.addEventListener("visibilitychange",function(){if(!document.hidden)beat()})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
