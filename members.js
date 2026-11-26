const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const grid=$("#mb"),note=$("#mb-n"),mo=$("#mb-mo"),card=$("#mb-card"),q=$("#mb-q");
let M=[],ADS=[],hideB=false;
const color=n=>{let h=0;for(const c of n.toLowerCase())h=(h*31+c.charCodeAt(0))%360;return "hsl("+h+",55%,45%)"};
const PR=window.EMPresence;
const av0=(n,u)=>u?'<span class="mb-av has"><img src="'+esc(u)+'" alt=""></span>':'<span class="mb-av has"><img src="'+emDefAv(n)+'" alt=""></span>';
const av=(n,u,m)=>PR&&m?'<span class="em-avd">'+av0(n,u)+PR.dot(m)+'</span>':av0(n,u);
const day=t=>new Date(t).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
const names=L=>(L||[]).map(e=>esc(e.n)+(e.q>1?" ×"+e.q:"")).join(", ")||"–";
(function(){const s=document.createElement("style");s.textContent=".mb-cat{grid-column:1/-1;margin:22px 0 4px;display:flex;align-items:center;gap:10px;font:800 13px Montserrat,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}.mb-cat:first-child{margin-top:4px}.mb-cat i{font-style:normal;width:10px;height:10px;border-radius:50%;background:var(--rc,#8a8a93)}.mb-cat b{font-weight:700;opacity:.7}.mb-t.bn{opacity:.5}.mb-hb{padding:3px 10px;border-radius:999px;border:1px solid var(--bl,#333);background:transparent;color:var(--text);font:700 11px Montserrat,sans-serif;cursor:pointer;text-transform:none;letter-spacing:0}.mb-cat:after{content:'';flex:1;height:1px;background:var(--bl,#333)}";document.head.appendChild(s)})();
const tile=m=>'<button class="mb-t'+(m.banned?" bn":"")+'" data-u="'+esc(m.username)+'">'+av(m.username,m.avatar,m)+'<span class="nm">'+esc(m.nick||m.username)+'</span></button>';
function groups(L){
 /* a member is listed once, under the first category that applies: Admin, then the roles in order, then Members */
 const keys=PR&&PR.ROLES?Object.keys(PR.ROLES):[],G=[{n:"Admin",c:"#ff4d4d",L:[]}].concat(keys.map(k=>({n:PR.ROLES[k].n,c:PR.ROLES[k].c,k,L:[]}))),rest={n:"Members",c:"#8a8a93",L:[]};
 const bans=[];L.forEach(m=>{if(m.banned){bans.push(m);return}if(m.role==="admin"){G[0].L.push(m);return}
  const g=G.find(g=>g.k&&(m.roles||[]).includes(g.k));(g||rest).L.push(m)});
 const out=G.concat(rest).filter(g=>g.L.length);if(bans.length)out.push({n:"Banned",c:"#e5484d",L:bans,ban:true});return out}
function draw(){
 const f=q.value.trim().toLowerCase(),L=M.filter(m=>!f||m.username.toLowerCase().includes(f)||(m.nick||"").toLowerCase().includes(f));
 const nb=M.filter(m=>m.banned).length,na=M.length-nb;note.textContent=na+(na===1?" member":" members")+" so far. Click one to open their profile.";
 grid.innerHTML=L.length?groups(L).map(g=>'<div class="mb-cat" style="--rc:'+g.c+'"><i></i>'+esc(g.n)+' <b>'+g.L.length+'</b>'+(g.ban?'<button type="button" class="mb-hb" data-hb>'+(hideB?"Show":"Hide")+'</button>':"")+'</div>'+(g.ban&&hideB?"":g.L.map(tile).join(""))).join(""):'<div class="mb-empty">No member found.</div>'}
function open(u){
 const m=M.find(x=>x.username===u);if(!m)return;
 const mine=ADS.filter(a=>a.username===m.username),idx=M.indexOf(m)+1;
 card.innerHTML='<button class="mb-x" aria-label="Close">\u2715</button><div class="mb-top">'+av(m.username,m.avatar,m)+'<h3>'+esc(m.nick||m.username)+(m.role==="admin"?'<i class="mb-ad">ADMIN</i>':"")+'</h3>'+(PR?'<div class="em-roles" style="justify-content:center">'+PR.tags(m)+'</div>':"")+'<small>'+(m.role==="admin"?"Moderator":"Member")+' of EM Wiki</small></div>'
 +'<div class="mb-st"><div><b>#'+idx+'</b><span>Member number</span></div><div><b>'+mine.length+'</b><span>Trade ads posted</span></div><div style="grid-column:1/-1"><b style="font-size:15px">'+esc(day(m.t))+'</b><span>Joined</span></div></div>'
 +'<h4>Latest trade ads</h4><div class="mb-ads">'+(mine.length?mine.slice(0,5).map(a=>'<div><em>'+ago(a.t)+'</em>Offering: '+names(a.a)+'<br>Looking for: '+names(a.b)+(a.note?'<br><em>'+esc(a.note)+'</em>':"")+'</div>').join(""):'<div>No trade ads yet.</div>')+'</div>'
 +(mine.length?'<p style="margin:12px 0 0;font-size:13px"><a href="trade.html" style="color:var(--accent);font-weight:700">See all ads in the Trade Hub</a></p>':"");
 decorate(m);mo.hidden=false;document.body.style.overflow="hidden"}
async function decorate(m){
 const bn=document.createElement("div");bn.className="mb-bn";bn.style.background="linear-gradient(120deg,"+color(m.username)+",#2a2a30)";card.insertBefore(bn,card.firstChild);
 const soc=document.createElement("div");soc.style.padding="0 4px";const st=card.querySelector(".mb-st");if(st)st.parentNode.insertBefore(soc,st);if(window.EMSocial)EMSocial.mount(soc,m.id,m.username);
 const top=card.querySelector(".mb-top");if(top)top.insertAdjacentHTML("afterend",'<p class="mb-bio" hidden></p><p style="text-align:center;margin:8px 0 0;font-size:13px"><a href="profile.html?u='+encodeURIComponent(m.username)+'" style="color:var(--accent);font-weight:700">Open full profile</a></p>');
 try{let r;try{r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(m.username)+"&select=banner,bio,discord,discord_verified"))[0]||{}}catch(e0){r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(m.username)+"&select=banner,bio"))[0]||{}}
  if(r.banner)bn.style.cssText="background:url("+r.banner+") center/cover";
  const b=card.querySelector(".mb-bio");if(b&&r.bio){b.textContent=r.bio;b.hidden=false}
  if(r.discord&&top)top.insertAdjacentHTML("afterend",'<p style="text-align:center;margin:8px 0 0;font-size:13px">Discord: <b>@'+esc(r.discord)+'</b> <i style="font-style:normal;font-weight:800;font-size:11px;padding:2px 8px;border-radius:999px;background:'+(r.discord_verified?"#1f7a46;color:#fff":"#6b5a1f;color:#ffe9a3")+'">'+(r.discord_verified?"Verified":"Not verified")+"</i></p>")}catch(e){}}
function close(){mo.hidden=true;document.body.style.overflow=""}
grid.addEventListener("click",e=>{if(e.target.closest("[data-hb]")){hideB=!hideB;draw();return}const b=e.target.closest("[data-u]");if(b)open(b.dataset.u)});
mo.addEventListener("click",e=>{if(e.target===mo||e.target.closest(".mb-x"))close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!mo.hidden)close()});
q.addEventListener("input",draw);
async function load(){
 if(!window.EMAuth||!EMAuth.configured){note.textContent="";grid.innerHTML='<div class="mb-empty">The accounts server isn\'t set up yet, see SETUP.md.</div>';return}
 if(!EMAuth.user()){note.textContent="";grid.innerHTML='<div class="mb-empty">Log in (top left) to see the members.</div>';return}
 try{
  let p;try{p=await EMAuth.rest("profiles?select=id,username,role,created_at,avatar,nickname&order=created_at.asc&limit=1000")}catch(e){p=await EMAuth.rest("profiles?select=id,username,role,created_at,avatar&order=created_at.asc&limit=1000")}
  let pr={};try{(await EMAuth.rest("profiles?select=id,status,last_seen,roles&limit=1000")).forEach(x=>pr[x.id]=x)}catch(e){}
  M=p.map(r=>({id:r.id,username:r.username,role:r.role,avatar:r.avatar||"",nick:r.nickname||"",t:Date.parse(r.created_at),status:(pr[r.id]||{}).status,last_seen:(pr[r.id]||{}).last_seen,roles:(pr[r.id]||{}).roles||[]}));
  try{ADS=(await EMAuth.rest("ads?select=username,offering,looking,note,created_at&order=created_at.desc&limit=500")).map(r=>({username:r.username,a:r.offering||[],b:r.looking||[],note:r.note||"",t:Date.parse(r.created_at)}))}catch(e){ADS=[]}
  if(EMAuth.isAdmin&&EMAuth.isAdmin()){try{const A=await EMAuth.rest("rpc/staff_accounts","POST",{}),bs=new Set(A.filter(a=>a.banned).map(a=>a.id));M.forEach(m=>{if(bs.has(m.id))m.banned=true})}catch(e){}}
  draw()}
 catch(e){note.textContent="";grid.innerHTML='<div class="mb-empty">Couldn\'t load the members: '+esc(e.message)+'</div>'}}
grid.innerHTML='<div class="mb-empty">Loading…</div>';load();

/* STAFF (admins + moderators): every account with the IP it was made from, and a multi-select ban.
   Banning only bans the accounts, so the slots of that IP (max 3 accounts) are free again. */
(function(){
 if(!window.EMAuth||!EMAuth.configured||!EMAuth.user||!EMAuth.user()||!EMAuth.canMod||!EMAuth.canMod())return;
 const h=document.querySelector(".mb-h");if(!h)return;
 const ME=EMAuth.uid&&EMAuth.uid(),IS_ADMIN=EMAuth.isAdmin&&EMAuth.isAdmin();
 const btn=document.createElement("button");btn.type="button";btn.textContent="Staff: IPs & bulk ban";
 btn.style.cssText="padding:9px 14px;border-radius:8px;font:700 13px Montserrat,sans-serif;cursor:pointer;background:#e5484d;border:1px solid #e5484d;color:#fff";h.appendChild(btn);
 const box=document.createElement("div");box.hidden=true;box.style.cssText="margin:0 0 18px;padding:14px;border:1px solid #e5484d;border-radius:12px;background:var(--b3);font-family:Montserrat,sans-serif";
 h.parentNode.insertBefore(box,document.getElementById("mb-n"));
 let A=null,err="",msg="",flt="",hideBanned=false;const sel=new Set();
 const inp="padding:8px 12px;border-radius:8px;border:1px solid var(--bl);background:var(--b1);color:var(--text);font:600 13px Montserrat,sans-serif";
 const B="padding:8px 14px;border-radius:8px;font:700 13px Montserrat,sans-serif;cursor:pointer;border:1px solid var(--bl);background:var(--b1);color:var(--text)";
 const canBan=a=>!a.banned&&a.role!=="admin"&&a.id!==ME&&!((a.roles||[]).includes("moderator")&&!IS_ADMIN);
 const setup=e=>/does not exist|schema cache|Could not find/i.test(e.message)?"Run supabase-setup-33.sql and supabase-setup-34.sql in Supabase first.":e.message;
 async function load(){err="";try{A=await EMAuth.rest("rpc/staff_accounts","POST",{})}catch(e){A=[];err=setup(e)}render()}
 function render(){
  if(A===null){box.innerHTML='<p style="margin:0">Loading\u2026</p>';return}
  const f=flt.toLowerCase(),L=A.filter(a=>(!hideBanned||!a.banned)&&(!f||a.username.toLowerCase().includes(f)||(a.signup_ip||"").includes(f)||(a.last_ip||"").includes(f)));
  const G=new Map();L.forEach(a=>{const k=a.signup_ip||"unknown";if(!G.has(k))G.set(k,[]);G.get(k).push(a)});
  const used=k=>A.filter(a=>(a.signup_ip||"unknown")===k&&!a.banned).length;
  const keys=[...G.keys()].sort((x,y)=>(x==="unknown")-(y==="unknown")||G.get(y).length-G.get(x).length||x.localeCompare(y));
  const row=a=>'<label style="display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;padding:6px 0;border-top:1px solid var(--bl);font-size:13px'+(a.banned?";opacity:.55":"")+'"><input type="checkbox" data-s="'+esc(a.username)+'"'+(sel.has(a.username)?" checked":"")+(canBan(a)?"":" disabled")+'>'
   +'<a href="profile.html?u='+encodeURIComponent(a.username)+'" style="color:inherit;font-weight:700">'+esc(a.username)+'</a>'
   +(a.role==="admin"?'<i class="mb-ad">ADMIN</i>':(a.roles||[]).includes("moderator")?'<i class="mb-ad" style="background:#2f6fd1">MOD</i>':"")
   +(a.banned?'<i class="mb-ad" style="background:#555">BANNED</i>':"")+(a.banned?'<button type="button" data-ub="'+esc(a.username)+'" style="'+B+';padding:3px 10px;font-size:12px;background:#2f9e5b;border-color:#2f9e5b;color:#fff">Unban</button>':"")
   +'<span style="margin-left:auto;color:var(--mute);font-size:12px">joined '+esc(new Date(a.created_at).toLocaleDateString())+(a.last_ip&&a.last_ip!==a.signup_ip?" \u00b7 last IP "+esc(a.last_ip):"")+'</span></label>';
  const grp=k=>{const R=G.get(k),pick=R.filter(canBan);return '<div style="margin-top:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b style="font-size:14px;overflow-wrap:anywhere">'+(k==="unknown"?"IP not recorded":esc(k))+'</b>'
   +(k==="unknown"?"":'<span style="font-size:12px;color:var(--mute)">'+used(k)+"/3 slots used</span>")
   +(pick.length?'<button type="button" data-g="'+esc(k)+'" style="'+B+';padding:4px 10px;font-size:12px">Select all ('+pick.length+')</button>':"")+'</div>'+R.map(row).join("")+'</div>'};
  box.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="flex:1;min-width:160px">Where every account was made</b>'
   +'<input id="st-q" placeholder="Search name or IP\u2026" value="'+esc(flt)+'" style="'+inp+'"><label style="font-size:13px;display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="st-hb"'+(hideBanned?" checked":"")+'>Hide banned</label></div>'
   +'<p style="margin:8px 0 0;font-size:12px;color:var(--mute)">Grouped by the IP address the account was made from. Max 3 accounts per IP; banned accounts free their slot. Only staff see this.</p>'
   +(err?'<p style="color:#ff6b6b;margin:10px 0 0">'+esc(err)+'</p>':"")+(msg?'<p style="color:#3bb26b;margin:10px 0 0;font-weight:700">'+esc(msg)+'</p>':"")
   +(keys.length?keys.map(grp).join(""):'<p style="margin:14px 0 0;color:var(--mute)">No accounts found.</p>')
   +'<div style="position:sticky;bottom:0;margin-top:14px;padding:10px 0 2px;background:var(--b3);border-top:1px solid var(--bl);display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
   +'<input id="st-r" maxlength="200" placeholder="Reason (they read it when they log in)" style="'+inp+';flex:1;min-width:200px">'
   +'<button type="button" id="st-clr" style="'+B+'">Clear</button><button type="button" id="st-go" style="'+B+';background:#e5484d;border-color:#e5484d;color:#fff"'+(sel.size?"":" disabled")+'>Ban selected ('+sel.size+')</button></div>'}
 box.addEventListener("change",e=>{const c=e.target.closest("[data-s]");if(c){c.checked?sel.add(c.dataset.s):sel.delete(c.dataset.s);const g=box.querySelector("#st-go");g.textContent="Ban selected ("+sel.size+")";g.disabled=!sel.size;return}
  if(e.target.id==="st-hb"){hideBanned=e.target.checked;render()}});
 box.addEventListener("input",e=>{if(e.target.id==="st-q"){flt=e.target.value;const p=e.target.selectionStart;render();const q=box.querySelector("#st-q");q.focus();q.setSelectionRange(p,p)}});
 box.addEventListener("click",async e=>{
  const g=e.target.closest("[data-g]");if(g){A.filter(a=>(a.signup_ip||"unknown")===g.dataset.g&&canBan(a)).forEach(a=>sel.add(a.username));render();return}
  const ub=e.target.closest("[data-ub]");if(ub){e.preventDefault();const nm=ub.dataset.ub;if(!confirm("Unban "+nm+"? Everything of theirs comes back."))return;ub.disabled=true;
   try{await EMAuth.rest("rpc/unban_member","POST",{target:nm});msg=nm+" is unbanned.";err="";A=await EMAuth.rest("rpc/staff_accounts","POST",{})}catch(x){err=setup(x);msg=""}render();return}
  if(e.target.id==="st-clr"){sel.clear();render();return}
  if(e.target.id==="st-go"&&sel.size){
   const names=[...sel],why=box.querySelector("#st-r").value.trim();
   if(!confirm("Ban "+names.length+" account"+(names.length>1?"s":"")+"?\n\n"+names.slice(0,15).join(", ")+(names.length>15?" \u2026":"")+"\n\nTheir IP stays open: the slots become free again."))return;
   e.target.disabled=true;e.target.textContent="Banning\u2026";
   try{const r=await EMAuth.rest("rpc/ban_many","POST",{targets:names,reason:why});sel.clear();msg="Banned "+r.banned+" account"+(r.banned===1?"":"s")+(r.skipped?" ("+r.skipped+" skipped)":"")+". Their slots are free.";err="";A=await EMAuth.rest("rpc/staff_accounts","POST",{})}
   catch(x){err=setup(x);msg=""}
   render()}});
 btn.onclick=()=>{box.hidden=!box.hidden;btn.textContent=box.hidden?"Staff: IPs & bulk ban":"Close staff tools";if(!box.hidden&&A===null)load()};
})();
