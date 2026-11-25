/* First visit: a big "turn on notifications" warning. Shown once per device (and once more right after the first login if they
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
 m.style.cssText="position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.78);display:grid;place-items:center;padding:16px";
 var ios=state==="ios-install",uns=state==="unsupported",lo=!user();
 var body=ios?"On iPhone and iPad you first have to <b>add the site to your Home Screen</b>: tap the Share button, choose <b>Add to Home Screen</b>, then open EM Wiki from that icon and turn notifications on there."
  :uns?"This browser can't show notifications. Use Chrome, Edge or Firefox on a computer or Android phone to get them."
  :"Without notifications you will <b>miss messages, trade chats, middleman requests and value votes</b> while you are away from the site. People may think you are ignoring them.";
 m.innerHTML='<div role="alertdialog" aria-modal="true" style="background:var(--b2,#232327);color:var(--text,#fff);border:3px solid #ffb020;border-radius:18px;max-width:440px;width:100%;padding:24px;font-family:Montserrat,sans-serif;max-height:92vh;overflow:auto;box-shadow:0 0 40px rgba(255,176,32,.25)">'
  +'<div style="font-size:44px;line-height:1;text-align:center">\u26A0\uFE0F</div>'
  +'<div style="font-weight:800;font-size:13px;letter-spacing:.12em;color:#ffb020;text-align:center;margin:8px 0 4px">VERY IMPORTANT</div>'
  +'<div style="font-weight:800;font-size:22px;text-align:center;margin-bottom:12px">Turn on notifications</div>'
  +'<p style="margin:0 0 14px;line-height:1.55;font-weight:600;font-size:14px;text-align:center">'+body+'</p>'
  +(ios||uns?'':'<p id="em-np-lo" style="margin:0 0 12px;text-align:center;font-size:13px;opacity:.8;display:'+(lo?"block":"none")+'">You need an account for this. Log in or sign up (top left), then press the button.</p>')
  +'<div id="em-np-e" style="color:#ff6b6b;font-size:13px;min-height:18px;margin-bottom:8px;text-align:center"></div>'
  +(ios||uns?'':'<button id="em-np-y" type="button" style="width:100%;padding:14px;border:none;border-radius:12px;background:#ffb020;color:#1a1a1a;font:800 16px Montserrat,sans-serif;cursor:pointer">'+(lo?"OK, I'll log in first":"Turn on notifications")+'</button>')
  +'<button id="em-np-n" type="button" style="width:100%;margin-top:10px;padding:11px;border:1px solid var(--bl,#3a3a42);border-radius:12px;background:transparent;color:inherit;font:700 13px Montserrat,sans-serif;cursor:pointer;opacity:.85">'+(ios||uns?"Got it":"Maybe later")+'</button>'
  +'<p style="margin:12px 0 0;text-align:center;font-size:12px;opacity:.6">You can change this anytime in \u2699 Settings, then Notifications.</p></div>';
 document.body.appendChild(m);
 var close=function(){sv(KEY,user()?"1":"lo");m.remove()};
 document.getElementById("em-np-n").onclick=close;
 var y=document.getElementById("em-np-y");
 if(y)y.onclick=function(){
  if(!user()){close();return}
  var e=document.getElementById("em-np-e");e.textContent="";y.disabled=true;y.textContent="Waiting for your browser\u2026";
  EMPush.enable().then(function(){sv(KEY,"1");y.textContent="\u2713 Notifications are on";y.style.background="#3bb26b";y.style.color="#fff";setTimeout(function(){m.remove()},1400)})
   .catch(function(x){y.disabled=false;y.textContent="Turn on notifications";e.textContent=(x&&x.message)||"Couldn't turn them on."})}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(start,1500)});else setTimeout(start,1500);
})();
