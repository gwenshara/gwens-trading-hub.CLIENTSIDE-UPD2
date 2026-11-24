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
  EMAuth.rest("rpc/ack_warnings","POST",{}).catch(function(){}).then(function(){m.remove()})}}
function check(){
 if(busy||!window.EMAuth||!EMAuth.configured||!EMAuth.user())return;busy=true;
 EMAuth.rest("mod_warnings?select=id,text&seen_at=is.null&order=created_at.asc&limit=5")
  .then(function(r){if(r&&r.length)show(r)}).catch(function(){}).then(function(){busy=false})}
function start(){setTimeout(check,800);document.addEventListener("visibilitychange",function(){if(!document.hidden)check()});setInterval(function(){if(!document.hidden)check()},60000)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
