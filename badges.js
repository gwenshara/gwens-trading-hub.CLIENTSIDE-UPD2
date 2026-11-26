/* Red number badges on the menu: Catalog / Trade / Forum / Log Update, and on the Forum cards. */
(function(){
if(window.__emBadges)return;window.__emBadges=1;
var CFG=window.EM_SUPABASE||{},A=window.EMAuth;
if(!CFG.url||!CFG.anonKey||/YOUR-/.test(CFG.url+CFG.anonKey))return;
var ME=A&&A.user&&A.user(),UID=A&&A.uid&&A.uid();
var path=(location.pathname.split("/").pop()||"index.html").toLowerCase();
var here=/^(catalog|page\d)\.html$/.test(path)?"cat":path==="trade.html"?"trade":path==="log.html"?"log":path==="forum-voting.html"?"vote":path==="forum-discussions.html"?"dm":"";
var KEY=function(n){return"nb_seen_"+n};
function ld(k){try{return localStorage.getItem(k)}catch(e){return null}}
function sv(k,v){try{localStorage.setItem(k,v)}catch(e){}}
var st=document.createElement("style");
st.textContent=".nb{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#e5484d;color:#fff;font:800 11px/18px Montserrat,Inter,system-ui,sans-serif;text-align:center;font-style:normal;pointer-events:none;box-sizing:border-box;z-index:5}nav a{position:relative}.fc .nb{top:14px;right:14px;min-width:24px;height:24px;line-height:24px;font-size:13px}";
document.head.appendChild(st);
async function get(path){
  var h={apikey:CFG.anonKey},tok=null;
  try{tok=A&&A.token?await A.token():null}catch(e){}
  if(tok)h.Authorization="Bearer "+tok;
  var r=await fetch(CFG.url.replace(/\/$/,"")+"/rest/v1/"+path,{headers:h});
  if(!r.ok)throw new Error(r.status);return r.json()}
async function latest(table){var r=await get(table+"?select=created_at&order=created_at.desc&limit=1");return r[0]?r[0].created_at:new Date().toISOString()}
async function since(table,name,mine){
  var s=ld(KEY(name));
  if(!s){try{sv(KEY(name),await latest(table))}catch(e){}return 0}
  var q=table+"?select=id&created_at=gt."+encodeURIComponent(s)+(mine&&ME?"&"+mine+"=neq."+encodeURIComponent(ME):"")+"&limit=100";
  return(await get(q)).length}
async function seenNow(table,name){try{sv(KEY(name),await latest(table))}catch(e){}}
function put(sel,n){
  document.querySelectorAll(sel).forEach(function(el){
    var b=el.querySelector(":scope > .nb");
    if(!n){if(b)b.remove();return}
    if(!b){b=document.createElement("i");b.className="nb";b.setAttribute("aria-label","new");el.appendChild(b)}
    b.textContent=n>99?"99+":n})}
function dmKey(){return"nb_dm_"+UID}
function dmDismiss(){sv(dmKey(),new Date().toISOString())}
async function dmCount(){
  if(!UID)return 0;var n=0;
  if(here==="dm")dmDismiss();
  var d=ld(dmKey()),gt=d?"&created_at=gt."+encodeURIComponent(d):"";
  try{n+=(await get("dms?select=id&recipient_id=eq."+UID+"&read_at=is.null"+gt+"&limit=100")).length}catch(e){}
  try{n+=(await get("friendships?select=id&addressee_id=eq."+UID+"&status=eq.pending"+gt+"&limit=50")).length}catch(e){}
  try{n+=(await get("notifications?select=id"+gt+"&limit=50")).length}catch(e){}
  return n}
async function run(){
  var out={cat:0,log:0,trade:0,vote:0,dm:0};
  try{
    if(here==="cat")await seenNow("site_log","cat");else out.cat=await since("site_log","cat","username");
    if(here==="log")await seenNow("site_log","log");else out.log=await since("site_log","log","username");
  }catch(e){}
  if(UID){
    try{if(here==="trade")await seenNow("ads","trade");else out.trade=await since("ads","trade","username")}catch(e){}
    try{if(here==="vote")await seenNow("polls","vote");else out.vote=await since("polls","vote","username")}catch(e){}
    out.dm=await dmCount();
  }
  put('nav a[href="catalog.html"]',out.cat);
  put('nav a[href="log.html"]',out.log);
  put('nav a[href="trade.html"]',out.trade);
  put('nav a[href="forum.html"]',out.vote+out.dm);
  put('.fc[href="forum-discussions.html"]',out.dm);
  put('.fc[href="forum-voting.html"]',out.vote);
}
/* clicking a category card makes its red number go away right away */
document.addEventListener("click",function(e){
  var c=e.target.closest&&e.target.closest(".fc");if(!c)return;
  var h=c.getAttribute("href")||"";
  if(h==="forum-discussions.html"&&UID){dmDismiss();put('.fc[href="forum-discussions.html"]',0)}
  else if(h==="forum-voting.html")put('.fc[href="forum-voting.html"]',0);
},true);
function go(){run().catch(function(){})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();
setInterval(function(){if(!document.hidden)go()},30000);
document.addEventListener("visibilitychange",function(){if(!document.hidden)go()});
})();
