const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
/* items added with the Add Item tool on the Catalog page */
ld("em_custom",[]).forEach(c=>{if(TD.items.some(i=>i.n===c.n))return;TD.items.push({n:c.n,t:c.t,p:c.p,r:!!c.r,u:!!c.u});if(c.img)TD.thumbs[c.n]={a:c.img};if(c.stars)TD.stars[c.n]=c.stars});
/* icon images the admin changed (saved on the server, copied here by the sync below) */
Object.entries(ld("em_images",{})).forEach(([n,u])=>{if(u)TD.thumbs[n]={a:u}});
/* prices edited on the Catalog page (same browser) override the base data */
const OVR=ld("ovr",{});
const items=TD.items.map(i=>{const o=OVR[i.n]||{};return{...i,p:o.p!==undefined?o.p:i.p}});
const by=n=>items.find(i=>i.n===n);
const trend=n=>{const o=OVR[n];if(o&&o.d!==undefined)return o.d==="none"?null:o.d;return TD.TR[n]||null};
const TL={up:"Increasing",down:"Receding",flat:"Stabilizing",fluct:"Fluctuating",infl:"Inflated"};
const stars=i=>{const o=OVR[i.n];return o&&o.s!==undefined?o.s:(TD.stars[i.n]||0)},plus=i=>/\+/.test(i.p);
const val=i=>{const m=String(i.p).match(/([\d.]+)\s*(k?)(?:\s*-\s*([\d.]+)\s*(k?))?/);if(!m)return null;
 const a=parseFloat(m[1]),k=m[2]==="k";if(m[3]){const f=(k||m[4]==="k")?1000:1;return(a+parseFloat(m[3]))/2*f}return a*(k?1000:1)};
const fmt=v=>v>=1000?(+(v/1000).toFixed(2))+"k":String(Math.round(v));
let O=Object.assign({st:true,pl:true,dem:false},ld("tc_opts",{}));
const fx=i=>{let m=1;if(O.st&&stars(i))m*=1+(stars(i)-3)*.06;if(O.pl&&plus(i))m*=1.08;if(O.dem){const d=trend(i.n);m*=d==="up"?1.1:d==="down"?.9:1}return m};
const line=(i,q)=>(val(i)||0)*q*fx(i);
const thumb=i=>{const t=TD.thumbs[i.n]||{};let h="";
 if(t.fx){if(t.m)h+=`<img class="fxm" src="${t.m}" alt="">`;h+=`<img class="fxa" src="${t.a}" alt="">`}
 else if(t.a)h=`<img src="${t.a}" alt="">`;else h="✨";
 return`<span class="th ${i.t}">${h}</span>`};
const meta=i=>`${esc(i.p)}${val(i)===null?" · unknown":""}${stars(i)?" · ★"+stars(i):""}${trend(i.n)?" · "+TL[trend(i.n)]:""}`;

/* ---- side picker (used by checker and hub form) ---- */
const S={a:ld("tc_a",[]),b:ld("tc_b",[]),ha:ld("hub_a",[]),hb:ld("hub_b",[])};
const persist=k=>{if(k==="a"||k==="b")sv("tc_"+k,S[k]);else sv("hub_"+k[1],S[k])};
const sides=[];
$$(".col[data-side]").forEach(col=>{
 const k=col.dataset.side;
 col.insertAdjacentHTML("beforeend",`<input type="search" placeholder="Add an item…" autocomplete="off"><div class="rs" hidden></div><div class="ls"></div><div class="sum"><span>Total</span><b></b></div>`);
 const inp=col.querySelector("input"),rs=col.querySelector(".rs"),ls=col.querySelector(".ls"),tot=col.querySelector(".sum b");
 const draw=()=>{S[k]=S[k].filter(e=>by(e.n));let t=0;
  ls.innerHTML=S[k].length?S[k].map(e=>{const i=by(e.n),v=line(i,e.q);t+=v;
   return`<div class="row">${thumb(i)}<div class="nm"><b>${esc(i.n)}</b><span>${meta(i)}</span></div><div class="q"><button data-a="dec" data-n="${esc(i.n)}">−</button>${e.q}<button data-a="inc" data-n="${esc(i.n)}">+</button></div><div class="v">${fmt(v)}</div><button data-a="rm" data-n="${esc(i.n)}">✕</button></div>`}).join(""):'<div class="em">No items yet. Search above to add one.</div>';
  tot.textContent=fmt(t);col._t=t};
 const results=()=>{const q=inp.value.trim().toLowerCase();
  const L=items.filter(i=>!q||i.n.toLowerCase().includes(q)).sort((x,y)=>(val(y)||0)-(val(x)||0)).slice(0,8);
  rs.style.top=(inp.offsetTop+inp.offsetHeight+2)+"px";
  rs.innerHTML=L.length?L.map(i=>`<button data-add="${esc(i.n)}">${thumb(i)}<span class="nm"><b>${esc(i.n)}</b><span>${meta(i)}</span></span></button>`).join(""):'<div class="em">No items match.</div>';rs.hidden=false};
 inp.addEventListener("input",results);inp.addEventListener("focus",results);
 col.addEventListener("click",e=>{const t=e.target,ad=t.closest("[data-add]"),ac=t.closest("[data-a]");
  if(ad){const n=ad.dataset.add,x=S[k].find(e=>e.n===n);x?x.q=Math.min(99,x.q+1):S[k].push({n,q:1});inp.value="";rs.hidden=true}
  else if(ac){const x=S[k].find(e=>e.n===ac.dataset.n);if(x){const a=ac.dataset.a;if(a==="inc")x.q=Math.min(99,x.q+1);else if(a==="dec")x.q=Math.max(1,x.q-1);else S[k]=S[k].filter(y=>y!==x)}}
  else return;
  persist(k);api.redraw()});
 sides.push({k,col,draw});
});
document.addEventListener("click",e=>{if(!e.target.closest(".col"))$$(".rs").forEach(r=>r.hidden=true)});
const api={redraw(){sides.forEach(s=>s.draw());verdict();}};

/* ---- verdict ---- */
function verdict(){
 const sum=(L)=>L.reduce((t,e)=>{const i=by(e.n);return i?t+line(i,e.q):t},0),raw=L=>L.reduce((t,e)=>{const i=by(e.n);return i?t+(val(i)||0)*e.q:t},0);
 const A=sum(S.a),B=sum(S.b),box=$("#verdict"),notes=[];
 for(const s of["a","b"])for(const e of S[s]){const i=by(e.n);if(!i)continue;if(val(i)===null)notes.push(`${i.n} has no known price yet, so it counts as 0.`);
  const d=trend(i.n);if(d==="up")notes.push(s==="a"?`${i.n} is Increasing: you're giving up an item that's rising.`:`${i.n} is Increasing: it may gain value.`);
  if(d==="down")notes.push(s==="a"?`${i.n} is Receding: a good one to trade away.`:`${i.n} is Receding: it may lose value.`)}
 const nt=notes.length?`<ul class="nt">${[...new Set(notes)].map(n=>`<li>${esc(n)}</li>`).join("")}</ul>`:"";
 if(A<=0||B<=0){box.innerHTML='<div class="em" style="border:0">Add items with a price to both sides to see the verdict.</div>'+nt;return}
 const d=B-A,fair=Math.abs(d)/Math.max(A,B)<=.03,c=fair?"f":d>0?"w":"l";
 box.innerHTML=`<span class="chip ${c}">${fair?"Fair trade":d>0?"Win":"Loss"}</span>${fair?"Both sides are within about 3% of each other.":d>0?`You gain ${fmt(d)} in value (+${Math.round(d/A*100)}%).`:`You lose ${fmt(-d)} in value (${Math.round(d/A*100)}%).`}
 <div class="bar"><i class="a" style="width:${A/(A+B)*100}%"></i><i class="b" style="width:${B/(A+B)*100}%"></i></div>
 <div class="lg"><span>You give ${fmt(A)} value</span><span>You get ${fmt(B)} value</span></div>
 <div class="lg"><span>Raw price ${fmt(raw(S.a))}</span><span>Raw price ${fmt(raw(S.b))}</span></div>${nt}`;
}
[["#o-st","st"],["#o-pl","pl"],["#o-dem","dem"]].forEach(([id,k])=>{$(id).checked=!!O[k];$(id).onchange=e=>{O[k]=e.target.checked;sv("tc_opts",O);api.redraw();feed()}});
$("#swap").onclick=()=>{[S.a,S.b]=[S.b,S.a];persist("a");persist("b");api.redraw()};
$("#clr").onclick=()=>{S.a=[];S.b=[];persist("a");persist("b");api.redraw()};

/* ---- tabs ---- */
function tab(t){$$(".tabs button").forEach(b=>b.classList.toggle("on",b.dataset.tab===t));$("#chk").hidden=t!=="chk";$("#hub").hidden=t!=="hub";history.replaceState(null,"","#"+t);if(t==="hub")feed()}
$$(".tabs button").forEach(b=>b.onclick=()=>tab(b.dataset.tab));

/* ---- trade hub ----
   Ads live in the Supabase "ads" table. Only logged-in people can read, post and delete (own ads; admin can delete any). */
const ME=window.EMAuth&&EMAuth.user();
let ADS=[];
const row=r=>({id:r.id,uid:r.user_id,u:r.username,a:r.offering||[],b:r.looking||[],note:r.note||"",t:Date.parse(r.created_at)});
const Ads={
 async all(){return(await EMAuth.rest("ads?select=*&order=created_at.desc&limit=200")).map(row)},
 async add(a){await EMAuth.rest("ads","POST",{user_id:EMAuth.uid(),username:ME,offering:a.a,looking:a.b,note:a.note},{Prefer:"return=minimal"})},
 async del(id){await EMAuth.rest("ads?id=eq."+encodeURIComponent(id),"DELETE")}};
const lock=$("#h-lock");
if(!ME){$("#h-app").hidden=true;lock.hidden=false;lock.textContent=EMAuth.configured?"Log in (top left) to see and post trade ads.":"The accounts server isn't set up yet, see SETUP.md."}
else{$("#h-user").value=ME;$("#h-user").readOnly=true}
$("#h-post").onclick=async()=>{const m=$("#h-msg"),btn=$("#h-post");m.style.color="#ff6b6b";
 if(!ME){m.textContent="Log in to post.";return}
 if(!S.ha.length||!S.hb.length){m.textContent="Add at least one item to each side.";return}
 btn.disabled=true;m.textContent="Posting…";
 try{await Ads.add({a:S.ha,b:S.hb,note:$("#h-note").value.trim()});
  S.ha=[];S.hb=[];persist("ha");persist("hb");$("#h-note").value="";api.redraw();
  m.style.color="#5cff5c";m.textContent="Ad posted!";setTimeout(()=>m.textContent="",3000);await feed()}
 catch(e){m.textContent="Couldn't post: "+e.message}
 btn.disabled=false};
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
const mini=L=>L.map(e=>{const i=by(e.n);return i?`<div class="mini">${thumb(i)}<div class="nm"><b>${esc(i.n)}${e.q>1?" ×"+e.q:""}</b><span>${esc(i.p)}</span></div></div>`:""}).join("");
const tot=L=>L.reduce((t,e)=>{const i=by(e.n);return i?t+line(i,e.q):t},0);
function paintFeed(){const q=$("#h-q").value.trim().toLowerCase(),L=ADS.filter(a=>!q||a.u.toLowerCase().includes(q)||[...a.a,...a.b].some(e=>e.n.toLowerCase().includes(q)));
 const can=a=>EMAuth.isAdmin()||a.uid===EMAuth.uid();
 $("#feed").innerHTML=L.length?L.map(a=>{const A=tot(a.a),B=tot(a.b);
  return`<div class="ad"><div class="ad-h"><b>${esc(a.u)}</b><span>${ago(a.t)}</span></div><div class="cols"><div><div class="lab">Offering · ${fmt(A)}</div>${mini(a.a)}</div><div><div class="lab">Looking for · ${fmt(B)}</div>${mini(a.b)}</div></div>${a.note?`<p>${esc(a.note)}</p>`:""}<div class="act"><button data-chk="${esc(a.id)}">⚖ Check this trade</button>${can(a)?`<button data-del="${esc(a.id)}">Delete</button>`:""}</div></div>`}).join(""):'<div class="em">No ads yet. Post the first one above.</div>'}
async function feed(){if(!ME)return;
 try{ADS=await Ads.all();paintFeed()}catch(e){$("#feed").innerHTML='<div class="em">Couldn\'t load ads: '+esc(e.message)+'</div>'}}
$("#h-q").oninput=paintFeed;
$("#feed").onclick=async e=>{const c=e.target.closest("[data-chk]"),d=e.target.closest("[data-del]");
 if(c){const a=ADS.find(x=>x.id===c.dataset.chk);if(a){/* viewer gives what the poster wants */S.a=JSON.parse(JSON.stringify(a.b));S.b=JSON.parse(JSON.stringify(a.a));persist("a");persist("b");api.redraw();tab("chk");scrollTo(0,0)}}
 if(d&&confirm("Delete this ad?")){try{await Ads.del(d.dataset.del);await feed()}catch(x){alert("Couldn't delete: "+x.message)}}};
api.redraw();tab(location.hash==="#hub"?"hub":"chk");

/* catalog edits made by the admin on the server: store them, then reload once so prices/stars/new items are current */
if(window.EMData&&EMData.enabled())EMData.onChange((k,v)=>{try{if(k==="overrides"){localStorage.setItem("ovr",v);localStorage.setItem("ovr_saved",v)}else if(k==="custom")localStorage.setItem("em_custom",v);else if(k==="images")localStorage.setItem("em_images",v)}catch(e){}
 try{const x=+sessionStorage.getItem("em_rl")||0;if(Date.now()-x>8000){sessionStorage.setItem("em_rl",Date.now());setTimeout(()=>location.reload(),50)}}catch(e){}});
