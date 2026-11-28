(function(){
const $=s=>document.querySelector(s),esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const CFG=window.EM_SUPABASE||{};
ld("em_custom",[]).forEach(c=>{if(TD.items.some(i=>i.n===c.n))return;TD.items.push({n:c.n,t:c.t,p:c.p,r:!!c.r,u:!!c.u});if(c.img)TD.thumbs[c.n]={a:c.img};if(c.stars)TD.stars[c.n]=c.stars});
Object.entries(ld("em_images",{})).forEach(([n,u])=>{if(u)TD.thumbs[n]={a:u}});
const OVR=ld("ovr",{});
const ITEMS=TD.items.map(i=>{const o=OVR[i.n]||{};return{...i,p:o.p!==undefined?o.p:i.p}});
const by=n=>ITEMS.find(i=>i.n===n);
const TL={up:"Increasing",down:"Receding",flat:"Stabilizing",fluct:"Fluctuating",infl:"Inflated"};
const stars=i=>{const o=OVR[i.n];return o&&o.s!==undefined?o.s:(TD.stars[i.n]||0)};
const trend=n=>{const o=OVR[n];if(o&&o.d!==undefined)return o.d==="none"?null:o.d;return TD.TR[n]||null};
const thumb=n=>{const i=by(n),t=TD.thumbs[n]||{};let h="";
 if(t.fx){h=(t.m?`<img class="fxm" src="${t.m}" alt="">`:"")+`<img class="fxa" src="${t.a}" alt="">`}else if(t.a)h=`<img src="${t.a}" alt="">`;
 return`<span class="th ${i?i.t:"g"}">${h}</span>`};
const starTxt=n=>n?"★".repeat(n)+"☆".repeat(5-n)+" ("+n+")":"none";
const curOf=(kind,n)=>{const i=by(n);if(!i)return"";return kind==="price"?String(i.p):kind==="stars"?(stars(i)?String(stars(i)):"0"):(trend(n)||"none")};
const showVal=(kind,v)=>kind==="price"?esc(v||"?"):kind==="stars"?(+v?starTxt(+v):"no stars"):(TL[v]||"No trend");
const UP='<svg class="vt-ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V5M5 12l7-7 7 7"/></svg>',DN='<svg class="vt-ar" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15M5 12l7 7 7-7"/></svg>';
const KIND={price:"Price",demand:"Demand",stars:"Stars"};
const hdr=async()=>{const h={apikey:CFG.anonKey,"Content-Type":"application/json"};let t=null;try{t=await EMAuth.token()}catch(e){}
 if(t)h.Authorization="Bearer "+t;else if(!/^sb_/.test(CFG.anonKey||""))h.Authorization="Bearer "+CFG.anonKey;return h};
async function api(path,method,body,extra){
 if(!EMAuth.configured)throw new Error("The accounts server isn't set up yet, see SETUP.md.");
 const h=Object.assign(await hdr(),extra||{});let r;
 try{r=await fetch(CFG.url+"/rest/v1/"+path,{method:method||"GET",headers:h,body:body==null?undefined:JSON.stringify(body)})}catch(e){throw new Error("Can't reach the server. Check your connection.")}
 let j=null;try{j=await r.json()}catch(e){}
 if(!r.ok){const m=(j&&(j.message||j.msg||j.error))||("Server error "+r.status);
  const e=new Error(/relation .*does not exist|Could not find the table|schema cache/i.test(m)?"SETUP":m);throw e}
 return j}
const ME=EMAuth.user(),ADMIN=EMAuth.isAdmin(),UID=EMAuth.uid();
let P=[],V={},C={},filt="open",mine=false,q="",sort="new",openCm={},openVo={},VO={};
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?"just now":m<60?m+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"};
async function load(){
 try{
  const [p,v,c]=await Promise.all([api("polls?select=*&order=created_at.desc&limit=300"),api("poll_votes?select=poll_id,user_id,vote&limit=10000"),api("poll_comments?select=*&order=created_at.asc&limit=3000")]);
  P=p||[];V={};(v||[]).forEach(x=>{(V[x.poll_id]=V[x.poll_id]||[]).push(x)});C={};(c||[]).forEach(x=>{(C[x.poll_id]=C[x.poll_id]||[]).push(x)});paint()}
 catch(e){$("#vt-list").innerHTML=e.message==="SETUP"?'<div class="vt-empty"><b>The voting database is not set up yet.</b><br>Run <code>supabase-setup-5.sql</code> once in the Supabase SQL Editor, then refresh.</div>':'<div class="vt-empty">Couldn\'t load polls: '+esc(e.message)+'</div>'}}
const tally=id=>{const L=V[id]||[];let a=0,d=0,my=null;L.forEach(x=>{if(x.vote==="agree")a++;else d++;if(x.user_id===UID)my=x.vote});return{a,d,my}};
function paint(){
 const open=P.filter(p=>p.status==="open").length;
 $("#f-open i").textContent=open;$("#f-closed i").textContent=P.length-open;$("#f-all i").textContent=P.length;
 const s=q.trim().toLowerCase();
 let L=P.filter(p=>(filt==="all"||p.status===filt)&&(!mine||p.user_id===UID)&&(!s||[p.item,p.username,p.note,KIND[p.kind],showVal(p.kind,p.proposed)].join(" ").toLowerCase().includes(s)));
 if(sort==="votes")L=L.slice().sort((x,y)=>{const a=tally(x.id),b=tally(y.id);return(b.a+b.d)-(a.a+a.d)});
 $("#vt-list").innerHTML=L.length?L.map(card).join(""):'<div class="vt-empty">'+(P.length?"No polls match.":"No polls yet. Be the first: press <b>Create a new poll</b>.")+'</div>'}
const dAv=n=>window.emDefAv?window.emDefAv(n):"";
const voRow=x=>`<div class="vt-vr"><span class="vt-va"><img src="${esc(x.a&&/^(data:image\/|https:)/.test(x.a)?x.a:dAv(x.u))}" alt=""></span><span class="vt-vn">${esc(x.u)}${x.u===ME?" <em>(you)</em>":""}</span><small>${ago(Date.parse(x.t))}</small></div>`;
function voBox(id){const L=VO[id];
 if(L===undefined)return'<div class="vt-vo"><div class="vt-c" style="color:var(--mute)">Loading…</div></div>';
 if(!Array.isArray(L))return'<div class="vt-vo"><div class="vt-c" style="color:#ff6b6b">'+esc(L.err)+'</div></div>';
 const A=L.filter(x=>x.v==="agree"),D=L.filter(x=>x.v!=="agree");
 return`<div class="vt-vo"><div class="vt-vc a"><h4>Agree · ${A.length}</h4>${A.map(voRow).join("")||'<div class="vt-vz">Nobody yet</div>'}</div><div class="vt-vc d"><h4>Disagree · ${D.length}</h4>${D.map(voRow).join("")||'<div class="vt-vz">Nobody yet</div>'}</div></div>`}
async function loadVo(id){
 try{const r=await api("rpc/poll_voters","POST",{p_poll:id});VO[id]=Array.isArray(r)?r:[]}
 catch(e){VO[id]={err:e.message==="SETUP"||/poll_voters|schema cache|does not exist/i.test(e.message)?"Run supabase-setup-43.sql in Supabase first.":"Couldn't load the voters: "+e.message}}
 if(openVo[id])paint()}
function card(p){
 const t=tally(p.id),tot=t.a+t.d,pa=tot?Math.round(t.a/tot*100):0,pd=tot?100-pa:0,can=ADMIN||p.user_id===UID,cm=C[p.id]||[],open=p.status==="open";
 return`<article class="vt-card ${open?"":"closed"}" data-id="${esc(p.id)}">
 <div class="vt-top">${thumb(p.item)}<div class="vt-ti"><h3>${esc(p.item)}</h3><span>by <b>${esc(p.username)}</b> · ${ago(Date.parse(p.created_at))}</span></div><span class="vt-st">${open?"Open":"Closed"}</span></div>
 <div class="vt-chg"><b>${KIND[p.kind]}</b><em>${showVal(p.kind,p.current_val)}</em><span class="ar">➜</span><span class="to">${showVal(p.kind,p.proposed)}</span></div>
 ${p.note?`<p class="vt-note">${esc(p.note)}</p>`:""}
 ${(p.images&&p.images.length)?`<div class="vt-imgs n${p.images.length}">${p.images.map((u,i)=>`<button type="button" class="vt-im" data-im="${i}"><img src="${esc(u)}" alt="Poll picture ${i+1}"></button>`).join("")}</div>`:""}
 <div class="vt-res"><div class="vt-rb"><i class="a" style="width:${pa}%"></i><i class="d" style="width:${pd}%"></i></div><div class="vt-rn"><span class="a">${UP}${t.a} agree${tot?" · "+pa+"%":""}</span><span>${tot} vote${tot===1?"":"s"}</span><span class="d">${t.d} disagree${DN}</span></div></div>
 <div class="vt-act"><button class="va ${t.my==="agree"?"on":""}" data-v="agree" ${open?"":"disabled"}>${UP}Agree</button><button class="vd ${t.my==="disagree"?"on":""}" data-v="disagree" ${open?"":"disabled"}>${DN}Disagree</button><button class="ghost" data-vo>${openVo[p.id]?"Hide voters":"See who voted"}</button><button class="ghost" data-cm>💬 ${cm.length} comment${cm.length===1?"":"s"}</button><span class="gap"></span>${can?`<button class="ghost" data-close>${open?"Close poll":"Reopen"}</button><button class="ghost danger" data-del>Delete</button>`:""}</div>
 <div class="vt-msg"></div>
 ${openVo[p.id]?voBox(p.id):""}
 ${openCm[p.id]?`<div class="vt-cm">${cm.map(c=>`<div class="vt-c">${ADMIN||c.user_id===UID?`<button data-dc="${esc(c.id)}" aria-label="Delete comment">✕</button>`:""}<b>${esc(c.username)}</b>${esc(c.text)}<small>${ago(Date.parse(c.created_at))}</small></div>`).join("")||'<div class="vt-c" style="color:var(--mute)">No comments yet.</div>'}
 <div class="vt-cf"><input maxlength="300" placeholder="${ME?"Write a comment…":"Log in (top left) to comment"}" ${ME?"":"disabled"}><button data-cs ${ME?"":"disabled"}>Send</button></div></div>`:""}
 </article>`}
const note=(el,m,ok)=>{const b=el.closest(".vt-card").querySelector(".vt-msg");b.textContent=m;b.className="vt-msg"+(ok?" ok":"")};
$("#vt-list").addEventListener("click",async e=>{
 const c=e.target.closest(".vt-card");if(!c)return;const id=c.dataset.id,p=P.find(x=>x.id===id),b=e.target.closest("button");if(!b||!p)return;
 if(b.dataset.im!==undefined){const u=(p.images||[])[+b.dataset.im];if(u){lb.innerHTML=`<img src="${esc(u)}" alt="">`;lb.hidden=false}return}
 try{
  if(b.dataset.v){if(!ME){note(b,"Log in (top left) to vote.");return}
   const my=tally(id).my,v=b.dataset.v;
   if(my===v){await api("poll_votes?poll_id=eq."+encodeURIComponent(id)+"&user_id=eq."+UID,"DELETE",null,{Prefer:"return=minimal"});V[id]=(V[id]||[]).filter(x=>x.user_id!==UID)}
   else{await api("poll_votes?on_conflict=poll_id,user_id","POST",{poll_id:id,user_id:UID,vote:v},{Prefer:"resolution=merge-duplicates,return=minimal"});V[id]=(V[id]||[]).filter(x=>x.user_id!==UID).concat([{poll_id:id,user_id:UID,vote:v}])}
   paint();if(openVo[id])loadVo(id)}
  else if(b.hasAttribute("data-vo")){openVo[id]=!openVo[id];if(openVo[id]){delete VO[id];paint();loadVo(id)}else paint()}
  else if(b.hasAttribute("data-cm")){openCm[id]=!openCm[id];paint()}
  else if(b.hasAttribute("data-close")){const s=p.status==="open"?"closed":"open";const r=await api("polls?id=eq."+encodeURIComponent(id),"PATCH",{status:s},{Prefer:"return=representation"});if(!r||!r.length)throw new Error("the server refused it.");p.status=s;paint()}
  else if(b.hasAttribute("data-del")){if(!confirm("Delete this poll and its votes and comments?"))return;
   const r=await api("polls?id=eq."+encodeURIComponent(id),"DELETE",null,{Prefer:"return=representation"});if(!r||!r.length)throw new Error("the server refused it.");P=P.filter(x=>x.id!==id);paint()}
  else if(b.dataset.dc){const r=await api("poll_comments?id=eq."+encodeURIComponent(b.dataset.dc),"DELETE",null,{Prefer:"return=representation"});if(!r||!r.length)throw new Error("the server refused it.");C[id]=(C[id]||[]).filter(x=>x.id!==b.dataset.dc);paint()}
  else if(b.hasAttribute("data-cs")){const inp=c.querySelector(".vt-cf input"),t=inp.value.trim();if(!t)return;
   const r=await api("poll_comments","POST",{poll_id:id,user_id:UID,username:ME,text:t},{Prefer:"return=representation"});(C[id]=C[id]||[]).push(r[0]);paint()}
 }catch(err){note(b,"Couldn't do that: "+err.message)}});
$("#vt-list").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.closest(".vt-cf")){e.preventDefault();e.target.closest(".vt-cf").querySelector("[data-cs]").click()}});
document.querySelectorAll(".vt-f [data-f]").forEach(b=>b.onclick=()=>{filt=b.dataset.f;document.querySelectorAll(".vt-f [data-f]").forEach(x=>x.classList.toggle("on",x===b));paint()});
$("#f-mine").onclick=()=>{if(!ME){alert("Log in (top left) first.");return}mine=!mine;$("#f-mine").classList.toggle("on",mine);paint()};
$("#vt-q").oninput=e=>{q=e.target.value;paint()};$("#vt-sort").onchange=e=>{sort=e.target.value;paint()};
let N={item:null,kind:"price",val:"",stars:0,dem:"",imgs:[]};
const ov=$("#vt-ov");
function openNew(){if(!ME){alert(EMAuth.configured?"Log in (top left) to create a poll.":"The accounts server isn't set up yet, see SETUP.md.");return}
 N={item:null,kind:"price",val:"",stars:0,dem:"",imgs:[]};drawNew();drawImgs();$("#n-note").value="";$("#n-msg").textContent="";ov.hidden=false;setTimeout(()=>$("#n-q").focus(),30)}
const closeNew=()=>{ov.hidden=true};
function drawNew(){
 $("#n-pick").innerHTML=N.item?`<div class="vt-sel">${thumb(N.item)}<b>${esc(N.item)}</b><button type="button" id="n-ch">Change</button></div>`:`<input id="n-q" autocomplete="off" placeholder="Search an item…"><div class="vt-rs" id="n-rs" hidden></div>`;
 document.querySelectorAll(".vt-kinds button").forEach(b=>b.classList.toggle("on",b.dataset.k===N.kind));
 const cur=N.item?curOf(N.kind,N.item):null;
 $("#n-cur").innerHTML=N.item?`Current ${KIND[N.kind].toLowerCase()}: <b>${showVal(N.kind,cur)}</b>`:"";
 const w=$("#n-val");
 if(N.kind==="price")w.innerHTML=`<label>New price you want</label><input id="n-p" maxlength="20" placeholder="e.g. 80k, 55k+, 40k-50k" value="${esc(N.val)}">`;
 else if(N.kind==="stars")w.innerHTML=`<label>New stars you want</label><div class="vt-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-s="${n}" class="${n<=N.stars?"on":""}" aria-label="${n} star${n>1?"s":""}">★</button>`).join("")}</div>`;
 else w.innerHTML=`<label>New demand you want</label><div class="vt-dem">${Object.entries(TL).map(([k,l])=>`<button type="button" data-d="${k}" class="${N.dem===k?"on":""}">${l}</button>`).join("")}</div>`}
function results(){const s=$("#n-q").value.trim().toLowerCase(),r=$("#n-rs");if(!s){r.hidden=true;return}
 const L=ITEMS.filter(i=>i.n.toLowerCase().includes(s)).sort((a,b)=>(a.n.toLowerCase().startsWith(s)?0:1)-(b.n.toLowerCase().startsWith(s)?0:1)).slice(0,30);
 r.hidden=false;r.innerHTML=L.length?L.map(i=>`<button type="button" data-i="${esc(i.n)}">${thumb(i.n)}<span class="s"><b>${esc(i.n)}</b><small>${esc(i.p)}${stars(i)?" · ★"+stars(i):""}</small></span></button>`).join(""):'<div class="vt-c" style="padding:10px;color:var(--mute)">No item found.</div>'}
ov.addEventListener("input",e=>{if(e.target.id==="n-q")results();if(e.target.id==="n-p")N.val=e.target.value});
ov.addEventListener("click",e=>{
 if(e.target===ov||e.target.closest(".vt-x")){closeNew();return}
 const b=e.target.closest("button");if(!b)return;
 if(b.dataset.i){N.item=b.dataset.i;drawNew()}
 else if(b.id==="n-ch"){N.item=null;drawNew();setTimeout(()=>$("#n-q").focus(),20)}
 else if(b.dataset.k){N.kind=b.dataset.k;drawNew()}
 else if(b.dataset.s){N.stars=+b.dataset.s;drawNew()}
 else if(b.dataset.d){N.dem=b.dataset.d;drawNew()}
 else if(b.id==="n-addimg")$("#n-file").click()
 else if(b.dataset.ri){N.imgs.splice(+b.dataset.ri,1);drawImgs()}
 else if(b.id==="n-go")submit(b)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!ov.hidden)closeNew()});
function shrinkImg(file,max){return new Promise((ok,no)=>{const r=new FileReader();r.onerror=()=>no(new Error("Couldn't read that file."));
 r.onload=()=>{const im=new Image();im.onerror=()=>no(new Error("That file isn't a picture I can open."));
  im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),w=Math.round(im.width*k),h=Math.round(im.height*k),c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(im,0,0,w,h);
   let u=c.toDataURL("image/webp",.72);if(u.indexOf("data:image/webp")!==0)u=c.toDataURL("image/jpeg",.72);ok(u)};im.src=r.result};r.readAsDataURL(file)})}
function drawImgs(){const b=$("#n-imgs");if(!b)return;
 b.innerHTML=N.imgs.map((u,i)=>`<span class="vt-th"><img src="${u}" alt=""><button type="button" data-ri="${i}" aria-label="Remove picture">\u2715</button></span>`).join("")+(N.imgs.length<3?'<button type="button" class="vt-addimg" id="n-addimg">+ Add picture</button>':"")}
$("#n-file").onchange=async e=>{const m=$("#n-msg");m.className="vt-msg";
 for(const f of Array.from(e.target.files)){if(N.imgs.length>=3){m.textContent="Up to 3 pictures per poll.";break}
  try{N.imgs.push(await shrinkImg(f,720))}catch(err){m.textContent=err.message}}
 e.target.value="";drawImgs()};
const lb=document.createElement("div");lb.className="vt-lb";lb.hidden=true;document.body.appendChild(lb);
lb.onclick=()=>{lb.hidden=true;lb.innerHTML=""};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!lb.hidden){lb.hidden=true;lb.innerHTML=""}});
async function submit(btn){
 const m=$("#n-msg");m.className="vt-msg";
 if(!N.item){m.textContent="Choose an item first.";return}
 let prop;
 if(N.kind==="price"){prop=N.val.trim().replace(/\s+/g,"");if(!/^\d+(\.\d+)?k?\+?(-\d+(\.\d+)?k?)?$/i.test(prop)){m.textContent="Price looks wrong. Use something like 80k, 55k+ or 40k-50k.";return}prop=prop.toLowerCase()}
 else if(N.kind==="stars"){if(!N.stars){m.textContent="Pick the stars you want.";return}prop=String(N.stars)}
 else{if(!N.dem){m.textContent="Pick the demand you want.";return}prop=N.dem}
 const cur=curOf(N.kind,N.item);
 if(String(cur).toLowerCase()===prop){m.textContent="That is already the current "+KIND[N.kind].toLowerCase()+".";return}
 btn.disabled=true;m.textContent="Posting…";
 try{const r=await api("polls","POST",{user_id:UID,username:ME,item:N.item,kind:N.kind,current_val:String(cur),proposed:prop,note:$("#n-note").value.trim(),images:N.imgs},{Prefer:"return=representation"});
  P.unshift(r[0]);closeNew();filt="open";document.querySelectorAll(".vt-f [data-f]").forEach(x=>x.classList.toggle("on",x.dataset.f==="open"));paint();window.scrollTo({top:0,behavior:"smooth"})}
 catch(e){m.textContent=e.message==="SETUP"?"Run supabase-setup-5.sql in Supabase first.":/images/i.test(e.message)?"Pictures can't be saved yet: run supabase-setup-7.sql in Supabase first.":"Couldn't post: "+e.message}
 btn.disabled=false}
$("#vt-new").onclick=openNew;
if(!ME)$("#vt-tip").textContent=EMAuth.configured?"Log in (top left) to create polls, vote and comment. You can read everything without an account.":"The accounts server isn't set up yet, see SETUP.md.";
if(window.EMData&&EMData.enabled())EMData.onChange((k,v)=>{try{if(k==="overrides"){localStorage.setItem("ovr",v);localStorage.setItem("ovr_saved",v)}else if(k==="custom")localStorage.setItem("em_custom",v);else if(k==="images")localStorage.setItem("em_images",v)}catch(e){}
 try{const x=+sessionStorage.getItem("em_rl")||0;if(Date.now()-x>8000){sessionStorage.setItem("em_rl",Date.now());setTimeout(()=>location.reload(),50)}}catch(e){}});
load();
})();
