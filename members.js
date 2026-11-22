const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const grid=$("#mb"),note=$("#mb-n"),mo=$("#mb-mo"),card=$("#mb-card"),q=$("#mb-q");
let M=[],ADS=[];
const color=n=>{let h=0;for(const c of n.toLowerCase())h=(h*31+c.charCodeAt(0))%360;return "hsl("+h+",55%,45%)"};
const av=(n,u)=>u?'<span class="mb-av has"><img src="'+esc(u)+'" alt=""></span>':'<span class="mb-av" style="background:'+color(n)+'">'+esc(n.charAt(0))+'</span>';
const day=t=>new Date(t).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
const names=L=>(L||[]).map(e=>esc(e.n)+(e.q>1?" ×"+e.q:"")).join(", ")||"–";
function draw(){
 const f=q.value.trim().toLowerCase(),L=M.filter(m=>!f||m.username.toLowerCase().includes(f));
 note.textContent=M.length+(M.length===1?" member":" members")+" so far. Click one to open their profile.";
 grid.innerHTML=L.length?L.map(m=>'<button class="mb-t" data-u="'+esc(m.username)+'">'+av(m.username,m.avatar)+'<span class="nm">'+esc(m.username)+(m.role==="admin"?'<i class="mb-ad">ADMIN</i>':"")+'</span></button>').join(""):'<div class="mb-empty">No member found.</div>'}
function open(u){
 const m=M.find(x=>x.username===u);if(!m)return;
 const mine=ADS.filter(a=>a.username===m.username),idx=M.indexOf(m)+1;
 card.innerHTML='<button class="mb-x" aria-label="Close">\u2715</button><div class="mb-top">'+av(m.username,m.avatar)+'<h3>'+esc(m.username)+(m.role==="admin"?'<i class="mb-ad">ADMIN</i>':"")+'</h3><small>'+(m.role==="admin"?"Moderator":"Member")+' of EM Wiki</small></div>'
 +'<div class="mb-st"><div><b>#'+idx+'</b><span>Member number</span></div><div><b>'+mine.length+'</b><span>Trade ads posted</span></div><div style="grid-column:1/-1"><b style="font-size:15px">'+esc(day(m.t))+'</b><span>Joined</span></div></div>'
 +'<h4>Latest trade ads</h4><div class="mb-ads">'+(mine.length?mine.slice(0,5).map(a=>'<div><em>'+ago(a.t)+'</em>Offering: '+names(a.a)+'<br>Looking for: '+names(a.b)+(a.note?'<br><em>'+esc(a.note)+'</em>':"")+'</div>').join(""):'<div>No trade ads yet.</div>')+'</div>'
 +(mine.length?'<p style="margin:12px 0 0;font-size:13px"><a href="trade.html" style="color:var(--accent);font-weight:700">See all ads in the Trade Hub</a></p>':"");
 decorate(m);mo.hidden=false;document.body.style.overflow="hidden"}
async function decorate(m){
 const bn=document.createElement("div");bn.className="mb-bn";bn.style.background="linear-gradient(120deg,"+color(m.username)+",#2a2a30)";card.insertBefore(bn,card.firstChild);
 const top=card.querySelector(".mb-top");if(top)top.insertAdjacentHTML("afterend",'<p class="mb-bio" hidden></p><p style="text-align:center;margin:8px 0 0;font-size:13px"><a href="profile.html?u='+encodeURIComponent(m.username)+'" style="color:var(--accent);font-weight:700">Open full profile</a></p>');
 try{const r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(m.username)+"&select=banner,bio"))[0]||{};
  if(r.banner)bn.style.cssText="background:url("+r.banner+") center/cover";
  const b=card.querySelector(".mb-bio");if(b&&r.bio){b.textContent=r.bio;b.hidden=false}}catch(e){}}
function close(){mo.hidden=true;document.body.style.overflow=""}
grid.addEventListener("click",e=>{const b=e.target.closest("[data-u]");if(b)open(b.dataset.u)});
mo.addEventListener("click",e=>{if(e.target===mo||e.target.closest(".mb-x"))close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!mo.hidden)close()});
q.addEventListener("input",draw);
async function load(){
 if(!window.EMAuth||!EMAuth.configured){note.textContent="";grid.innerHTML='<div class="mb-empty">The accounts server isn\'t set up yet, see SETUP.md.</div>';return}
 if(!EMAuth.user()){note.textContent="";grid.innerHTML='<div class="mb-empty">Log in (top left) to see the members.</div>';return}
 try{
  const p=await EMAuth.rest("profiles?select=username,role,created_at,avatar&order=created_at.asc&limit=1000");
  M=p.map(r=>({username:r.username,role:r.role,avatar:r.avatar||"",t:Date.parse(r.created_at)}));
  try{ADS=(await EMAuth.rest("ads?select=username,offering,looking,note,created_at&order=created_at.desc&limit=500")).map(r=>({username:r.username,a:r.offering||[],b:r.looking||[],note:r.note||"",t:Date.parse(r.created_at)}))}catch(e){ADS=[]}
  draw()}
 catch(e){note.textContent="";grid.innerHTML='<div class="mb-empty">Couldn\'t load the members: '+esc(e.message)+'</div>'}}
grid.innerHTML='<div class="mb-empty">Loading…</div>';load();
