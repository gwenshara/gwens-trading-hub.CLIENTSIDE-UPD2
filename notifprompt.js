/* First visit: a small "turn on notifications" prompt. Shown once per device (and once more right after the first login if they
   dismissed it while logged out). Loaded by auth.js on every page. Uses EMPush from push.js. */
(function(){
if(window.__emNP)return;window.__emNP=1;
var KEY="em_np_v1";
function ld(k){try{return localStorage.getItem(k)}catch(e){return null}}
function sv(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function user(){try{return !!(window.EMAuth&&EMAuth.configured&&EMAuth.user())}catch(e){return false}}
var tries=0;
function start(){
 var st=ld(KEY);
 if(st==="1")return;
 if(st==="lo"&&!user())return;
 if(!window.EMPush){if(++tries<20)return setTimeout(start,500);return}
 if(document.getElementById("em-warn")||document.getElementById("em-ren")||document.getElementById("em-np"))return;
 /* already decided in the browser: nothing to ask */
 if(window.Notification&&Notification.permission==="denied"){sv(KEY,"1");return}
 EMPush.state().then(function(s){
  if(s==="on"){sv(KEY,"1");return}
  show(s)}).catch(function(){})}
function show(state){
 var m=document.createElement("div");m.id="em-np";
 m.style.cssText="position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.5);display:grid;place-items:center;padding:16px";
 var ios=state==="ios-install",uns=state==="unsupported",lo=!user();
 var body=ios?"On iPhone/iPad, add the site to your Home Screen first (Share, then Add to Home Screen), then open it from there."
  :uns?"This browser can't show notifications."
  :"Get notified about messages, trades and middleman requests while you're away.";
 m.innerHTML='<div role="dialog" aria-modal="true" style="background:var(--b2,#232327);color:var(--text,#fff);border:1px solid var(--bl,#3a3a42);border-radius:14px;max-width:320px;width:100%;padding:18px;font-family:Montserrat,sans-serif;max-height:92vh;overflow:auto;box-shadow:0 8px 30px rgba(0,0,0,.45)">'
  +'<div style="font-weight:800;font-size:16px;text-align:center;margin-bottom:6px">Turn on notifications?</div>'
  +'<p style="margin:0 0 12px;line-height:1.45;font-weight:500;font-size:13px;text-align:center;opacity:.85">'+body+'</p>'
  +(ios||uns?'':'<p id="em-np-lo" style="margin:0 0 10px;text-align:center;font-size:12px;opacity:.65;display:'+(lo?"block":"none")+'">Log in first, then turn them on.</p>')
  +'<div id="em-np-e" style="color:#ff6b6b;font-size:12px;min-height:0;margin-bottom:6px;text-align:center"></div>'
  +(ios||uns?'':'<button id="em-np-y" type="button" style="width:100%;padding:10px;border:none;border-radius:10px;background:#ffb020;color:#1a1a1a;font:800 14px Montserrat,sans-serif;cursor:pointer">'+(lo?"OK, I'll log in first":"Turn on")+'</button>')
  +'<button id="em-np-n" type="button" style="width:100%;margin-top:8px;padding:8px;border:0;border-radius:10px;background:transparent;color:inherit;font:600 12px Montserrat,sans-serif;cursor:pointer;opacity:.7">'+(ios||uns?"Got it":"Maybe later")+'</button></div>';
 document.body.appendChild(m);
 var close=function(){sv(KEY,user()?"1":"lo");m.remove()};
 document.getElementById("em-np-n").onclick=close;
 var y=document.getElementById("em-np-y");
 if(y)y.onclick=function(){
  if(!user()){close();return}
  var e=document.getElementById("em-np-e");e.textContent="";y.disabled=true;y.textContent="Waiting for your browser\u2026";
  EMPush.enable().then(function(){sv(KEY,"1");y.textContent="\u2713 Notifications are on";y.style.background="#3bb26b";y.style.color="#fff";setTimeout(function(){m.remove()},1400)})
   .catch(function(x){y.disabled=false;y.textContent="Turn on";e.textContent=(x&&x.message)||"Couldn't turn them on."})}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(start,1500)});else setTimeout(start,1500);
})();
