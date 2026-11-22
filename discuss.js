/* Discussions: private 1-to-1 messages. Needs supabase-setup-6.sql. */
(function(){
const $=s=>document.querySelector(s),esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ME=EMAuth.user(),UID=EMAuth.uid(),root=$("#dm");
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const ICON='<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4.5"/></svg>';
/* size the panel so it fills the screen under the menu */
function fit(){const t=root.getBoundingClientRect().top+window.scrollY;root.style.height=Math.max(520,window.innerHeight-t-14)+"px"}
addEventListener("resize",fit);setTimeout(fit,0);fit();
if(!ME){root.className="";root.style.height="auto";root.innerHTML='<div class="dm-empty" style="padding:70px 20px"><div>'+ICON+'<h3>Private messages</h3>'+(EMAuth.configured?"Log in (top left) to chat with other members.":"The accounts server isn't set up yet, see SETUP.md.")+'</div></div>';return}
const color=n=>{let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%360;return"hsl("+h+",55%,45%)"};
const prof={}; /* id -> {username,role,avatar} */
const av=(id,n)=>{const p=prof[id];return'<span class="dm-av" style="background:'+color(n)+'">'+(p&&p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(n.charAt(0).toUpperCase()))+"</span>"};
const adm=id=>prof[id]&&prof[id].role==="admin"?'<i class="dm-ad">ADMIN</i>':"";
let ALL=[],CONV=[],cur=null,MSGS=[],draft=null,q="",people=[],lastSig="";
const RK="dm_read:"+UID,reads=ld(RK,{});
const markRead=id=>{reads[id]=new Date().toISOString();sv(RK,reads)};
const fmtT=t=>new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const day=t=>{const d=new Date(t),n=new Date(),y=new Date(Date.now()-864e5);const k=x=>x.toDateString();return k(d)===k(n)?"Today":k(d)===k(y)?"Yesterday":d.toLocaleDateString([],{day:"numeric",month:"long",year:"numeric"})};
const short=t=>{const d=new Date(t);return d.toDateString()===new Date().toDateString()?fmtT(t):d.toLocaleDateString([],{day:"numeric",month:"short"})};
const setup=e=>/does not exist|schema cache|Could not find the table/i.test(e.message);
const SETUPMSG='<div class="dm-none"><b>Messages are not set up yet.</b><br>Run <code>supabase-setup-6.sql</code> once in the Supabase SQL Editor, then refresh.</div>';
async function loadProfiles(ids){ids=ids.filter(i=>!prof[i]);if(!ids.length)return;
 try{const r=await EMAuth.rest("profiles?select=id,username,role,avatar&id=in.("+ids.slice(0,60).join(",")+")");r.forEach(p=>prof[p.id]=p)}catch(e){ids.forEach(i=>{prof[i]={}})}}
function build(){
 const m=new Map();
 ALL.forEach(x=>{const out=x.sender_id===UID,oid=out?x.recipient_id:x.sender_id,on=out?x.recipient_name:x.sender_name;
  let c=m.get(oid);if(!c){c={id:oid,name:on,last:x,unread:0};m.set(oid,c)}
  if(!out&&(!reads[oid]||x.created_at>reads[oid])&&!(cur&&cur.id===oid))c.unread++});
 if(draft&&!m.has(draft.id))m.set(draft.id,{id:draft.id,name:draft.name,last:null,unread:0});
 CONV=[...m.values()]}
function paintList(){
 const s=q.trim().toLowerCase();let h="";
 const mine=CONV.filter(c=>!s||c.name.toLowerCase().includes(s));
 const card=c=>`<button class="dm-c ${cur&&cur.id===c.id?"on":""}" data-id="${esc(c.id)}" data-n="${esc(c.name)}">${av(c.id,c.name)}<span class="dm-ct"><b><span>${esc(c.name)}</span>${adm(c.id)}</b><small>${c.last?(c.last.sender_id===UID?"You: ":"")+esc(c.last.text):"New conversation"}</small></span><span class="dm-ci">${c.last?"<time>"+short(c.last.created_at)+"</time>":""}${c.unread?'<span class="dm-un">'+(c.unread>99?"99+":c.unread)+"</span>":""}</span></button>`;
 if(s){h+=mine.length?'<div class="dm-sec">Conversations</div>'+mine.map(card).join(""):"";
  const others=people.filter(p=>!CONV.some(c=>c.id===p.id));
  h+=others.length?'<div class="dm-sec">People</div>'+others.map(p=>`<button class="dm-c" data-id="${esc(p.id)}" data-n="${esc(p.username)}">${av(p.id,p.username)}<span class="dm-ct"><b><span>${esc(p.username)}</span>${p.role==="admin"?'<i class="dm-ad">ADMIN</i>':""}</b><small>Start a conversation</small></span></button>`).join(""):"";
  if(!h)h='<div class="dm-none">Nobody found.</div>'}
 else h=CONV.length?CONV.map(card).join(""):'<div class="dm-none">No conversations yet.<br>Search a member above to say hi.</div>';
 $("#dm-list").innerHTML=h}
function paintChat(stick){
 const r=$("#dm-r");
 if(!cur){r.innerHTML='<div class="dm-empty"><div>'+ICON+'<h3>Your messages</h3>Pick a conversation on the left,<br>or search a member to start a new one.</div></div>';root.classList.remove("chat");return}
 if(!$("#dm-msgs")||r.dataset.id!==cur.id){
  r.dataset.id=cur.id;
  r.innerHTML=`<div class="dm-rh"><button class="dm-back" id="dm-back" type="button">‹ Back</button>${av(cur.id,cur.name)}<b>${esc(cur.name)}</b>${adm(cur.id)}</div><div class="dm-msgs" id="dm-msgs"></div><div class="dm-err" id="dm-err"></div><div class="dm-f"><textarea id="dm-in" maxlength="1000" rows="1" placeholder="Message ${esc(cur.name)}…"></textarea><button id="dm-send" type="button">Send</button></div>`;stick=true}
 const box=$("#dm-msgs"),near=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 let h="",d="";MSGS.forEach(x=>{const k=day(x.created_at);if(k!==d){d=k;h+='<div class="dm-day">'+k+"</div>"}
  const out=x.sender_id===UID;h+=`<div class="dm-m ${out?"out":"in"}" data-id="${esc(x.id)}">${out?'<button class="x" data-del aria-label="Delete message">✕</button>':""}${esc(x.text)}<time>${fmtT(x.created_at)}</time></div>`});
 if(!MSGS.length)h='<div class="dm-none" style="margin:auto">No messages yet. Say hi 👋</div>';
 box.innerHTML=h;if(stick||near)box.scrollTop=box.scrollHeight}
const pair=id=>"dms?select=*&or=(and(sender_id.eq."+UID+",recipient_id.eq."+id+"),and(sender_id.eq."+id+",recipient_id.eq."+UID+"))&order=created_at.asc&limit=400";
async function tick(first){
 try{
  ALL=await EMAuth.rest("dms?select=id,sender_id,recipient_id,sender_name,recipient_name,text,created_at&or=(sender_id.eq."+UID+",recipient_id.eq."+UID+")&order=created_at.desc&limit=600");
  await loadProfiles([...new Set(ALL.map(x=>x.sender_id===UID?x.recipient_id:x.sender_id))]);
  if(cur){const m=await EMAuth.rest(pair(cur.id));const sig=m.length+":"+(m.length?m[m.length-1].id:"");
   if(sig!==lastSig||first){lastSig=sig;MSGS=m;paintChat(false)}
   if(!document.hidden)markRead(cur.id)}
  build();paintList()}
 catch(e){if(first){$("#dm-list").innerHTML=setup(e)?SETUPMSG:'<div class="dm-none">Couldn\'t load messages: '+esc(e.message)+"</div>"}}}
async function open(id,name){
 cur={id,name};lastSig="";MSGS=[];root.classList.add("chat");draft=CONV.some(c=>c.id===id)?draft:{id,name};
 await loadProfiles([id]);paintChat(true);build();paintList();
 try{MSGS=await EMAuth.rest(pair(id));lastSig=MSGS.length+":"+(MSGS.length?MSGS[MSGS.length-1].id:"");markRead(id);paintChat(true);build();paintList()}
 catch(e){const b=$("#dm-err");if(b)b.textContent=setup(e)?"Run supabase-setup-6.sql in Supabase first.":e.message}
 const i=$("#dm-in");if(i&&innerWidth>820)i.focus()}
async function send(){
 const i=$("#dm-in"),b=$("#dm-send"),t=i.value.trim();if(!t||!cur)return;$("#dm-err").textContent="";b.disabled=true;
 try{const r=await EMAuth.rest("dms","POST",{sender_id:UID,recipient_id:cur.id,sender_name:ME,recipient_name:cur.name,text:t},{Prefer:"return=representation"});
  i.value="";MSGS.push(r[0]);ALL.unshift(r[0]);lastSig=MSGS.length+":"+r[0].id;markRead(cur.id);draft=null;paintChat(true);build();paintList()}
 catch(e){$("#dm-err").textContent=setup(e)?"Run supabase-setup-6.sql in Supabase first.":"Couldn't send: "+e.message}
 b.disabled=false;i.focus()}
/* events */
$("#dm-list").addEventListener("click",e=>{const c=e.target.closest(".dm-c");if(c)open(c.dataset.id,c.dataset.n)});
$("#dm-r").addEventListener("click",async e=>{
 if(e.target.id==="dm-send")send();
 else if(e.target.id==="dm-back"){cur=null;root.classList.remove("chat");$("#dm-r").dataset.id="";paintChat();paintList()}
 else if(e.target.closest("[data-del]")){const id=e.target.closest(".dm-m").dataset.id;if(!confirm("Delete this message for both of you?"))return;
  try{const r=await EMAuth.rest("dms?id=eq."+encodeURIComponent(id),"DELETE",null,{Prefer:"return=representation"});if(!r||!r.length)throw new Error("the server refused it.");
   MSGS=MSGS.filter(x=>x.id!==id);ALL=ALL.filter(x=>x.id!==id);lastSig="";paintChat(false);build();paintList()}catch(err){$("#dm-err").textContent="Couldn't delete: "+err.message}}});
$("#dm-r").addEventListener("keydown",e=>{if(e.target.id==="dm-in"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
let tm;$("#dm-q").addEventListener("input",e=>{q=e.target.value;clearTimeout(tm);paintList();const s=q.trim();if(s.length<2){people=[];return}
 tm=setTimeout(async()=>{try{const r=await EMAuth.rest("profiles?select=id,username,role,avatar&username=ilike."+encodeURIComponent("*"+s.replace(/[*%,()]/g,"")+"*")+"&limit=12");
  people=r.filter(p=>p.id!==UID);people.forEach(p=>prof[p.id]=p);paintList()}catch(err){}},250)});
paintChat();
tick(true).then(async()=>{const u=new URLSearchParams(location.search).get("u");
 if(u&&u.toLowerCase()!==ME.toLowerCase()){try{const r=await EMAuth.rest("profiles?select=id,username,role,avatar&username=ilike."+encodeURIComponent(u.replace(/[*%,()]/g,"")));
  if(r&&r[0]){prof[r[0].id]=r[0];open(r[0].id,r[0].username)}}catch(e){}}});
setInterval(()=>{if(!document.hidden)tick(false)},4000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick(false)});
})();
