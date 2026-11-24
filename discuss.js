/* Discussions: private 1-to-1 messages with pictures and item cards, plus friends.
   Needs supabase-setup-6.sql; pictures, items and friends need supabase-setup-8.sql. */
(function(){
const $=s=>document.querySelector(s),esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ME=EMAuth.user(),UID=EMAuth.uid(),root=$("#dm");
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const ICON='<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4.5"/></svg>';
const PLUS='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 7v10M7 12h10"/></svg>';
function fit(){const t=root.getBoundingClientRect().top+window.scrollY;root.style.height=Math.max(520,window.innerHeight-t-14)+"px"}
addEventListener("resize",fit);setTimeout(fit,0);fit();
if(!ME){root.className="";root.style.height="auto";root.innerHTML='<div class="dm-empty" style="padding:70px 20px"><div>'+ICON+'<h3>Private messages</h3>'+(EMAuth.configured?"Log in (top left) to chat with other members.":"The accounts server isn't set up yet, see SETUP.md.")+'</div></div>';return}

/* ---------- item data (same sources as the Trade page) ---------- */
const HAS_ITEMS=typeof TD!=="undefined"&&!!TD.items;
const INFO=window.ITEMINFO||{};
const TD0=HAS_ITEMS?{items:TD.items.slice(),thumbs:Object.assign({},TD.thumbs),stars:Object.assign({},TD.stars),TR:TD.TR||{}}:null;
const LIVE={ovr:ld("ovr",{}),custom:ld("em_custom",[]),images:ld("em_images",{})};
let ITEMS=[],BYN={},TH={};
function rebuild(){if(!HAS_ITEMS)return;
 const base=TD0.items.map(i=>({...i})),st=Object.assign({},TD0.stars);TH=Object.assign({},TD0.thumbs);
 (LIVE.custom||[]).forEach(c=>{if(!c||base.some(i=>i.n===c.n))return;base.push({n:c.n,t:c.t,p:c.p,r:!!c.r,u:!!c.u});if(c.img)TH[c.n]={a:c.img};if(c.stars)st[c.n]=c.stars});
 Object.entries(LIVE.images||{}).forEach(([n,u])=>{if(u)TH[n]={a:u}});
 ITEMS=base.map(i=>{const o=(LIVE.ovr||{})[i.n]||{};
  return{...i,p:o.p!==undefined?o.p:i.p,r:o.r!==undefined?o.r:i.r,u:o.ut!==undefined?o.ut:i.u,ub:!!o.ub,o:o,
   stars:o.s!==undefined?o.s:(st[i.n]||0),trend:o.d!==undefined?(o.d==="none"?null:o.d):(TD0.TR[i.n]||null)}});
 BYN={};ITEMS.forEach(i=>BYN[i.n]=i)}
rebuild();
/* the admin's saved edits, kept in memory only (never written to this browser's catalog data) */
if(HAS_ITEMS&&window.EMData&&EMData.enabled())EMData.onChange((k,v)=>{try{const j=JSON.parse(v);if(k==="overrides")LIVE.ovr=j;else if(k==="custom")LIVE.custom=j;else if(k==="images")LIVE.images=j;rebuild();try{if(cur)paintChat(false)}catch(e2){}}catch(e){}return false});
const TL={up:"Increasing",down:"Receding",flat:"Stabilizing",fluct:"Fluctuating",infl:"Inflated"};
const TYPE={g:"Gear",p:"Pet",t:"Title",e:"Effect",o:"Death"};
const SL={1:"Horrible demand",2:"No demand",3:"HTT - hard to trade",4:"Doing well",5:"Really good demand"};
const price=p=>String(p==null?"":p).replace(/^0\/C/i,"O/C");
const thumb=n=>{const i=BYN[n],t=TH[n]||{};let h="";
 if(t.fx){if(t.m)h+='<img class="fxm" src="'+esc(t.m)+'" alt="">';h+='<img class="fxa" src="'+esc(t.a)+'" alt="">'}
 else if(t.a)h='<img src="'+esc(t.a)+'" alt="">';else if(i&&i.t==="t")return'<span class="th t txt"><i>'+esc(n)+"</i></span>";else h="?";
 return'<span class="th '+(i?i.t:"g")+'">'+h+"</span>"};
const stars=n=>n?'<span class="dm-st" title="'+esc(SL[n]||"")+'">'+"\u2605".repeat(n)+"</span>":"";
const chipTxt=c=>{const k=c[0],v=c[1];return k==="star"?v+" Stars":k==="rbx"?v+" Robux":k==="coin"?v+" Coins":k==="token"?v+" Tokens":k==="rank"?"Rank "+v:String(v)};
function itemInfo(i){const f=Object.assign({},INFO[i.n]||{}),o=i.o||{};
 if(o.cp!==undefined)f.copies=o.cp;if(o.cr!==undefined)f.credit=o.cr;if(o.ln!==undefined)f.lines=o.ln;return f}

/* ---------- people ---------- */
const color=n=>{let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%360;return"hsl("+h+",55%,45%)"};
const prof={};
const av=(id,n)=>{const p=prof[id];return'<span class="dm-av" style="background:'+color(n)+'">'+(p&&p.avatar?'<img src="'+esc(p.avatar)+'" alt="">':esc(n.charAt(0).toUpperCase()))+"</span>"};
const adm=id=>prof[id]&&prof[id].role==="admin"?'<i class="dm-ad">ADMIN</i>':"";
const isFr=id=>!!(window.EMSocial&&EMSocial.loaded&&EMSocial.rel(id).kind==="friend");
const frTag=id=>isFr(id)?'<i class="dm-fr">Friend</i>':"";
const pname=id=>(prof[id]&&prof[id].username)||"";
let ALL=[],CONV=[],cur=null,MSGS=[],draft=null,q="",people=[],lastSig="",pendImg=null,tk=0,NEW8=true;
const BASE="id,sender_id,recipient_id,sender_name,recipient_name,text,created_at",EXT=BASE+",kind,iname:payload->>n",EXT9=EXT+",edited_at,mm:payload->>mm,ms:payload->>s,mr:payload->>r,md:payload->>done,mst:payload->>st,mgid:payload->>gid,mat:payload->>at",EXT10=EXT9+",channel",EXT11=EXT10+",read_at";
let COLS=EXT11,NEW11=true,NEW10=true,TAB=ld("dm_tab","friends"),NEW9=true,NOTIF=[],notifOk=true;
const NEED13="Run supabase-setup-13.sql in Supabase first.",NEED9="Run supabase-setup-9.sql in Supabase first.";
const HK="dm_hid:"+UID,hid=ld(HK,{}),vis=a=>a.filter(x=>!hid[x.id]);
let editing=null,pop=null,GL=[],GM={},GMEM={},GCONV=[],grpOk=true,gSig="",gediting=null,GNEW=true;
const NEED17="Run supabase-setup-17.sql in Supabase first.",MMT=6e5;
const RXE={laugh:"\u{1F602}",heart:"\u2764\uFE0F",check:"\u2705",cross:"\u274C"},RXK=Object.keys(RXE);
let RX={},rxOk=true,rxBusy=0,rxSig="";
const SMILE='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 1.5 2.2 2.2 3.5 2.2s2.5-.7 3.5-2.2M9 9.6h.01M15 9.6h.01"/></svg>';
const GCOLS="id,group_id,sender_id,sender_name,kind,text,created_at,edited_at,iname:payload->>n",GOLD="id,group_id,sender_id,sender_name,kind,text,created_at",GQ="&order=created_at.desc&limit=500";
const errEl=()=>$(cur&&cur.grp?"#gp-err":"#dm-err")||{},stp=()=>$(cur&&cur.grp?"#gp-stp":"#dm-stp");
const IMG={},PICREQ={};
const RK="dm_read:"+UID,reads=ld(RK,{});
const markRead=id=>{reads[id]=new Date().toISOString();sv(RK,reads)};
const fmtT=t=>new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const day=t=>{const d=new Date(t),n=new Date(),y=new Date(Date.now()-864e5);const k=x=>x.toDateString();return k(d)===k(n)?"Today":k(d)===k(y)?"Yesterday":d.toLocaleDateString([],{day:"numeric",month:"long",year:"numeric"})};
const short=t=>{const d=new Date(t);return d.toDateString()===new Date().toDateString()?fmtT(t):d.toLocaleDateString([],{day:"numeric",month:"short"})};
const setup=e=>/does not exist|schema cache|Could not find the table/i.test(e.message);
const NEED10="Run supabase-setup-10.sql in Supabase first.",key=(id,ch)=>ch==="trade"?id+"|trade":id,chOf=x=>x.channel==="trade"?"trade":"personal",isCur=(id,ch)=>!!(cur&&cur.id===id&&(cur.ch||"personal")===(ch||"personal"));
const NEED8="Run supabase-setup-8.sql in Supabase first.";
const SETUPMSG='<div class="dm-none"><b>Messages are not set up yet.</b><br>Run <code>supabase-setup-6.sql</code> once in the Supabase SQL Editor, then refresh.</div>';
const ADRE=/^\[\[ad:([0-9a-f-]{36})\]\]$/i,adOf=x=>(!x.kind||x.kind==="text")&&ADRE.test(x.text||"")?x.text.match(ADRE)[1]:null,ADC={},ADQ={};let adCtx=null;
const adNm=L=>(L||[]).map(e=>e.n==="@r"?e.q+" Robux":e.n==="@m"?e.q+" Gems":String(e.n).startsWith("@g:")?String(e.n).slice(3)+" crosstrade":e.n+(e.q>1?" x"+e.q:"")).join(", ");
const adBox=(a,tag)=>a?'<div class="dm-adc-t">'+tag+(a.username?' \u00b7 '+esc(a.username):"")+'</div><div class="dm-adc-r"><span>Offering</span>'+esc(adNm(a.offering)||"-")+'</div><div class="dm-adc-r"><span>Looking for</span>'+esc(adNm(a.looking)||"-")+'</div>'+(a.note?'<div class="dm-adc-n">'+esc(a.note)+'</div>':""):'<div class="dm-adc-t">'+tag+'</div><div class="dm-adc-n">This trade ad is no longer available.</div>';
async function loadAds(){for(const x of MSGS){const id=adOf(x);if(!id||ADC[id]!==undefined||ADQ[id])continue;ADQ[id]=1;
 try{const r=await EMAuth.rest("ads?id=eq."+id+"&select=id,username,offering,looking,note");ADC[id]=r&&r[0]||null}catch(e){delete ADQ[id];continue}
 document.querySelectorAll('[data-adc="'+id+'"]').forEach(el=>el.innerHTML=adBox(ADC[id],"Trade ad"));paintAdb()}}
function paintAdb(){const b=$("#dm-adb");if(!b)return;const a=adCtx&&cur&&cur.ch==="trade"&&adCtx.uid===cur.id?adCtx:null;
 if(!a||MSGS.some(m=>adOf(m)===a.id)){b.hidden=true;b.innerHTML="";return}b.hidden=false;b.innerHTML=adBox(a.ad,"Trade you were interested in")}

const WLRE=/^\[\[(wl|inv):([\s\S]*)\]\]$/,wlOf=x=>{if(x.kind&&x.kind!=="text")return null;const m=WLRE.exec(x.text||"");if(!m)return null;const l=m[2].split("|").filter(Boolean).map(p=>{const k=p.lastIndexOf("*"),q=k>0?+p.slice(k+1):1;return k>0&&q>0?{n:p.slice(0,k),q:q}:{n:p,q:1}});l.k=m[1];return l},
wlNm=x=>{const l=wlOf(x);return l&&l.k==="inv"?"Inventory":"Wishlist"},
wlCard=l=>{const tot=l.reduce((t,r)=>t+r.q,0);return'<div class="dm-wl"><div class="dm-wlh"><b>'+(l.k==="inv"?"Inventory":"Wishlist")+'</b><span>'+l.length+(l.length===1?" item":" items")+(tot>l.length?" \u00b7 "+tot+" total":"")+'</span></div><div class="dm-wll">'+l.map(r=>{const i=BYN[r.n];return'<button class="dm-wli" data-item="'+esc(r.n)+'" type="button">'+(i?thumb(r.n):'<span class="th g">?</span>')+'<span class="dm-wlx"><b>'+esc(r.n)+(r.q>1?" x"+r.q:"")+'</b><span>'+(i?esc(price(i.p))+(i.stars?" \u00b7 "+stars(i.stars):""):"Item not found")+'</span></span></button>'}).join("")+'</div></div>'},
myList=k=>{let a=[];try{a=JSON.parse(localStorage.getItem(EMAuth.listKey(k||"wishn"))||"[]")}catch(e){}return Array.isArray(a)?a.filter(r=>r&&typeof r[0]==="string"&&r[0]):[]};
const STRE=/^\[\[st:([a-z]+)(\d+)\]\]$/i,stOf=x=>{if(x.kind&&x.kind!=="text")return null;const m=STRE.exec(x.text||"");if(!m)return null;const p=(window.EM_STICKERS||{})[m[1].toLowerCase()],u=p&&p.items[+m[2]-1];return{pack:m[1].toLowerCase(),n:+m[2],src:u||""}};
const gsum=x=>stOf(x)?"Sticker":wlOf(x)?wlNm(x):x.kind==="image"?(x.text?"Photo: "+x.text:"Photo"):x.kind==="item"?"Item: "+(x.iname||""):x.text;
const sum=x=>adOf(x)?"Trade ad":stOf(x)?"Sticker":wlOf(x)?wlNm(x):x.kind==="mm"?"Middleman request: "+(x.mm||""):x.kind==="image"?(x.text?"Photo: "+x.text:"Photo"):x.kind==="item"?"Item: "+(x.iname||""):x.text;
async function loadProfiles(ids){ids=[...new Set(ids)].filter(i=>i&&!prof[i]);if(!ids.length)return;
 try{const r=await EMAuth.rest("profiles?select=id,username,role,avatar&id=in.("+ids.slice(0,60).join(",")+")");r.forEach(p=>prof[p.id]=p);ids.forEach(i=>{if(!prof[i])prof[i]={}})}catch(e){ids.forEach(i=>{prof[i]={}})}}
function build(){
 const m=new Map();
 ALL.forEach(x=>{const out=x.sender_id===UID,oid=out?x.recipient_id:x.sender_id,on=out?x.recipient_name:x.sender_name,ch=chOf(x),k=key(oid,ch);
  let c=m.get(k);if(!c){c={key:k,id:oid,name:on,ch,last:x,unread:0};m.set(k,c)}
  if(!out&&(NEW11?!x.read_at:(!reads[k]||x.created_at>reads[k]))&&!isCur(oid,ch))c.unread++});
 if(draft){const k=key(draft.id,draft.ch);if(!m.has(k))m.set(k,{key:k,id:draft.id,name:draft.name,ch:draft.ch||"personal",last:null,unread:0})}
 CONV=[...m.values()]}
function paintTabs(){const t=$("#dm-tabs");if(!t)return;
 const tabOf=c=>c.ch==="trade"?"trade":isFr(c.id)?"friends":"others",n={friends:0,others:0,trade:0,group:0};CONV.forEach(c=>n[tabOf(c)]+=c.unread);GCONV.forEach(c=>n.group+=c.unread);
 t.hidden=!!q.trim();
 t.innerHTML=[["friends","Friends"],["others","People"],["trade","Trade"],["group","Group"]].map(a=>'<button type="button" data-tab="'+a[0]+'" class="'+(TAB===a[0]?"on":"")+'">'+a[1]+(n[a[0]]?'<i>'+(n[a[0]]>99?"99+":n[a[0]])+"</i>":"")+"</button>").join("")}
function paintList(){
 const s=q.trim().toLowerCase(),SO=window.EMSocial&&EMSocial.loaded&&!EMSocial.missing;
 const card=c=>`<button class="dm-c ${isCur(c.id,c.ch)?"on":""}" data-id="${esc(c.id)}" data-ch="${c.ch}" data-n="${esc(c.name)}">${av(c.id,c.name)}<span class="dm-ct"><b><span>${esc(c.name)}</span>${adm(c.id)}${c.ch==="trade"?'<i class="dm-fr tr">Trade</i>':frTag(c.id)}</b><small>${c.last?(c.last.sender_id===UID?"You: ":"")+esc(sum(c.last)):"New conversation"}</small></span><span class="dm-ci">${c.last?"<time>"+short(c.last.created_at)+"</time>":""}${c.unread?'<span class="dm-un">'+(c.unread>99?"99+":c.unread)+"</span>":""}</span></button>`;
 const gcard=c=>`<button class="dm-c ${cur&&cur.grp&&cur.id===c.id?"on":""}" data-grp="${esc(c.id)}"><span class="dm-av gav">${c.kind==="mm"?"MM":"G"}</span><span class="dm-ct"><b><span>${esc(c.name)}</span><i class="dm-fr gr">${c.kind==="mm"?"Middleman":"Group"}</i></b><small>${c.last?(c.last.kind==="sys"?"":esc(c.last.sender_name)+": ")+esc(gsum(c.last)):"New group"}</small></span><span class="dm-ci">${c.last?"<time>"+short(c.last.created_at)+"</time>":""}${c.unread?'<span class="dm-un">'+(c.unread>99?"99+":c.unread)+"</span>":""}</span></button>`;
 const fcard=(id,n)=>`<button class="dm-c ${cur&&cur.id===id?"on":""}" data-id="${esc(id)}" data-n="${esc(n)}">${av(id,n)}<span class="dm-ct"><b><span>${esc(n)}</span>${adm(id)}<i class="dm-fr">Friend</i></b><small>Friend, say hi</small></span></button>`;
 const req=r=>{const n=pname(r.requester_id)||"Member";return`<div class="dm-req" data-rid="${esc(r.id)}">${av(r.requester_id,n)}<span class="dm-ct"><b><span>${esc(n)}</span></b><small>wants to be your friend</small></span><span class="dm-rb"><button data-racc type="button">Accept</button><button data-rdec type="button" class="sec">Decline</button></span></div>`};
 const reqs=SO?EMSocial.incoming():[],inConv=new Set(CONV.filter(c=>c.ch!=="trade").map(c=>c.id));
 let fr=SO?EMSocial.friends().filter(id=>!inConv.has(id)&&pname(id)).map(id=>({id,n:pname(id)})):[];
 let h="";
 if(NOTIF.length&&!s)h+='<div class="dm-sec">Middleman requests ('+NOTIF.length+')</div>'+NOTIF.map(n=>{const p=n.payload||{};return'<div class="dm-nt" data-nid="'+esc(n.id)+'"><b>'+esc(n.text)+'</b><small>'+esc(day(n.created_at)+", "+fmtT(n.created_at)+" \u00b7 accept within "+Math.max(1,Math.ceil((MMT-(Date.now()-Date.parse(n.created_at)))/6e4))+" min")+'</small><span class="dm-ntb"><button type="button" data-nacc>Accept</button>'+(p.a?'<button type="button" data-nmsg="'+esc(p.a)+'" data-nn="'+esc(p.an)+'">Message '+esc(p.an)+'</button>':"")+(p.b?'<button type="button" data-nmsg="'+esc(p.b)+'" data-nn="'+esc(p.bn)+'">Message '+esc(p.bn)+'</button>':"")+'<button type="button" class="sec" data-ndel>Decline</button></span></div>'}).join("");
 const mine=CONV.filter(c=>!s||c.name.toLowerCase().includes(s));
 if(s){fr=fr.filter(f=>f.n.toLowerCase().includes(s));
  h+=mine.length?'<div class="dm-sec">Conversations</div>'+mine.map(card).join(""):"";
  {const gm=GCONV.filter(c=>c.name.toLowerCase().includes(s));h+=gm.length?'<div class="dm-sec">Groups</div>'+gm.map(gcard).join(""):""}
  h+=fr.length?'<div class="dm-sec">Friends</div>'+fr.map(f=>fcard(f.id,f.n)).join(""):"";
  const shown=new Set([...mine.map(c=>c.id),...fr.map(f=>f.id)]);
  const others=people.filter(p=>!shown.has(p.id));
  h+=others.length?'<div class="dm-sec">People</div>'+others.map(p=>`<button class="dm-c" data-id="${esc(p.id)}" data-n="${esc(p.username)}">${av(p.id,p.username)}<span class="dm-ct"><b><span>${esc(p.username)}</span>${p.role==="admin"?'<i class="dm-ad">ADMIN</i>':""}${frTag(p.id)}</b><small>Start a conversation</small></span></button>`).join(""):"";
  if(!h)h='<div class="dm-none">Nobody found.</div>'}
 else{
  const tabOf=c=>c.ch==="trade"?"trade":isFr(c.id)?"friends":"others",tl=CONV.filter(c=>tabOf(c)===TAB);
  if(reqs.length)h+='<div class="dm-sec">Friend requests ('+reqs.length+')</div>'+reqs.map(req).join("");
  if(TAB==="group"){h+=grpOk?'<button class="dm-newg" data-newg type="button">+ New group chat</button>':"";h+=!grpOk?'<div class="dm-none"><b>Group chats are not set up yet.</b><br>Run <code>supabase-setup-13.sql</code> once in the Supabase SQL Editor, then refresh.</div>':GCONV.length?GCONV.map(gcard).join(""):'<div class="dm-none">No group chats yet.<br>Make one with the button above, or wait for a middleman to accept your request.</div>'}else{
  h+=tl.map(card).join("");
  if(TAB==="friends")h+=fr.map(f=>fcard(f.id,f.n)).join("");
  if(!tl.length&&!(TAB==="friends"&&fr.length))h+='<div class="dm-none">'+(TAB==="friends"?"No friends here yet.<br>Add friends from their profile or from a chat.":TAB==="others"?"No chats with people you haven't added.<br>Search a member above to say hi.":"No trade chats yet.<br>Press \u201cTalk to the trader\u201d on a trade ad.")+"</div>";}
  paintTabs()}
 $("#dm-list").innerHTML=h}
function paintHead(){const h=$("#dm-ha");if(!h||!cur)return;
 let b='<a class="dm-hb" href="profile.html?u='+encodeURIComponent(cur.name)+'">Profile</a>';
 if(window.EMSocial&&EMSocial.loaded&&!EMSocial.missing){const r=EMSocial.rel(cur.id).kind;
  b+=r==="none"?'<button class="dm-hb pri" data-fr="req" type="button">Add friend</button>':r==="out"?'<span class="dm-hb mute">Request sent</span>':r==="in"?'<button class="dm-hb pri" data-fr="acc" type="button">Accept request</button>':'<span class="dm-hb ok">Friends</span>'}
 h.innerHTML=b}
function mmTail(x,nm,both,mine,other){
 if(both){
  if(x.mst==="accepted")return'<div class="mm-d">'+esc(nm)+' accepted.</div>'+(x.mgid?'<button class="mm-go" data-go="'+esc(x.mgid)+'" type="button">Go to the group \u2192</button>':"");
  if(x.mst==="declined")return'<div class="mm-x">'+esc(nm)+' didn\'t accept</div>';
  if(x.mat&&Date.now()-Date.parse(x.mat)>MMT)return'<div class="mm-x">'+esc(nm)+' didn\'t accept in time</div>';
  return'<div class="mm-d">Both confirmed. '+esc(nm)+' was notified'+(x.mat?" and has 10 minutes to accept\u2026":".")+"</div>"}
 return mine?'<div class="mm-w">Waiting for '+esc(other)+" to confirm\u2026</div>":'<button class="mm-b" data-mm type="button">Click to confirm</button>'}
/* ---------- reactions ---------- */
const rxName=id=>id===UID?"You":(pname(id)||((GMEM[cur&&cur.id]||[]).find(m=>m.user_id===id)||{}).username||"Member");
function rxHtml(x){const m=RX[x.id];if(!m)return"";const o=RXK.filter(k=>m[k]&&m[k].length);if(!o.length)return"";
 return'<span class="rxs">'+o.map(k=>'<button type="button" class="rxc'+(m[k].includes(UID)?" me":"")+'" data-rx="'+k+'" title="'+esc(m[k].map(rxName).join(", "))+'">'+RXE[k]+" <b>"+m[k].length+"</b></button>").join("")+"</span>"}
function withRx(h,x){if(x.kind==="sys"||x.kind==="mm")return h;const i=h.indexOf(">");
 return h.slice(0,i+1)+'<button class="rxo" data-rxo type="button" aria-label="React" title="React">'+SMILE+"</button>"+h.slice(i+1).replace(/<\/div>$/,rxHtml(x)+"</div>")}
const repaintCur=()=>{if(!cur)return;if(cur.grp)paintGroup(false);else paintChat(false)};
async function loadRx(){if(!rxOk||!cur||rxBusy)return false;const grp=!!cur.grp,id=cur.id;
 const ids=(grp?(GM[id]||[]):MSGS).filter(m=>m.kind!=="sys"&&m.kind!=="mm").map(m=>m.id).slice(-300);
 if(!ids.length){const had=!!rxSig;RX={};rxSig="";return had}
 try{const r=await EMAuth.rest("rpc/msg_reactions_get","POST",{p_scope:grp?"grp":"dm",p_ids:ids});
  if(rxBusy||!cur||cur.id!==id)return false;
  const sig=r.map(x=>x.msg_id+x.user_id+x.emoji).sort().join("|");if(sig===rxSig)return false;rxSig=sig;
  const n={};r.forEach(x=>{const m=n[x.msg_id]=n[x.msg_id]||{};(m[x.emoji]=m[x.emoji]||[]).push(x.user_id)});RX=n;return true}
 catch(e){if(setup(e)||/function|schema cache/i.test(e.message))rxOk=false;return false}}
async function react(id,k){const grp=!!(cur&&cur.grp),m=RX[id]=RX[id]||{},a=m[k]=m[k]||[],i=a.indexOf(UID);
 if(i>=0)a.splice(i,1);else a.push(UID);rxBusy++;repaintCur();
 try{await EMAuth.rest("rpc/msg_react","POST",{p_scope:grp?"grp":"dm",p_id:id,p_emoji:k});rxSig=""}
 catch(e){const j=a.indexOf(UID);if(i>=0){if(j<0)a.push(UID)}else if(j>=0)a.splice(j,1);repaintCur();
  errEl().textContent=setup(e)||/function|schema cache/i.test(e.message)?NEED17:"Couldn't react: "+e.message}
 finally{rxBusy--}}
function placePop(btn,out){const r=btn.getBoundingClientRect();pop.style.top=Math.max(8,Math.min(innerHeight-pop.offsetHeight-8,r.bottom+4))+"px";
 pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,out?r.right-pop.offsetWidth:r.left))+"px"}
function openRx(btn){closePop();const el=btn.closest(".dm-m"),id=el.dataset.id,m=RX[id]||{},out=el.classList.contains("out");
 pop=document.createElement("div");pop.className="dm-pop rxp";
 pop.innerHTML=RXK.map(k=>'<button type="button" data-rxk="'+k+'" class="'+((m[k]||[]).includes(UID)?"on":"")+'" aria-label="'+k+'">'+RXE[k]+"</button>").join("");
 document.body.appendChild(pop);placePop(btn,out);
 pop.onclick=ev=>{const b=ev.target.closest("[data-rxk]");if(!b)return;closePop();react(id,b.dataset.rxk)}}
function msgHtml(x){const h=msgHtml0(x);return editing&&editing.id===x.id?h:withRx(h,x)}
function msgHtml0(x){
 const out=x.sender_id===UID,id=esc(x.id),mo='<button class="mo" data-mo type="button" aria-label="Message options" title="Options">\u22ef</button>',
  tm="<time"+(x.edited_at?' title="Edited '+esc(new Date(x.edited_at).toLocaleString())+'"':"")+">"+fmtT(x.created_at)+(x.edited_at?' <em class="ed">\u00b7 edited</em>':"")+"</time>";
 if(x.kind==="mm"){const nm=x.mm||"",sOk=x.ms==="true",rOk=x.mr==="true",mine=out?sOk:rOk,both=sOk&&rOk,other=out?pname(x.recipient_id)||x.recipient_name:x.sender_name;
  const line=(n,ok)=>'<li class="'+(ok?"ok":"")+'"><i>'+(ok?"\u2713":"")+"</i>"+esc(n)+(ok?" confirmed":" waiting\u2026")+"</li>";
  return`<div class="dm-m mmq ${out?"out":"in"}${both?" done":""}" data-id="${id}">${mo}<div class="mm-t">Middleman request</div><div class="mm-n">${esc(nm)}</div><ul>${line(x.sender_name,sOk)}${line(x.recipient_name,rOk)}</ul>${mmTail(x,nm,both,mine,other)}${tm}</div>`}
  {const wl=wlOf(x);if(wl)return`<div class="dm-m wlm ${out?"out":"in"}" data-id="${id}">${mo}${wlCard(wl)}${tm}</div>`}
  {const st=stOf(x);if(st)return`<div class="dm-m stk ${out?"out":"in"}" data-id="${id}">${mo}${st.src?'<img class="dm-stk" src="'+st.src+'" alt="Sticker">':'<span class="dm-stkx">Sticker</span>'}${tm}</div>`}
  {const aid=adOf(x);if(aid)return`<div class="dm-m adm ${out?"out":"in"}" data-id="${id}">${mo}<div class="dm-adc" data-adc="${aid}">${ADC[aid]!==undefined?adBox(ADC[aid],"Trade ad"):'<div class="dm-adc-n">Loading trade ad\u2026</div>'}</div>${tm}</div>`}
 if(editing&&editing.id===x.id)return`<div class="dm-m ${out?"out":"in"} ed-box" data-id="${id}"><textarea id="dm-ed" maxlength="1000" rows="2">${esc(editing.text)}</textarea><div class="ed-b"><button type="button" data-edsave>Save</button><button type="button" data-edcancel class="sec">Cancel</button></div><div class="ed-e" id="dm-ede"></div></div>`;
 if(x.kind==="image"){const u=IMG[x.id];
  return`<div class="dm-m pic ${out?"out":"in"}" data-id="${id}">${mo}${u?'<img class="dm-pic" data-pic="'+id+'" src="'+esc(u)+'" alt="Picture">':'<div class="dm-pic ph" data-pic="'+id+'">Loading picture\u2026</div>'}${x.text?'<div class="dm-cap">'+esc(x.text)+"</div>":""}${tm}</div>`}
 if(x.kind==="item"){const n=x.iname||"",i=BYN[n];
  return`<div class="dm-m itm ${out?"out":"in"}" data-id="${id}">${mo}<button class="dm-it" data-item="${esc(n)}" type="button">${i?thumb(n):'<span class="th g">?</span>'}<span class="dm-itx"><b>${esc(n)}</b><span>${i?esc(price(i.p))+(i.stars?" \u00b7 "+stars(i.stars):""):"Item not found"}</span><em>Tap to see the item info</em></span></button>${tm}</div>`}
 return`<div class="dm-m ${out?"out":"in"}" data-id="${id}">${mo}${esc(x.text)}${tm}</div>`}
function paintChat(stick){
 const r=$("#dm-r");
 if(!cur){r.innerHTML='<div class="dm-empty"><div>'+ICON+'<h3>Your messages</h3>Pick a conversation on the left,<br>or search a member to start a new one.</div></div>';root.classList.remove("chat");return}
 if(cur.grp)return paintGroup(stick);
 if(!$("#dm-msgs")||r.dataset.id!==key(cur.id,cur.ch)){
  r.dataset.id=key(cur.id,cur.ch);pendImg=null;
  r.innerHTML=`<div class="dm-rh"><button class="dm-back" id="dm-back" type="button">\u2039 Back</button>${av(cur.id,cur.name)}<b>${esc(cur.name)}</b>${adm(cur.id)}${cur.ch==="trade"?'<i class="dm-fr tr">Trading chat</i>':""}<span class="dm-ha" id="dm-ha"></span></div><div class="dm-adb" id="dm-adb" hidden></div><div class="dm-msgs" id="dm-msgs"></div><div class="dm-err" id="dm-err"></div><div class="dm-pend" id="dm-pend" hidden></div><div class="dm-f"><div class="dm-pw"><button class="dm-plus" id="dm-plus" type="button" aria-label="Send a picture or an item">${PLUS}</button><div class="dm-menu" id="dm-menu" hidden><button type="button" data-add="img">Send a picture</button><button type="button" data-add="item">Send an item</button><button type="button" data-add="wl">Send my wishlist</button><button type="button" data-add="inv">Send my inventory</button><button type="button" data-add="stk">Stickers</button><button type="button" data-add="mm">Request a middleman</button></div><div class="dm-stp" id="dm-stp" hidden></div></div><textarea id="dm-in" maxlength="1000" rows="1" placeholder="Message ${esc(cur.name)}\u2026"></textarea><button id="dm-send" type="button">Send</button></div><input type="file" id="dm-file" accept="image/*" hidden>`;stick=true;paintHead();paintAdb()}
 const box=$("#dm-msgs"),near=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 const lo=[...MSGS].reverse().find(m=>m.sender_id===UID),SEENID=lo&&lo.read_at?lo.id:null;let h="",d="";MSGS.forEach(x=>{const k=day(x.created_at);if(k!==d){d=k;h+='<div class="dm-day">'+k+"</div>"}h+=msgHtml(x)+(x.id===SEENID?'<div class="dm-seen">Seen '+fmtT(x.read_at)+"</div>":"")});
 if(!MSGS.length)h='<div class="dm-none" style="margin:auto">No messages yet. Say hi</div>';
 box.innerHTML=h;if(stick||near)box.scrollTop=box.scrollHeight;loadPics();loadAds();paintAdb()}
/* pictures are fetched one by one, so the message list stays light */
async function loadPics(){
 const grp=!!(cur&&cur.grp),need=(grp?(GM[cur.id]||[]):MSGS).filter(x=>x.kind==="image"&&!IMG[x.id]&&!PICREQ[x.id]);
 for(const x of need){PICREQ[x.id]=1;
  try{const r=await EMAuth.rest((grp?"group_msgs":"dms")+"?id=eq."+encodeURIComponent(x.id)+"&select=img:payload->>img");
   if(r&&r[0]&&r[0].img){IMG[x.id]=r[0].img;const el=document.querySelector('[data-pic="'+x.id+'"]');
    if(el){const im=document.createElement("img");im.className="dm-pic";im.dataset.pic=x.id;im.alt="Picture";im.src=r[0].img;el.replaceWith(im);const b=$("#dm-msgs")||$("#gp-msgs");if(b&&b.scrollHeight-b.scrollTop-b.clientHeight<400)b.scrollTop=b.scrollHeight}}}
  catch(e){delete PICREQ[x.id]}}}
const pair=(id,ch)=>"dms?select="+COLS+(NEW10?"&channel=eq."+(ch==="trade"?"trade":"personal"):"")+"&or=(and(sender_id.eq."+UID+",recipient_id.eq."+id+"),and(sender_id.eq."+id+",recipient_id.eq."+UID+"))&order=created_at.asc&limit=400";
async function rest(fn){try{return await fn()}catch(e){
 if(NEW11&&/read_at/i.test(e.message)){NEW11=false;COLS=EXT10;return await rest(fn)}
 if(NEW10&&/channel/i.test(e.message)){NEW10=false;NEW11=false;COLS=EXT9;return await rest(fn)}
 if(NEW9&&/edited_at/i.test(e.message)){NEW9=false;NEW10=false;NEW11=false;COLS=EXT;return await rest(fn)}
 if(NEW8&&/kind|payload/i.test(e.message)){NEW8=false;NEW9=false;NEW10=false;NEW11=false;COLS=BASE;return await fn()}throw e}}
const sigOf=m=>m.length+":"+(m.length?m[m.length-1].id:"")+":"+m.map(x=>(x.edited_at||"")+(x.ms||"")+(x.mr||"")+(x.mst||"")+(x.mat&&!x.mst&&Date.now()-Date.parse(x.mat)>MMT?"x":"")+(x.read_at?"r":"")).join("|");
async function loadNotifs(){if(!notifOk||!NEW9)return;
 try{NOTIF=await EMAuth.rest("notifications?select=id,text,payload,created_at&order=created_at.desc&limit=30");
  const old=NOTIF.filter(n=>Date.now()-Date.parse(n.created_at)>=MMT);
  if(old.length){NOTIF=NOTIF.filter(n=>Date.now()-Date.parse(n.created_at)<MMT);old.forEach(n=>EMAuth.rest("notifications?id=eq."+encodeURIComponent(n.id),"DELETE").catch(()=>{}))}}
 catch(e){NOTIF=[];if(setup(e))notifOk=false}}
async function tick(first){
 try{
  ALL=vis(await rest(()=>EMAuth.rest("dms?select="+COLS+"&or=(sender_id.eq."+UID+",recipient_id.eq."+UID+")&order=created_at.desc&limit=600")));
  if(window.EMSocial&&(first||tk%3===0)){await EMSocial.load()}tk++;
  const fids=window.EMSocial&&EMSocial.loaded&&!EMSocial.missing?[...EMSocial.friends(),...EMSocial.incoming().map(r=>r.requester_id)]:[];
  await loadProfiles([...ALL.map(x=>x.sender_id===UID?x.recipient_id:x.sender_id),...fids]);
  await loadGroups();
  if(cur&&cur.grp&&grpOk&&!GL.some(g=>g.id===cur.id)){cur=null;root.classList.remove("chat");$("#dm-r").dataset.id="";paintChat();alert("This group chat was closed.")}
  if(cur&&cur.grp){if(sigG(cur.id)!==gSig||first)paintGroup(false);gRead()}
  else if(cur){const m=vis(await rest(()=>EMAuth.rest(pair(cur.id,cur.ch))));const sig=sigOf(m);
   if(sig!==lastSig||first){lastSig=sig;MSGS=m;paintChat(false)}
   paintHead();if(!document.hidden){markRead(key(cur.id,cur.ch));seenPing()}}
  if(cur&&await loadRx())repaintCur();
  await loadNotifs();build();buildG();paintList()}
 catch(e){if(first){$("#dm-list").innerHTML=setup(e)?SETUPMSG:'<div class="dm-none">Couldn\'t load messages: '+esc(e.message)+"</div>"}}}
async function open(id,name,ch,pre){ch=ch==="trade"?"trade":"personal";
 if(ch==="trade"&&!NEW10){alert(NEED10);ch="personal"}
 cur={id,name,ch};RX={};rxSig="";editing=null;gediting=null;lastSig="";MSGS=[];root.classList.add("chat");draft=CONV.some(c=>c.key===key(id,ch))?draft:{id,name,ch};
 if(ch==="trade")TAB="trade";else TAB=isFr(id)?"friends":"others";sv("dm_tab",TAB);
 await loadProfiles([id]);paintChat(true);build();paintList();
 try{MSGS=vis(await rest(()=>EMAuth.rest(pair(id,ch))));lastSig=sigOf(MSGS);markRead(key(id,ch));paintChat(true);build();paintList();seenPing()}
 catch(e){const b=$("#dm-err");if(b)b.textContent=setup(e)?"Run supabase-setup-6.sql in Supabase first.":e.message}
 const i=$("#dm-in");if(i){if(pre&&!i.value&&!MSGS.length)i.value=pre;if(innerWidth>820)i.focus()}
 loadRx().then(c=>{if(c&&cur&&!cur.grp&&cur.id===id)paintChat(false)})}
/* one place that writes a message */
async function post(fields){
 const body=Object.assign({sender_id:UID,recipient_id:cur.id,sender_name:ME,recipient_name:cur.name},cur.ch==="trade"?{channel:"trade"}:{},fields);
 const r=await EMAuth.rest("dms?select="+COLS,"POST",body,{Prefer:"return=representation"});const m=r[0];
 if(fields.kind==="image"&&m){IMG[m.id]=fields.payload.img}
 if(fields.kind==="item"&&m&&!m.iname)m.iname=fields.payload.n;
 MSGS.push(m);ALL.unshift(m);lastSig=sigOf(MSGS);markRead(key(cur.id,cur.ch));draft=null;paintChat(true);build();paintList()}
let stkPack=null;
function openStk(){const p=stp();if(!p)return;stkPack=null;paintStk();p.hidden=false}
function paintStk(){const p=stp(),S=window.EM_STICKERS||{},names=Object.keys(S);if(!p)return;
 if(!names.length){p.innerHTML='<div class="dm-stn">Stickers didn\'t load. Upload stickers.js and refresh.</div>';return}
 if(!stkPack){p.innerHTML='<div class="dm-stt">Stickers</div><div class="dm-stpk">'+names.map(n=>'<button type="button" data-pack="'+n+'"><img src="'+S[n].items[0]+'" alt=""><b>'+esc(S[n].name)+'</b></button>').join("")+'</div>';return}
 const pk=S[stkPack];p.innerHTML='<div class="dm-stt"><button type="button" data-stkback class="dm-stb" aria-label="Back">\u2039</button><b>'+esc(pk.name)+'</b></div><div class="dm-stg">'+pk.items.map((u,i)=>'<button type="button" data-stk="'+stkPack+(i+1)+'"><img src="'+u+'" alt="Sticker '+(i+1)+'"></button>').join("")+'</div>'}
async function sendWishlist(kind){if(!cur)return;errEl().textContent="";const inv=kind==="inv",L=myList(inv?"favn":"wishn");
 if(!L.length){errEl().textContent=inv?"Your inventory is empty. Open the catalog and tap the heart on the items you own, then come back.":"Your wishlist is empty. Open an item in the catalog and tap the bookmark icon under it, then come back.";return}
 const pre="[["+(inv?"inv":"wl")+":",parts=[];let t=pre,n=0,tot=0;
 for(const r of L){const nm=String(r[0]).replace(/[|*\[\]]/g,""),q=Math.max(1,Math.min(99,+r[1]||1)),p=nm+(q>1?"*"+q:"");const nx=t+(n?"|":"")+p;
  if(nx.length>996&&n){parts.push(t+"]]");t=pre+p;n=1}else{t=nx;n++}tot++}
 if(n)parts.push(t+"]]");
 const MAXP=5,send=parts.slice(0,MAXP);let sent=0;
 try{for(const m of send){if(cur.grp)await postG({kind:"text",text:m});else{await sendAdMark();await post(NEW8?{kind:"text",text:m}:{text:m})}sent++}
  if(parts.length>MAXP)errEl().textContent="Sent the first "+MAXP+" messages of your "+(inv?"inventory":"wishlist")+". The rest was too long to send."}
 catch(e){errEl().textContent="Couldn\'t send: "+e.message+(sent?" ("+sent+" of "+send.length+" parts were sent.)":"")}}
async function sendSticker(v){if(!cur)return;errEl().textContent="";try{if(cur.grp)await postG({kind:"text",text:"[["+"st:"+v+"]]"});else{await sendAdMark();await post(NEW8?{kind:"text",text:"[["+"st:"+v+"]]"}:{text:"[["+"st:"+v+"]]"})}}catch(e){errEl().textContent="Couldn\'t send: "+e.message}}
/* tell the other person their messages were seen */
let pingBusy=false;
async function seenPing(){if(!NEW11||!cur||document.hidden||pingBusy)return;const un=MSGS.filter(m=>m.sender_id!==UID&&!m.read_at);if(!un.length)return;pingBusy=true;
 try{await EMAuth.rest("rpc/dm_mark_read","POST",{p_other:cur.id,p_channel:cur.ch});const t=new Date().toISOString();un.forEach(m=>m.read_at=t);ALL.forEach(m=>{if(m.sender_id===cur.id&&chOf(m)===cur.ch&&!m.read_at)m.read_at=t});build();paintList()}
 catch(e){if(/function|schema cache|read_at/i.test(e.message))NEW11=false}
 pingBusy=false}
async function sendAdMark(){const a=adCtx;if(!a||!cur||cur.ch!=="trade"||a.uid!==cur.id)return;adCtx=null;if(MSGS.some(m=>adOf(m)===a.id))return;ADC[a.id]=a.ad;await post(NEW8?{kind:"text",text:"[[ad:"+a.id+"]]"}:{text:"[[ad:"+a.id+"]]"})}
async function send(){
 const i=$("#dm-in"),b=$("#dm-send"),t=i.value.trim();if(!cur)return;if(!t&&!pendImg)return;$("#dm-err").textContent="";b.disabled=true;
 try{
  if(pendImg){if(!NEW8)throw new Error(NEED8);await post({kind:"image",text:t,payload:{img:pendImg}});pendImg=null;paintPend()}
  else{await sendAdMark();await post(NEW8?{kind:"text",text:t}:{text:t})}
  i.value=""}
 catch(e){$("#dm-err").textContent=setup(e)||/dms_content_check|violates check/i.test(e.message)?(/dms_content_check|violates check/i.test(e.message)?"The server refused it. Run supabase-setup-8.sql in Supabase first.":"Run supabase-setup-6.sql in Supabase first."):"Couldn't send: "+e.message}
 b.disabled=false;i.focus()}
async function sendItem(n){
 closeOv();if(!cur)return;errEl().textContent="";
 try{if(cur.grp){if(!GNEW)throw new Error(NEED17);await postG({kind:"item",text:"",payload:{n}});return}
  if(!NEW8)throw new Error(NEED8);await post({kind:"item",text:"",payload:{n}})}
 catch(e){errEl().textContent=/dms_content_check|group_msgs_content_check|violates check|row-level/i.test(e.message)?(cur&&cur.grp?NEED17:"The server refused it. Run supabase-setup-8.sql in Supabase first."):"Couldn't send: "+e.message}}
function paintPend(){const p=$(cur&&cur.grp?"#gp-pend":"#dm-pend");if(!p)return;
 if(!pendImg){p.hidden=true;p.innerHTML="";return}
 p.hidden=false;p.innerHTML='<img src="'+esc(pendImg)+'" alt="Picture to send"><span>Picture ready. Add a message if you want, then press Send.</span><button type="button" data-unpic aria-label="Remove picture">\u2715</button>'}
/* shrink a picture so it fits in the database (max 900 px, under about 400 KB) */
function shrinkImg(file){return new Promise((ok,no)=>{const fr=new FileReader();fr.onerror=()=>no(new Error("Couldn't read that file."));
 fr.onload=()=>{const im=new Image();im.onerror=()=>no(new Error("That file isn't a picture I can open."));
  im.onload=()=>{let max=900,u="";
   for(let k=0;k<4;k++){const sc=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.max(1,Math.round(im.width*sc));c.height=Math.max(1,Math.round(im.height*sc));
    const x=c.getContext("2d");x.drawImage(im,0,0,c.width,c.height);
    for(const q of[.82,.68,.55]){u=c.toDataURL("image/webp",q);if(u.indexOf("data:image/webp")!==0)u=c.toDataURL("image/jpeg",q);if(u.length<=400000)return ok(u)}
    max=Math.round(max*.75)}
   no(new Error("That picture is too big to send."))};im.src=fr.result};fr.readAsDataURL(file)})}
/* ---------- overlays: item picker, item card, picture viewer ---------- */
let ov=null;
function closeOv(){if(ov){ov.remove();ov=null}}
function openOv(html,cls){closeOv();ov=document.createElement("div");ov.className="dm-ov "+(cls||"");ov.innerHTML=html;document.body.appendChild(ov);
 ov.addEventListener("click",e=>{if(e.target===ov||e.target.closest("[data-ovx]"))closeOv()});return ov}
function pickItems(term){const s=(term||"").trim().toLowerCase();
 const L=ITEMS.filter(i=>!s||i.n.toLowerCase().includes(s)).slice(0,80);
 return L.length?L.map(i=>`<button class="dm-pi" data-send-item="${esc(i.n)}" type="button">${thumb(i.n)}<span><b>${esc(i.n)}</b><small>${esc(TYPE[i.t]||"")} \u00b7 ${esc(price(i.p))}</small></span></button>`).join(""):'<div class="dm-none">No item found.</div>'}
function openPicker(){
 if(!HAS_ITEMS){errEl().textContent="The item list didn't load. Refresh the page.";return}
 const o=openOv('<div class="dm-box"><div class="dm-bh"><b>Send an item</b><button class="dm-cl" data-ovx type="button" aria-label="Close">\u2715</button></div><input id="dm-pq" type="search" placeholder="Search an item\u2026" autocomplete="off"><div class="dm-pl" id="dm-pl"></div></div>');
 const pl=o.querySelector("#dm-pl"),inp=o.querySelector("#dm-pq");pl.innerHTML=pickItems("");inp.oninput=()=>{pl.innerHTML=pickItems(inp.value)};
 pl.onclick=e=>{const b=e.target.closest("[data-send-item]");if(b)sendItem(b.dataset.sendItem)};if(innerWidth>820)inp.focus()}
function openCard(n){const i=BYN[n];
 if(!i){openOv('<div class="dm-box sm"><div class="dm-bh"><b>Item not found</b><button class="dm-cl" data-ovx type="button">\u2715</button></div><div class="dm-none">This item is not in the list anymore.</div></div>');return}
 const f=itemInfo(i),tags=[];if(i.r)tags.push("Retired");if(i.u)tags.push("Untradable");if(i.ub)tags.push("Unobtainable");
 const pills=[];(f.lines||[]).forEach(l=>pills.push(esc(l)));(f.chips||[]).forEach(c=>pills.push(esc(chipTxt(c))));
 const meta=[];if(f.copies)meta.push("Copies: "+esc(f.copies));if(f.aka)meta.push("AKA: "+esc(f.aka));if(f.odds)meta.push("Drop odds: "+esc(f.odds));if(f.exp)meta.push("Expired code: "+esc(f.exp));
 openOv(`<div class="dm-ic ${esc(i.t)}" role="dialog" aria-label="${esc(i.n)}"><button class="dm-cl" data-ovx type="button" aria-label="Close">\u2715</button>
  <div class="dm-ih">${thumb(i.n)}<div class="dm-in2"><h3>${esc(i.n)}</h3><span class="dm-ty">${esc(TYPE[i.t]||"Item")}</span></div></div>
  <div class="dm-ir"><span class="dm-pr">${esc(price(i.p))}</span>${i.stars?'<span class="dm-sw">'+stars(i.stars)+"<small>"+esc(SL[i.stars]||"")+"</small></span>":""}${i.trend&&TL[i.trend]?'<span class="dm-tr">'+esc(TL[i.trend])+"</span>":""}</div>
  ${tags.length?'<div class="dm-tg">'+tags.map(t=>"<i>"+t+"</i>").join("")+"</div>":""}
  ${pills.length?'<div class="dm-ln">'+pills.map(p=>"<span>"+p+"</span>").join("")+"</div>":'<p class="dm-no">No extra info for this item yet.</p>'}
  ${meta.length?'<p class="dm-mt">'+meta.join("<br>")+"</p>":""}${f.credit?'<p class="dm-cr">Credit: '+esc(f.credit)+"</p>":""}</div>`,"card")}
function openPic(src){openOv('<img class="dm-big" src="'+esc(src)+'" alt="Picture">',"pic")}
/* ---------- middleman picker, message options, edit, delete ---------- */
async function openMM(){
 const o=openOv('<div class="dm-box mmbox"><div class="dm-bh"><b>Request a middleman</b><button class="dm-cl" data-ovx type="button" aria-label="Close">\u2715</button></div><p class="mm-p">Pick an official middleman. A request is sent in this chat, and <b>both of you</b> have to click it to confirm. Then the middleman is notified and can accept.</p><div class="mm-g" id="mm-g"><div class="dm-none" style="grid-column:1/-1">Loading\u2026</div></div></div>');
 o.addEventListener("click",e=>{const b=e.target.closest("[data-pickmm]");if(b&&!b.disabled)sendMM(b.dataset.pickmm)});
 let L=[];
 try{try{L=await EMAuth.rest("profiles?select=id,username,avatar,status,last_seen,roles,mm_status&roles=cs.%7Bofficial_middleman%7D&limit=60")}
  catch(e0){L=await EMAuth.rest("profiles?select=id,username,avatar,status,last_seen,roles&roles=cs.%7Bofficial_middleman%7D&limit=60");L.forEach(x=>x.mm_status=null)}}
 catch(e){if(ov===o){const g=o.querySelector("#mm-g");if(g)g.innerHTML='<div class="dm-none" style="grid-column:1/-1">'+(setup(e)||/roles/i.test(e.message)?"Run supabase-setup-12.sql and supabase-setup-13.sql in Supabase first.":"Couldn\'t load the middlemen: "+esc(e.message))+"</div>"}return}
 if(ov!==o)return;
 L=L.filter(x=>x.id!==UID&&!(cur&&x.id===cur.id));
 L.forEach(m=>{prof[m.id]=Object.assign(prof[m.id]||{},m)});
 const PR=window.EMPresence,M={ready:{n:"Ready to MM",c:"#3bb26b"},slow:{n:"Able to MM, might take a while to answer",c:"#f0b232"},cannot:{n:"Cannot MM",c:"#e5484d"}},g=o.querySelector("#mm-g");if(!g)return;
 L.sort((a,b)=>{const r={ready:0,slow:1,cannot:2};return((r[a.mm_status]==null?0:r[a.mm_status])-(r[b.mm_status]==null?0:r[b.mm_status]))||a.username.localeCompare(b.username)});
 g.innerHTML=L.length?L.map(m=>{const a=m.mm_status,ok=a!=="cannot",s=PR?PR.eff(m):"offline";
  return'<button type="button" class="mm-sq'+(ok?"":" off")+'" data-pickmm="'+esc(m.username)+'"'+(ok?"":" disabled")+'>'+av(m.id,m.username)+'<b>'+esc(m.username)+'</b>'+(PR&&PR.STATUS[s]?'<em class="mm-on"><i class="em-dot" style="background:'+PR.STATUS[s].c+'"></i>'+PR.STATUS[s].n+'</em>':"")+(a&&M[a]?'<em class="mm-av" style="color:'+M[a].c+'">'+M[a].n+'</em>':"")+"</button>"}).join(""):'<div class="dm-none" style="grid-column:1/-1">No official middleman yet.</div>'}
async function sendMM(n){
 closeOv();if(!cur)return;$("#dm-err").textContent="";
 try{await post({kind:"mm",text:"",payload:{mm:n,s:false,r:false}})}
 catch(e){$("#dm-err").textContent=/dms_content_check|violates|row-level/i.test(e.message)?NEED9:"Couldn't send: "+e.message}}
function closePop(){if(pop){pop.remove();pop=null}}
function openMo(btn){closePop();
 const el=btn.closest(".dm-m"),x=MSGS.find(m=>m.id===el.dataset.id);if(!x)return;const out=x.sender_id===UID;
 pop=document.createElement("div");pop.className="dm-pop";
 let h="";if(out&&!adOf(x)&&!stOf(x)&&!wlOf(x)&&(x.kind==="text"||x.kind==="image"))h+='<button type="button" data-a="edit">Edit message</button>';
 h+=out?'<button type="button" data-a="del" class="dg">Delete for both of us</button>':'<button type="button" data-a="hide" class="dg">Delete for me</button>';
 pop.innerHTML=h;document.body.appendChild(pop);
 const r=btn.getBoundingClientRect();pop.style.top=Math.min(innerHeight-pop.offsetHeight-8,r.bottom+4)+"px";
 pop.style.left=Math.max(8,Math.min(innerWidth-pop.offsetWidth-8,out?r.right-pop.offsetWidth:r.left))+"px";
 pop.onclick=async ev=>{const a=ev.target.closest("[data-a]");if(!a)return;closePop();const id=x.id;
  if(a.dataset.a==="edit"){if(!NEW9){$("#dm-err").textContent=NEED9;return}editing={id,text:x.text||""};paintChat(false);const t=$("#dm-ed");if(t){t.focus();t.setSelectionRange(t.value.length,t.value.length)}}
  else if(a.dataset.a==="hide"){hid[id]=1;sv(HK,hid);MSGS=MSGS.filter(m=>m.id!==id);ALL=ALL.filter(m=>m.id!==id);lastSig=sigOf(MSGS);paintChat(false);build();paintList()}
  else{if(!confirm("Delete this message for both of you?"))return;
   try{const r=await EMAuth.rest("dms?id=eq."+encodeURIComponent(id),"DELETE",null,{Prefer:"return=representation"});if(!r||!r.length)throw new Error("the server refused it.");
    MSGS=MSGS.filter(m=>m.id!==id);ALL=ALL.filter(m=>m.id!==id);lastSig=sigOf(MSGS);paintChat(false);build();paintList()}catch(err){$("#dm-err").textContent="Couldn't delete: "+err.message}}}}
async function saveEdit(){
 if(!editing)return;const t=$("#dm-ed"),x=MSGS.find(m=>m.id===editing.id),er=$("#dm-ede");if(!t||!x)return;const v=t.value.trim();
 if(v===(x.text||"").trim()){editing=null;paintChat(false);return}
 if(!v&&x.kind==="text"){er.textContent="A message can't be empty. Use Delete instead.";return}
 try{const r=await EMAuth.rest("rpc/dm_edit","POST",{p_id:x.id,p_text:v});x.text=v;x.edited_at=(typeof r==="string"&&r)||new Date().toISOString();
  const a=ALL.find(m=>m.id===x.id);if(a){a.text=v;a.edited_at=x.edited_at}editing=null;lastSig=sigOf(MSGS);paintChat(false);build();paintList()}
 catch(err){er.textContent=setup(err)||/function|schema cache/i.test(err.message)?NEED9:"Couldn't save: "+err.message}}
document.addEventListener("click",e=>{if(pop&&!e.target.closest(".dm-pop")&&!e.target.closest("[data-mo]"))closePop()});
addEventListener("resize",closePop);

/* ---------- group chats (requester + trader + middleman) ---------- */
async function loadGroups(){if(!grpOk)return;
 try{const[gs,gm,ms]=await Promise.all([EMAuth.rest("groups?select=id,name,created_at,kind,owner_id&order=created_at.desc&limit=100").catch(()=>EMAuth.rest("groups?select=id,name,created_at&order=created_at.desc&limit=100")),EMAuth.rest("group_members?select=group_id,user_id,username,last_read&limit=600"),(async()=>{try{return await EMAuth.rest("group_msgs?select="+(GNEW?GCOLS:GOLD)+GQ)}catch(e){if(GNEW&&/edited_at|payload/i.test(e.message)){GNEW=false;return await EMAuth.rest("group_msgs?select="+GOLD+GQ)}throw e}})()]);
  GL=gs;GMEM={};gm.forEach(x=>(GMEM[x.group_id]=GMEM[x.group_id]||[]).push(x));GM={};ms.reverse().forEach(x=>(GM[x.group_id]=GM[x.group_id]||[]).push(x))}
 catch(e){if(setup(e)){GL=[];GM={};GMEM={};grpOk=false}}}
function buildG(){GCONV=GL.map(g=>{const L=GM[g.id]||[],me=(GMEM[g.id]||[]).find(x=>x.user_id===UID),lr=me?Date.parse(me.last_read):0,last=L[L.length-1]||null,open=cur&&cur.grp&&cur.id===g.id&&!document.hidden;
  return{id:g.id,name:g.name,kind:g.kind,last,t:Date.parse(last?last.created_at:g.created_at),unread:open?0:L.filter(m=>m.kind!=="sys"&&m.sender_id!==UID&&Date.parse(m.created_at)>lr).length}}).sort((a,b)=>b.t-a.t)}
const sigG=id=>{const L=GM[id]||[];return L.length+":"+(L.length?L[L.length-1].id:"")+":"+L.map(x=>x.edited_at||"").join("")};
function gRead(){if(!cur||!cur.grp||document.hidden)return;const L=GM[cur.id]||[],last=L[L.length-1],me=(GMEM[cur.id]||[]).find(x=>x.user_id===UID);
 if(!last||!me||Date.parse(me.last_read)>=Date.parse(last.created_at))return;me.last_read=last.created_at;buildG();paintList();
 EMAuth.rest("rpc/group_mark_read","POST",{p_group:cur.id}).catch(()=>{})}
function gHtml(x){const out=x.sender_id===UID;
 if(x.kind==="sys")return'<div class="g-sys">'+esc(x.text)+"</div>";
 const id=esc(x.id),c=out?"out":"in gin",mo=out?'<button class="mo" data-gmo type="button" aria-label="Message options" title="Options">\u22ef</button>':"",
  nm=out?"":'<b class="g-sn">'+esc(x.sender_name)+"</b>",
  tm="<time"+(x.edited_at?' title="Edited '+esc(new Date(x.edited_at).toLocaleString())+'"':"")+">"+fmtT(x.created_at)+(x.edited_at?' <em class="ed">\u00b7 edited</em>':"")+"</time>";
 if(gediting&&gediting.id===x.id)return'<div class="dm-m '+c+' ed-box" data-id="'+id+'"><textarea id="gp-ed" maxlength="1000" rows="2">'+esc(gediting.text)+'</textarea><div class="ed-b"><button type="button" data-gedsave>Save</button><button type="button" data-gedcancel class="sec">Cancel</button></div><div class="ed-e" id="gp-ede"></div></div>';
 const st=stOf(x);
 {const wl=wlOf(x);if(wl)return'<div class="dm-m wlm '+c+'" data-id="'+id+'">'+mo+nm+wlCard(wl)+tm+'</div>'}
 if(st)return'<div class="dm-m stk '+c+'" data-id="'+id+'">'+mo+nm+(st.src?'<img class="dm-stk" src="'+st.src+'" alt="Sticker">':'<span class="dm-stkx">Sticker</span>')+tm+"</div>";
 if(x.kind==="image"){const u=IMG[x.id];
  return'<div class="dm-m pic '+c+'" data-id="'+id+'">'+mo+nm+(u?'<img class="dm-pic" data-pic="'+id+'" src="'+esc(u)+'" alt="Picture">':'<div class="dm-pic ph" data-pic="'+id+'">Loading picture\u2026</div>')+(x.text?'<div class="dm-cap">'+esc(x.text)+"</div>":"")+tm+"</div>"}
 if(x.kind==="item"){const n=x.iname||"",i=BYN[n];
  return'<div class="dm-m itm '+c+'" data-id="'+id+'">'+mo+nm+'<button class="dm-it" data-item="'+esc(n)+'" type="button">'+(i?thumb(n):'<span class="th g">?</span>')+'<span class="dm-itx"><b>'+esc(n)+"</b><span>"+(i?esc(price(i.p))+(i.stars?" \u00b7 "+stars(i.stars):""):"Item not found")+"</span><em>Tap to see the item info</em></span></button>"+tm+"</div>"}
 return'<div class="dm-m '+c+'" data-id="'+id+'">'+mo+nm+esc(x.text)+tm+"</div>"}
function paintGroup(stick){const r=$("#dm-r");if(!cur||!cur.grp)return;
 if(!$("#gp-msgs")||r.dataset.id!=="g:"+cur.id){r.dataset.id="g:"+cur.id;pendImg=null;
  const gg=GL.find(x=>x.id===cur.id)||{},mmg=gg.kind==="mm",own=gg.owner_id===UID;
  r.innerHTML=(mmg?'<div class="g-off">OFFICIAL MIDDLEMAN INTERACTION</div>':"")+'<div class="dm-rh"><button class="dm-back" id="dm-back" type="button">\u2039 Back</button><span class="dm-av gav">'+(mmg?"MM":"G")+'</span><b>'+esc(cur.name)+'</b><i class="dm-fr gr">'+(mmg?"Middleman":"Group")+'</i>'+(own?'<span class="dm-ha"><button class="dm-hb dg" data-gclose type="button">'+(mmg?"Close chat (interaction over)":"Delete group")+'</button></span>':"")+'</div><div class="g-mem" id="gp-mem"></div><div class="dm-msgs" id="gp-msgs"></div><div class="dm-err" id="gp-err"></div><div class="dm-pend" id="gp-pend" hidden></div><div class="dm-f"><div class="dm-pw"><button class="dm-plus" id="gp-plus" type="button" aria-label="Send a picture or an item">'+PLUS+'</button><div class="dm-menu" id="gp-menu" hidden><button type="button" data-gadd="img">Send a picture</button><button type="button" data-gadd="item">Send an item</button><button type="button" data-gadd="wl">Send my wishlist</button><button type="button" data-gadd="inv">Send my inventory</button><button type="button" data-gadd="stk">Stickers</button></div><div class="dm-stp" id="gp-stp" hidden></div></div><textarea id="gp-in" maxlength="1000" rows="1" placeholder="Message the group\u2026"></textarea><button id="gp-send" type="button">Send</button></div><input type="file" id="gp-file" accept="image/*" hidden>';stick=true}
 $("#gp-mem").textContent="Members: "+(GMEM[cur.id]||[]).map(m=>m.username).join(", ");
 const box=$("#gp-msgs"),near=box.scrollHeight-box.scrollTop-box.clientHeight<90,L=GM[cur.id]||[];let h="",d="";
 L.forEach(x=>{const k=day(x.created_at);if(k!==d){d=k;h+='<div class="dm-day">'+k+"</div>"}h+=gediting&&gediting.id===x.id?gHtml(x):withRx(gHtml(x),x)});
 if(!L.length)h='<div class="dm-none" style="margin:auto">No messages yet.</div>';
 box.innerHTML=h;if(stick||near)box.scrollTop=box.scrollHeight;gSig=sigG(cur.id);loadPics();
 if(gediting){const t=$("#gp-ed");if(t&&document.activeElement!==t){t.focus();t.setSelectionRange(t.value.length,t.value.length)}}}
function openGroup(id){const g=GL.find(x=>x.id===id);if(!g)return;
 cur={grp:true,id,name:g.name};RX={};rxSig="";gediting=null;editing=null;TAB="group";sv("dm_tab",TAB);root.classList.add("chat");paintChat(true);gRead();buildG();paintList();
 const i=$("#gp-in");if(i&&innerWidth>820)i.focus();loadRx().then(c=>{if(c&&cur&&cur.grp&&cur.id===id)paintGroup(false)})}
async function postG(f){
 const r=await EMAuth.rest("group_msgs?select="+(GNEW?GCOLS:GOLD),"POST",Object.assign({group_id:cur.id,sender_id:UID,sender_name:ME},f),{Prefer:"return=representation"});const m=r[0];
 if(f.kind==="image"&&m)IMG[m.id]=f.payload.img;if(f.kind==="item"&&m&&!m.iname)m.iname=f.payload.n;
 (GM[cur.id]=GM[cur.id]||[]).push(m);paintGroup(true);gRead();buildG();paintList()}
async function sendG(){const i=$("#gp-in"),b=$("#gp-send");if(!i||!cur||!cur.grp)return;const t=i.value.trim();if(!t&&!pendImg)return;b.disabled=true;$("#gp-err").textContent="";
 try{if(pendImg){if(!GNEW)throw new Error(NEED17);await postG({kind:"image",text:t,payload:{img:pendImg}});pendImg=null;paintPend()}else await postG({kind:"text",text:t});i.value=""}
 catch(e){$("#gp-err").textContent=/group_msgs_content_check|violates check|row-level/i.test(e.message)?NEED17:"Couldn't send: "+e.message}
 b.disabled=false;i.focus()}
function openGmo(btn){closePop();const el=btn.closest(".dm-m"),x=(GM[cur.id]||[]).find(m=>m.id===el.dataset.id);if(!x)return;
 pop=document.createElement("div");pop.className="dm-pop";
 pop.innerHTML=((x.kind==="text"&&!stOf(x))||x.kind==="image"?'<button type="button" data-a="edit">Edit message</button>':"")+'<button type="button" data-a="del" class="dg">Delete for everyone</button>';
 document.body.appendChild(pop);placePop(btn,true);
 pop.onclick=ev=>{const a=ev.target.closest("[data-a]");if(!a)return;closePop();
  if(a.dataset.a==="edit"){if(!GNEW){$("#gp-err").textContent=NEED17;return}gediting={id:x.id,text:x.text||""};paintGroup(false)}else delG(x.id)}}
async function saveGEdit(){if(!gediting)return;const t=$("#gp-ed"),x=(GM[cur.id]||[]).find(m=>m.id===gediting.id),er=$("#gp-ede");if(!t||!x)return;const v=t.value.trim();
 if(v===(x.text||"").trim()){gediting=null;paintGroup(false);return}
 if(!v&&x.kind==="text"){er.textContent="A message can't be empty. Use Delete instead.";return}
 try{const r=await EMAuth.rest("rpc/group_msg_edit","POST",{p_id:x.id,p_text:v});x.text=v;x.edited_at=(typeof r==="string"&&r)||new Date().toISOString();gediting=null;paintGroup(false);buildG();paintList()}
 catch(err){er.textContent=setup(err)||/function|schema cache/i.test(err.message)?NEED17:"Couldn't save: "+err.message}}
async function delG(id){if(!id||!confirm("Delete this message for everyone in the group?"))return;
 try{const r=await EMAuth.rest("group_msgs?id=eq."+encodeURIComponent(id),"DELETE",null,{Prefer:"return=representation"});if(!r||!r.length)throw new Error("the server refused it.");
  GM[cur.id]=(GM[cur.id]||[]).filter(m=>m.id!==id);paintGroup(false);buildG();paintList()}
 catch(e){$("#gp-err").textContent="Couldn't delete: "+e.message}}

async function closeG(){const g=GL.find(x=>x.id===(cur&&cur.id));if(!g)return;
 if(!confirm(g.kind==="mm"?"Close this middleman chat? The chat and all its messages will be deleted for everyone.":"Delete this group? The chat and all its messages will be deleted for everyone."))return;
 try{await EMAuth.rest("rpc/group_close","POST",{p_group:g.id});GL=GL.filter(x=>x.id!==g.id);delete GM[g.id];delete GMEM[g.id];cur=null;root.classList.remove("chat");$("#dm-r").dataset.id="";paintChat();buildG();paintList()}
 catch(e){const b=$("#gp-err");if(b)b.textContent=setup(e)||/function|schema cache/i.test(e.message)?"Run supabase-setup-14.sql in Supabase first.":"Couldn't close: "+e.message}}
function openNewG(){const sel=new Map();let res=[],tmr;
 const o=openOv('<div class="dm-box"><div class="dm-bh"><b>New group chat</b><button class="dm-cl" data-ovx type="button" aria-label="Close">\u2715</button></div><input id="ng-n" maxlength="40" placeholder="Group name" autocomplete="off"><input id="ng-q" type="search" placeholder="Add people by name (up to 9)\u2026" autocomplete="off"><div class="ng-sel" id="ng-sel"></div><div class="dm-pl" id="ng-res"></div><div class="dm-err" id="ng-err"></div><button class="ng-go" id="ng-go" type="button">Create group</button></div>');
 const $o=s=>o.querySelector(s);
 const paintSel=()=>{$o("#ng-sel").innerHTML=[...sel.values()].map(p=>'<span class="ng-chip">'+esc(p.username)+'<button type="button" data-ngx="'+esc(p.id)+'" aria-label="Remove">\u2715</button></span>').join("")};
 const paintRes=()=>{const L=res.filter(p=>!sel.has(p.id));$o("#ng-res").innerHTML=L.length?L.map(p=>'<button class="dm-pi" data-ngadd="'+esc(p.id)+'" type="button">'+av(p.id,p.username)+'<span><b>'+esc(p.username)+'</b></span></button>').join(""):'<div class="dm-none">'+($o("#ng-q").value.trim().length>1?"Nobody found.":"Type a name to find people.")+"</div>"};
 const friends=()=>window.EMSocial&&EMSocial.loaded&&!EMSocial.missing?EMSocial.friends().filter(id=>pname(id)).map(id=>({id,username:pname(id)})):[];
 res=friends();paintRes();
 $o("#ng-q").addEventListener("input",()=>{clearTimeout(tmr);const s=$o("#ng-q").value.trim();
  if(s.length<2){res=friends();paintRes();return}
  tmr=setTimeout(async()=>{try{const r=await EMAuth.rest("profiles?select=id,username,role,avatar&username=ilike."+encodeURIComponent("*"+s.replace(/[*%,()]/g,"")+"*")+"&limit=12");
   res=r.filter(p=>p.id!==UID);res.forEach(p=>{prof[p.id]=Object.assign(prof[p.id]||{},p)});paintRes()}catch(e){}},250)});
 o.addEventListener("click",async e=>{
  const ad=e.target.closest("[data-ngadd]"),rm=e.target.closest("[data-ngx]");
  if(ad){const p=res.find(x=>x.id===ad.dataset.ngadd);if(p){if(sel.size>=9){$o("#ng-err").textContent="A group can have up to 10 people, including you.";return}$o("#ng-err").textContent="";sel.set(p.id,p);paintSel();paintRes()}return}
  if(rm){sel.delete(rm.dataset.ngx);paintSel();paintRes();return}
  if(e.target.closest("#ng-go")){const nm=$o("#ng-n").value.trim(),er=$o("#ng-err");
   if(!nm){er.textContent="Give the group a name.";return}if(!sel.size){er.textContent="Add at least one person.";return}
   const b=$o("#ng-go");b.disabled=true;er.textContent="";
   try{const g=await EMAuth.rest("rpc/group_create","POST",{p_name:nm,p_members:[...sel.keys()]});closeOv();await loadGroups();buildG();paintList();openGroup(typeof g==="string"?g:(g&&g[0])||"")}
   catch(err){b.disabled=false;er.textContent=setup(err)||/function|schema cache/i.test(err.message)?"Run supabase-setup-14.sql in Supabase first.":err.message}}});
 if(innerWidth>820)$o("#ng-n").focus()}
/* ---------- events ---------- */
$("#dm-list").addEventListener("click",async e=>{
 if(e.target.closest("[data-newg]")){openNewG();return}
 const na=e.target.closest("[data-nacc]");
 if(na){const id=na.closest("[data-nid]").dataset.nid;na.disabled=true;
  try{const g=await EMAuth.rest("rpc/mm_accept","POST",{p_nid:id});NOTIF=NOTIF.filter(n=>n.id!==id);await loadGroups();buildG();paintList();openGroup(typeof g==="string"?g:(g&&g[0])||"")}
  catch(err){na.disabled=false;alert(setup(err)||/function|schema cache/i.test(err.message)?NEED13:"Couldn't accept: "+err.message)}return}
 const ra=e.target.closest("[data-racc]"),rd=e.target.closest("[data-rdec]");
 if(ra||rd){const row=EMSocial.incoming().find(r=>r.id===(ra||rd).closest("[data-rid]").dataset.rid);if(!row)return;
  try{if(ra)await EMSocial.accept(row);else await EMSocial.remove(row);await EMSocial.load();paintList();paintHead()}catch(err){alert("Couldn't do that: "+err.message)}return}
 const nm=e.target.closest("[data-nmsg]");if(nm){open(nm.dataset.nmsg,nm.dataset.nn);return}
 const nd=e.target.closest("[data-ndel]");if(nd){const id=nd.closest("[data-nid]").dataset.nid;try{try{await EMAuth.rest("rpc/mm_decline","POST",{p_nid:id})}catch(e0){if(!/function|schema cache|does not exist/i.test(e0.message))throw e0;await EMAuth.rest("notifications?id=eq."+encodeURIComponent(id),"DELETE")}NOTIF=NOTIF.filter(n=>n.id!==id);paintList()}catch(err){alert("Couldn't decline: "+err.message)}return}
 const tb=e.target.closest("[data-tab]");if(tb){TAB=tb.dataset.tab;sv("dm_tab",TAB);paintList();return}
 const c=e.target.closest(".dm-c");if(c){if(c.dataset.grp)openGroup(c.dataset.grp);else open(c.dataset.id,c.dataset.n,c.dataset.ch)}});
$("#dm-r").addEventListener("click",async e=>{
 const t=e.target;
 if(t.closest("[data-rxo]")){e.stopPropagation();openRx(t.closest("[data-rxo]"));return}
 {const rc=t.closest("[data-rx]");if(rc&&rc.closest(".dm-m")){closePop();react(rc.closest(".dm-m").dataset.id,rc.dataset.rx);return}}
 if(cur&&cur.grp&&t.id!=="dm-back"){
  if(t.id==="gp-send")sendG();
  else if(t.closest("#gp-plus")){const m=$("#gp-menu"),sp=$("#gp-stp");if(sp)sp.hidden=true;m.hidden=!m.hidden}
  else if(t.closest("[data-gadd]")){const a=t.closest("[data-gadd]").dataset.gadd;$("#gp-menu").hidden=true;
   if(!GNEW){$("#gp-err").textContent=NEED17;return}
   if(a==="wl"||a==="inv")sendWishlist(a);else if(a==="stk")openStk();else if(a==="img")$("#gp-file").click();else openPicker()}
  else if(t.closest("[data-pack]")){stkPack=t.closest("[data-pack]").dataset.pack;paintStk()}
  else if(t.closest("[data-stkback]")){stkPack=null;paintStk()}
  else if(t.closest("[data-stk]")){const v=t.closest("[data-stk]").dataset.stk;$("#gp-stp").hidden=true;sendSticker(v)}
  else if(t.closest("[data-unpic]")){pendImg=null;paintPend()}
  else if(t.closest("[data-item]"))openCard(t.closest("[data-item]").dataset.item);
  else if(t.closest(".dm-pic:not(.ph)")){const im=t.closest(".dm-pic");openPic(im.src)}
  else if(t.closest("[data-gmo]")){e.stopPropagation();openGmo(t.closest("[data-gmo]"))}
  else if(t.closest("[data-gedsave]"))saveGEdit();
  else if(t.closest("[data-gedcancel]")){gediting=null;paintGroup(false)}
  else if(t.closest("[data-gclose]"))closeG();
  return}
 if(t.id==="dm-send")send();
 else if(t.id==="dm-back"){cur=null;root.classList.remove("chat");$("#dm-r").dataset.id="";paintChat();paintList()}
 else if(t.closest("#dm-plus")){const m=$("#dm-menu"),sp=$("#dm-stp");if(sp)sp.hidden=true;m.hidden=!m.hidden}
 else if(t.closest("[data-add]")&&t.closest("[data-add]").dataset.add==="stk"){$("#dm-menu").hidden=true;openStk()}
  else if(t.closest("[data-pack]")){stkPack=t.closest("[data-pack]").dataset.pack;paintStk()}
  else if(t.closest("[data-stkback]")){stkPack=null;paintStk()}
  else if(t.closest("[data-stk]")){const v=t.closest("[data-stk]").dataset.stk;$("#dm-stp").hidden=true;sendSticker(v)}
  else if(t.closest("[data-add]")){const a=t.closest("[data-add]").dataset.add;$("#dm-menu").hidden=true;
  if(!NEW8){$("#dm-err").textContent=NEED8;return}
  if(a==="wl"||a==="inv"){sendWishlist(a);return}
  if(a==="mm"){if(!NEW9){$("#dm-err").textContent=NEED9;return}openMM();return}
  if(a==="img")$("#dm-file").click();else openPicker()}
 else if(t.closest("[data-unpic]")){pendImg=null;paintPend()}
 else if(t.closest("[data-item]"))openCard(t.closest("[data-item]").dataset.item);
 else if(t.closest(".dm-pic:not(.ph)")){const im=t.closest(".dm-pic");openPic(im.src)}
 else if(t.closest("[data-fr]")){const a=t.closest("[data-fr]").dataset.fr;
  try{if(a==="req")await EMSocial.request(cur.id);else{const r=EMSocial.rel(cur.id);if(r.row)await EMSocial.accept(r.row)}await EMSocial.load();paintHead();paintList()}
  catch(err){$("#dm-err").textContent="Couldn't do that: "+err.message}}
 else if(t.closest("[data-mo]")){e.stopPropagation();openMo(t.closest("[data-mo]"))}
 else if(t.closest("[data-mm]")){const id=t.closest(".dm-m").dataset.id;t.closest("[data-mm]").disabled=true;
  try{await EMAuth.rest("rpc/dm_confirm_mm","POST",{p_id:id});lastSig="";await tick(false)}
  catch(err){$("#dm-err").textContent=setup(err)?NEED9:"Couldn't confirm: "+err.message;paintChat(false)}}
 else if(t.closest("[data-go]")){const gid=t.closest("[data-go]").dataset.go;await loadGroups();buildG();if(!GL.some(g=>g.id===gid)){alert("This group chat was closed.");return}openGroup(gid)}
 else if(t.closest("[data-edsave]"))saveEdit();
 else if(t.closest("[data-edcancel]")){editing=null;paintChat(false)}
});
$("#dm-r").addEventListener("input",e=>{if(e.target.id==="dm-ed"&&editing)editing.text=e.target.value;if(e.target.id==="gp-ed"&&gediting)gediting.text=e.target.value});
$("#dm-r").addEventListener("change",async e=>{if(e.target.id!=="dm-file"&&e.target.id!=="gp-file")return;const f=e.target.files[0];e.target.value="";if(!f)return;
 try{pendImg=await shrinkImg(f);errEl().textContent="";paintPend()}catch(err){errEl().textContent=err.message}});
document.addEventListener("click",e=>{if(document.contains(e.target)&&!e.target.closest(".dm-pw")){["#dm-menu","#gp-menu","#dm-stp","#gp-stp"].forEach(q=>{const m=$(q);if(m&&!m.hidden)m.hidden=true})}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(pop)closePop();else if(editing){editing=null;paintChat(false)}else if(gediting){gediting=null;paintGroup(false)}else if(ov)closeOv();else{["#dm-menu","#gp-menu","#dm-stp","#gp-stp"].forEach(q=>{const m=$(q);if(m)m.hidden=true})}}});
$("#dm-r").addEventListener("keydown",e=>{if(e.target.id==="gp-ed"){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveGEdit()}return}if(e.target.id==="gp-in"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendG();return}if(e.target.id==="dm-ed"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveEdit();return}if(e.target.id==="dm-ed")return;if(e.target.id==="dm-in"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
let tm;$("#dm-q").addEventListener("input",e=>{q=e.target.value;clearTimeout(tm);paintList();const s=q.trim();if(s.length<2){people=[];return}
 tm=setTimeout(async()=>{try{const r=await EMAuth.rest("profiles?select=id,username,role,avatar&username=ilike."+encodeURIComponent("*"+s.replace(/[*%,()]/g,"")+"*")+"&limit=12");
  people=r.filter(p=>p.id!==UID);people.forEach(p=>prof[p.id]=p);paintList()}catch(err){}},250)});
{const lh=$(".dm-lh");if(lh){lh.insertAdjacentHTML("beforeend",'<div class="dm-tabs" id="dm-tabs"></div>');$("#dm-tabs").addEventListener("click",e=>{const tb=e.target.closest("[data-tab]");if(tb){TAB=tb.dataset.tab;sv("dm_tab",TAB);paintList()}})}}
paintChat();
tick(true).then(async()=>{const P=new URLSearchParams(location.search),u=P.get("u"),ch=P.get("ch"),ad=P.get("ad");
 if(u&&u.toLowerCase()!==ME.toLowerCase()){try{const r=await EMAuth.rest("profiles?select=id,username,role,avatar&username=ilike."+encodeURIComponent(u.replace(/[*%,()]/g,"")));
  if(r&&r[0]){prof[r[0].id]=r[0];let pre="";
   if(ch==="trade"&&ad&&/^[0-9a-f-]{36}$/i.test(ad)){try{const a=await EMAuth.rest("ads?id=eq."+ad+"&select=id,username,offering,looking,note");
     if(a&&a[0]){const nm=L=>(L||[]).map(e=>e.n==="@r"?e.q+" Robux":e.n==="@m"?e.q+" Gems":e.n.startsWith("@g:")?e.n.slice(3)+" crosstrade":e.n+(e.q>1?" x"+e.q:"")).join(", ");
      if(a[0])adCtx={id:ad.toLowerCase(),uid:r[0].id,ad:a[0]};pre="Hi! About your trade ad. You offer: "+nm(a[0].offering)+". You want: "+nm(a[0].looking)+". "}}catch(e){}}
   open(r[0].id,r[0].username,ch,pre.slice(0,900))}}catch(e){}}});
setInterval(()=>{if(!document.hidden)tick(false)},4000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)tick(false)});
})();
