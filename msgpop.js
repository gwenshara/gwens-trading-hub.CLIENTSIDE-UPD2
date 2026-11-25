/* New-message pop-up: while you are on the site, a small card appears at the bottom left with the
   sender's picture, their name and the message, then goes away after a few seconds.
   Loaded by auth.js on every page. Works for private, friends, trade, group and middleman chats. */
(function(){
if(window.__emPop)return;window.__emPop=1;
var A=null,UID=null,cD=null,cG=null,busy=false,prof={},gname={},dnd=false,box=null,POLL=5000,SHOW=6000;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function col(n){var h=0;n=String(n||"?");for(var i=0;i<n.length;i++)h=(h*31+n.charCodeAt(i))%360;return"hsl("+h+",55%,45%)"}
function okImg(u){return typeof u==="string"&&(/^data:image\//i.test(u)||/^https:\/\//i.test(u))}
function pretty(m){
 var t=String(m.text||""),k=m.kind||"text";
 if(k==="image")return"Sent a picture";
 if(k==="item")return"Shared an item";
 if(k==="mm")return"Sent a middleman request";
 if(k!=="text"&&k)return"Sent a message";
 if(/^\[\[st:[a-z]+[0-9]+\]\]$/.test(t))return"Sent a sticker";
 if(/^\[\[wl:/.test(t))return"Sent their wishlist";
 if(/^\[\[inv:/.test(t))return"Sent their inventory";
 if(/^\[\[ad:/.test(t))return"Shared a trade ad";
 if(/^\[\[/.test(t))return"Sent a message";
 t=t.replace(/\s+/g," ").trim();return t.length>110?t.slice(0,110)+"\u2026":t}
function ensureBox(){
 if(box&&document.body.contains(box))return box;
 var st=document.createElement("style");
 st.textContent="#em-pop{position:fixed;left:14px;bottom:14px;z-index:9998;display:flex;flex-direction:column-reverse;gap:10px;max-width:calc(100vw - 28px);pointer-events:none}"
 +".em-pp{pointer-events:auto;display:flex;gap:11px;align-items:center;width:340px;max-width:100%;box-sizing:border-box;padding:11px 14px 11px 11px;border-radius:16px;background:var(--b2,#232327);color:var(--text,#fff);border:1px solid var(--bl,#3a3a42);box-shadow:0 8px 26px rgba(0,0,0,.45);font-family:Montserrat,Nunito,sans-serif;cursor:pointer;position:relative;animation:empIn .28s ease-out}"
 +".em-pp.out{animation:empOut .3s ease-in forwards}"
 +".em-pp .pa{flex:none;width:46px;height:46px;border-radius:50%;overflow:hidden;display:grid;place-items:center;color:#fff;font-weight:800;font-size:19px}"
 +".em-pp .pa img{width:100%;height:100%;object-fit:cover;display:block}"
 +".em-pp .pt{min-width:0;flex:1}.em-pp .pn{font-weight:800;font-size:14px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
 +".em-pp .pn small{font-weight:600;opacity:.65;font-size:12px}"
 +".em-pp .pm{font-size:13.5px;line-height:1.3;margin-top:2px;opacity:.9;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}"
 +".em-pp .px{position:absolute;top:3px;right:6px;border:none;background:none;color:inherit;opacity:.45;font-size:15px;line-height:1;cursor:pointer;padding:2px 4px}.em-pp .px:hover{opacity:1}"
 +"@keyframes empIn{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}@keyframes empOut{to{opacity:0;transform:translateX(-24px)}}"
 +"@media (prefers-reduced-motion:reduce){.em-pp{animation:none}}";
 document.head.appendChild(st);
 box=document.createElement("div");box.id="em-pop";box.setAttribute("aria-live","polite");document.body.appendChild(box);return box}
function gone(el){if(!el||el.__g)return;el.__g=1;el.classList.add("out");setTimeout(function(){el.remove()},320)}
function toast(m,grp){
 var b=ensureBox(),p=prof[m.sender_id]||{},n=m.sender_name||p.username||"Someone";
 var sub=grp?' <small>in '+esc(gname[m.group_id]||"a group")+'</small>':(m.channel==="trade"?' <small>(trade)</small>':"");
 var url=grp?"forum-discussions.html?g="+encodeURIComponent(m.group_id):"forum-discussions.html?u="+encodeURIComponent(n)+(m.channel==="trade"?"&ch=trade":"");
 var el=document.createElement("div");el.className="em-pp";el.setAttribute("role","status");
 el.innerHTML='<span class="pa" style="background:#2a2a30"><img src="'+(okImg(p.avatar)?esc(p.avatar):emDefAv(n))+'" alt=""></span>'
  +'<div class="pt"><div class="pn">'+esc(n)+sub+'</div><div class="pm">'+esc(pretty(m))+'</div></div><button class="px" type="button" aria-label="Close">\u2715</button>';
 var tm=setTimeout(function(){gone(el)},SHOW);
 el.onmouseenter=function(){clearTimeout(tm)};el.onmouseleave=function(){tm=setTimeout(function(){gone(el)},2500)};
 el.onclick=function(e){if(e.target.closest(".px")){clearTimeout(tm);return gone(el)}location.href=url};
 b.appendChild(el);
 while(b.children.length>3)b.removeChild(b.firstChild)}
function viewing(m,grp){
 try{var c=window.EMCurChat&&window.EMCurChat();if(!c||document.hidden)return false;
  if(grp)return!!(c.grp&&c.id===m.group_id);
  return!c.grp&&c.id===m.sender_id&&((c.ch==="trade")===(m.channel==="trade"))}catch(e){return false}}
async function latest(tbl,flt){try{var r=await A.rest(tbl+"?select=created_at&"+flt+"&order=created_at.desc&limit=1");return r&&r[0]?r[0].created_at:new Date().toISOString()}catch(e){return new Date().toISOString()}}
async function baseline(){
 cD=await latest("dms","recipient_id=eq."+UID);
 cG=await latest("group_msgs","sender_id=neq."+UID+"&kind=neq.sys")}
async function who(ids){
 var need=ids.filter(function(i){return i&&!prof[i]});if(!need.length)return;
 try{var r=await A.rest("profiles?select=id,username,avatar&id=in.("+need.slice(0,20).join(",")+")");r.forEach(function(p){prof[p.id]=p});need.forEach(function(i){if(!prof[i])prof[i]={}})}catch(e){need.forEach(function(i){prof[i]={}})}}
async function names(ids){
 var need=ids.filter(function(i){return i&&!gname[i]});if(!need.length)return;
 try{var r=await A.rest("groups?select=id,name&id=in.("+need.slice(0,20).join(",")+")");r.forEach(function(g){gname[g.id]=g.name})}catch(e){}}
async function poll(){
 if(busy||document.hidden||!A||!A.user()||cD===null)return;busy=true;
 try{
  var d=await A.rest("dms?select=id,sender_id,sender_name,text,kind,channel,created_at&recipient_id=eq."+UID+"&created_at=gt."+encodeURIComponent(cD)+"&order=created_at.asc&limit=10").catch(function(){return[]});
  var g=await A.rest("group_msgs?select=id,group_id,sender_id,sender_name,text,kind,created_at&sender_id=neq."+UID+"&kind=neq.sys&created_at=gt."+encodeURIComponent(cG)+"&order=created_at.asc&limit=10").catch(function(){return[]});
  if(d.length)cD=d[d.length-1].created_at;if(g.length)cG=g[g.length-1].created_at;
  if(dnd)return;
  var items=[];d.forEach(function(m){if(!viewing(m,false))items.push([m,false])});g.forEach(function(m){if(m.sender_id!==UID&&!viewing(m,true))items.push([m,true])});
  if(!items.length)return;
  items=items.slice(-3);
  await Promise.all([who(items.map(function(x){return x[0].sender_id})),names(items.filter(function(x){return x[1]}).map(function(x){return x[0].group_id}))]);
  items.forEach(function(x){toast(x[0],x[1])})
 }catch(e){}finally{busy=false}}
function myStatus(){A.rest("profiles?id=eq."+encodeURIComponent(UID)+"&select=status").then(function(r){dnd=!!(r&&r[0]&&r[0].status==="dnd")}).catch(function(){})}
async function start(){
 if(!window.EMAuth||!EMAuth.configured||!EMAuth.user())return;A=EMAuth;UID=A.uid();if(!UID)return;
 await baseline();myStatus();
 setInterval(poll,POLL);setInterval(function(){if(!document.hidden)myStatus()},60000);
 /* coming back to the tab: whatever arrived while you were away was already sent as a push, so start fresh */
 document.addEventListener("visibilitychange",function(){if(!document.hidden){baseline();myStatus()}})}
function init(){setTimeout(start,1200)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
