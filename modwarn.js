/* Shows a moderator's warning to the person it was sent to. Loaded by auth.js on every page. */
(function(){
if(window.__emWarn)return;window.__emWarn=1;
var busy=false;
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function show(list){
 if(document.getElementById("em-warn"))return;
 var m=document.createElement("div");m.id="em-warn";
 m.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:grid;place-items:center;padding:16px";
 m.innerHTML='<div role="alertdialog" aria-modal="true" style="background:var(--b2,#232327);color:var(--text,#fff);border:2px solid #e5484d;border-radius:16px;max-width:420px;width:100%;padding:22px;font-family:Montserrat,sans-serif;max-height:90vh;overflow:auto">'
  +'<div style="font-weight:800;font-size:20px;color:#ff6b6b;margin-bottom:10px">\u26A0 Warning from a moderator</div>'
  +list.map(function(w){return '<p style="margin:0 0 12px;line-height:1.5;font-weight:600;overflow-wrap:anywhere">'+esc(w.text)+'</p>'}).join("")
  +'<button id="em-warn-ok" type="button" style="width:100%;margin-top:6px;padding:12px;border:none;border-radius:10px;background:#e5484d;color:#fff;font:800 15px Montserrat,sans-serif;cursor:pointer">I understand</button></div>';
 document.body.appendChild(m);
 document.getElementById("em-warn-ok").onclick=function(){
  EMAuth.rest("rpc/ack_warnings","POST",{}).catch(function(){}).then(function(){m.remove();checkRename()})}}
function rename(){
 if(document.getElementById("em-ren"))return;
 var m=document.createElement("div");m.id="em-ren";
 m.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.8);display:grid;place-items:center;padding:16px";
 m.innerHTML='<div role="dialog" aria-modal="true" style="background:var(--b2,#232327);color:var(--text,#fff);border:2px solid #e5484d;border-radius:16px;max-width:420px;width:100%;padding:22px;font-family:Montserrat,sans-serif">'
  +'<div style="font-weight:800;font-size:20px;margin-bottom:8px">Choose a new username</div>'
  +'<p style="margin:0 0 12px;line-height:1.5;font-size:14px">A moderator reset your username. Pick a new one to keep using the site. 3\u201320 letters, numbers or _.</p>'
  +'<input id="em-ren-i" maxlength="20" placeholder="New username" autocomplete="off" style="width:100%;box-sizing:border-box;padding:11px;border-radius:10px;border:1px solid var(--bl,#3a3a42);background:var(--b3,#2a2a30);color:var(--text,#fff);font:600 15px Montserrat,sans-serif">'
  +'<div id="em-ren-e" style="color:#ff6b6b;font-size:13px;min-height:18px;margin:6px 0"></div>'
  +'<button id="em-ren-b" type="button" style="width:100%;padding:12px;border:none;border-radius:10px;background:#e5484d;color:#fff;font:800 15px Montserrat,sans-serif;cursor:pointer">Save username</button></div>';
 document.body.appendChild(m);
 var go=function(){var b=document.getElementById("em-ren-b"),e=document.getElementById("em-ren-e");e.textContent="";b.disabled=true;
  EMAuth.rest("rpc/set_username","POST",{n:document.getElementById("em-ren-i").value}).then(function(){location.reload()})
   .catch(function(x){e.textContent=x.message;b.disabled=false})};
 document.getElementById("em-ren-b").onclick=go;
 document.getElementById("em-ren-i").onkeydown=function(e){if(e.key==="Enter")go()}}
function checkRename(){
 EMAuth.rest("profiles?id=eq."+encodeURIComponent(EMAuth.uid())+"&select=must_rename").then(function(r){if(r&&r[0]&&r[0].must_rename)rename()}).catch(function(){})}
function check(){
 if(busy||!window.EMAuth||!EMAuth.configured||!EMAuth.user())return;busy=true;
 /* only MY warnings: admins and moderators can read everybody's, so the filter is needed */
 EMAuth.rest("mod_warnings?select=id,text&user_id=eq."+encodeURIComponent(EMAuth.uid())+"&seen_at=is.null&order=created_at.asc&limit=5")
  .then(function(r){if(r&&r.length)show(r);else checkRename()}).catch(function(){}).then(function(){busy=false})}
function start(){setTimeout(check,800);document.addEventListener("visibilitychange",function(){if(!document.hidden)check()});setInterval(function(){if(!document.hidden)check()},60000)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
