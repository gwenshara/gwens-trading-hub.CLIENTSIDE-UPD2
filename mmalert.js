/* Middleman alert: when someone has asked YOU to be their middleman (both traders confirmed),
   a card stays on the right side of EVERY page until you accept, decline, it expires (10 min),
   or you press X. Loaded by auth.js on every page. Needs supabase-setup-9/16 (notifications). */
(function(){
if(window.__emMMA)return;window.__emMMA=1;
var A=null,UID=null,box=null,busy=false,off=false,POLL=6000,MMT=10*60*1000,KEY="em_mma_snooze",SNOOZE=2*60*1000,cards={};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function dis(){try{var o=JSON.parse(localStorage.getItem(KEY)||"{}");return o&&typeof o==="object"&&!Array.isArray(o)?o:{}}catch(e){return{}}}
function addDis(id){try{var d=dis(),k=Object.keys(d);k.forEach(function(x){if(d[x]<Date.now())delete d[x]});d[id]=Date.now()+SNOOZE;localStorage.setItem(KEY,JSON.stringify(d))}catch(e){}}
function left(n){return Math.max(1,Math.ceil((MMT-(Date.now()-Date.parse(n.created_at)))/6e4))}
function ensureBox(){
 if(box&&document.body.contains(box))return box;
 var st=document.createElement("style");
 st.textContent="#em-mma{position:fixed;right:14px;top:76px;z-index:9997;display:flex;flex-direction:column;gap:10px;width:330px;max-width:calc(100vw - 28px);pointer-events:none}"
 +".em-mm{pointer-events:auto;position:relative;box-sizing:border-box;padding:13px 34px 13px 14px;border-radius:16px;background:var(--b2,#232327);color:var(--text,#fff);border:2px solid #e0a43a;box-shadow:0 8px 26px rgba(0,0,0,.45);font-family:Montserrat,Nunito,sans-serif;animation:emmIn .3s ease-out}"
 +".em-mm.out{animation:emmOut .25s ease-in forwards}"
 +".em-mm.alert{animation:emmIn .3s ease-out,emmPulse 1.8s ease-in-out .3s infinite}.em-mm .mc{display:block;margin-top:8px;font-weight:800;font-size:12px;color:#ff9a3c}@keyframes emmPulse{0%,100%{box-shadow:0 8px 26px rgba(0,0,0,.45)}50%{box-shadow:0 0 0 4px rgba(224,164,58,.45),0 8px 26px rgba(0,0,0,.45)}}.em-mm .mh{font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:#e0a43a;margin-bottom:3px}"
 +".em-mm .mt{font-weight:700;font-size:14px;line-height:1.35;overflow-wrap:anywhere}"
 +".em-mm .mg{margin-top:8px;display:flex;flex-direction:column;gap:5px}"
 +".em-mm .mg div{padding:6px 9px;border-radius:9px;background:rgba(0,0,0,.22);border:1px solid var(--bl,#3a3a42)}"
 +".em-mm .mg small{display:block;font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:.06em;opacity:.65}"
 +".em-mm .mg span{display:block;font-weight:700;font-size:13px;line-height:1.35;overflow-wrap:anywhere;white-space:pre-wrap}"
 +".em-mm .mb{display:block;margin-top:10px;width:100%;padding:9px;border:0;border-radius:10px;background:#7aa7ff;color:#fff;font:800 13px Montserrat,sans-serif;cursor:pointer;text-align:center;text-decoration:none;box-sizing:border-box}.em-mm .mb:hover{filter:brightness(1.1)}"
 +".em-mm .mx{position:absolute;top:6px;right:8px;width:26px;height:26px;border:0;border-radius:50%;background:transparent;color:inherit;opacity:.6;font-size:16px;line-height:1;cursor:pointer}.em-mm .mx:hover{opacity:1;background:rgba(255,255,255,.1)}"
 +"@keyframes emmIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}@keyframes emmOut{to{opacity:0;transform:translateX(30px)}}"
 +"@media (max-width:600px){#em-mma{top:auto;bottom:80px}}@media (prefers-reduced-motion:reduce){.em-mm,.em-mm.alert{animation:none}}";
 document.head.appendChild(st);
 box=document.createElement("div");box.id="em-mma";box.setAttribute("aria-live","polite");document.body.appendChild(box);return box}
function gone(id){var el=cards[id];if(!el)return;delete cards[id];el.classList.add("out");setTimeout(function(){el.remove()},260)}
function show(n){
 var p=n.payload||{},b=ensureBox(),el=document.createElement("div");el.className="em-mm alert";el.setAttribute("role","status");
 var tr="";if(p.give||p.get)tr='<div class="mg"><div><small>'+esc(p.an||"Trader 1")+' gives</small><span>'+esc(p.give||"\u2014")+'</span></div><div><small>'+esc(p.bn||"Trader 2")+' gives</small><span>'+esc(p.get||"\u2014")+'</span></div></div>';
 el.innerHTML='<button class="mx" type="button" aria-label="Close">\u2715</button><div class="mh">Middleman request \u2013 don\'t forget to answer</div><div class="mt">'+esc(n.text)+'</div>'+tr+'<span class="mc">Only <span data-left>'+left(n)+'</span> min left to accept or decline</span><a class="mb" href="forum-discussions.html">Open requests</a>';
 el.querySelector(".mx").onclick=function(){addDis(n.id);gone(n.id)};
 cards[n.id]=el;b.appendChild(el)}
async function poll(){
 if(busy||off||document.hidden||!A||!A.user())return;busy=true;
 try{
  var r=await A.rest("notifications?select=id,text,payload,created_at&kind=eq.mm&order=created_at.desc&limit=10");
  var d=dis(),live={};
  (r||[]).forEach(function(n){
   if(Date.now()-Date.parse(n.created_at)>=MMT)return;
   live[n.id]=1;var c=cards[n.id];if(c){var q=c.querySelector("[data-left]");if(q)q.textContent=left(n);return}if(d[n.id]>Date.now())return;show(n)});
  Object.keys(cards).forEach(function(id){if(!live[id])gone(id)})
 }catch(e){if(/notifications|relation|schema cache|does not exist|42P01|PGRST/i.test(String(e&&e.message)))off=true}
 finally{busy=false}}
function start(){
 if(!window.EMAuth||!EMAuth.configured||!EMAuth.user())return;A=EMAuth;UID=A.uid();if(!UID)return;
 poll();setInterval(poll,POLL);
 document.addEventListener("visibilitychange",function(){if(!document.hidden)poll()})}
function init(){setTimeout(start,1500)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
