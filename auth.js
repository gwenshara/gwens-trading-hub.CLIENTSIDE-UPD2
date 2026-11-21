/* EM Wiki accounts, stored on a real server (Supabase) so they work on every device and every visit.
   Passwords are handled and hashed by Supabase Auth; this file never sees a stored password.
   Set your project URL and public key in supabase-config.js (see SETUP.md). */
(function(){
const CFG=window.EM_SUPABASE||{};
const ready=!!(CFG.url&&CFG.anonKey&&!/YOUR/i.test(CFG.url+CFG.anonKey));
const ld=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const DOMAIN="@gwenvaluehub.com"; /* usernames are turned into a private login e-mail; nobody receives mail there */
let S=ld("em_session",null);
if(S&&!S.token){S=null;try{localStorage.removeItem("em_session")}catch(e){}} /* old browser-only sessions are not valid any more */
const hdr=(tok)=>{const h={apikey:CFG.anonKey,"Content-Type":"application/json"};
 /* new-style sb_publishable_ keys are not JWTs: send them only as apikey; a signed-in person's token goes in Authorization */
 if(tok)h.Authorization="Bearer "+tok;else if(!/^sb_/.test(CFG.anonKey))h.Authorization="Bearer "+CFG.anonKey;return h};
async function call(path,opt){
 if(!ready)throw new Error(!window.EM_SUPABASE?"supabase-config.js did not load. Upload it next to index.html in GitHub, then hard refresh (Ctrl+Shift+R).":"supabase-config.js still has the placeholder text. Put your real Project URL and anon key in it.");
 let r;try{r=await fetch(CFG.url+path,opt)}catch(e){throw new Error("Can't reach the server. Check your connection.")}
 let j=null;try{j=await r.json()}catch(e){}
 if(!r.ok){const e=new Error((j&&(j.msg||j.error_description||j.message||j.error))||("Server error "+r.status));e.status=r.status;e.body=j;throw e}
 return j}
function save(s){S=s;if(s)sv("em_session",s);else try{localStorage.removeItem("em_session")}catch(e){}}
async function loadProfile(uid,tok){
 const p=await call("/rest/v1/profiles?id=eq."+uid+"&select=username,role",{headers:hdr(tok)});
 if(!p||!p[0])throw new Error("Account profile not found.");return p[0]}
function fromAuth(j){return{token:j.access_token,refresh:j.refresh_token,exp:Math.floor(Date.now()/1000)+(j.expires_in||3600),uid:j.user&&j.user.id}}
const API=window.EMAuth={
 configured:ready,
 user:()=>S&&S.u||null,isAdmin:()=>!!(S&&S.role==="admin"),uid:()=>S&&S.uid||null,
 /* a valid access token, refreshed when it is about to expire; null when signed out */
 async token(){
  if(!S)return null;
  if(S.exp-60>Date.now()/1000)return S.token;
  try{const j=await call("/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:hdr(),body:JSON.stringify({refresh_token:S.refresh})});
   save(Object.assign({},S,fromAuth(j)));return S.token}
  catch(e){if(e.status&&e.status<500){save(null);location.reload()}throw e}},
 /* call the database as the signed-in person */
 async rest(path,method,body,extra){
  const tok=await API.token();if(!tok)throw new Error("Log in first.");
  return call("/rest/v1/"+path,{method:method||"GET",headers:Object.assign(hdr(tok),extra||{}),body:body==null?undefined:JSON.stringify(body)})},
 async signIn(u,pw){
  u=u.trim();if(!u||!pw)throw new Error("Enter your username and password.");
  let j;try{j=await call("/auth/v1/token?grant_type=password",{method:"POST",headers:hdr(),body:JSON.stringify({email:u.toLowerCase()+DOMAIN,password:pw})})}
  catch(e){if(e.status===400||e.status===401)throw new Error("Wrong username or password.");throw e}
  const a=fromAuth(j),p=await loadProfile(a.uid,a.token);save(Object.assign({u:p.username,role:p.role},a))},
 async signUp(u,pw){
  u=u.trim();
  if(!/^[A-Za-z0-9_]{3,20}$/.test(u))throw new Error("Username: 3–20 letters, numbers or _.");
  if(pw.length<6)throw new Error("Password must be at least 6 characters.");
  let j;try{j=await call("/auth/v1/signup",{method:"POST",headers:hdr(),body:JSON.stringify({email:u.toLowerCase()+DOMAIN,password:pw,data:{username:u}})})}
  catch(e){if(/already|registered|exists/i.test(e.message)||e.status===422&&/already/i.test(e.message))throw new Error("That username is taken.");
   if(/Database error/i.test(e.message))throw new Error("That username is taken or not allowed.");throw e}
  if(!j.access_token)throw new Error("Sign-up worked but e-mail confirmation is still ON in Supabase. Turn it off (see SETUP.md).");
  const a=fromAuth(j),p=await loadProfile(a.uid,a.token);save(Object.assign({u:p.username,role:p.role},a))},
 /* My List is stored per account; guests use the plain key. First sign-in copies the guest list so nothing is lost. */
 listKey(k){const u=API.user();if(!u)return k;const ak=k+":"+u.toLowerCase();
  try{if(localStorage.getItem(ak)===null&&localStorage.getItem(k)!==null)localStorage.setItem(ak,localStorage.getItem(k))}catch(e){}return ak},
 signOut(){const t=S&&S.token;save(null);if(t&&ready)fetch(CFG.url+"/auth/v1/logout",{method:"POST",headers:hdr(t)}).catch(()=>{})}
};
/* keep the role fresh (e.g. when you are made admin) without blocking the page */
if(S&&ready)(async()=>{try{const tok=await API.token();if(!tok)return;const p=await loadProfile(S.uid,tok);
 if(p.username!==S.u||p.role!==S.role){save(Object.assign({},S,{u:p.username,role:p.role}));location.reload()}}catch(e){}})();

/* Shared site data (catalog edits + added items). Everyone reads it, only the admin writes it. */
const D=window.EMData={
 _ver:ld("em_ver",{}),_subs:[],_last:null,
 enabled:()=>ready,
 /* fn(key,valueString) is called for every changed key; return false to postpone (e.g. unsaved local edits) */
 onChange(fn){D._subs.push(fn);setTimeout(D.sync,0)},
 async sync(){
  if(!ready||!D._subs.length)return; /* nothing listening yet: wait, so no update is marked as received and lost */
  try{
   const meta=await call("/rest/v1/site_state?select=key,updated_at",{headers:hdr()});
   const need=meta.filter(m=>D._ver[m.key]!==m.updated_at);
   if(!need.length){await D.seed(meta);return}
   const rows=await call("/rest/v1/site_state?select=key,value,updated_at&key=in.("+need.map(m=>m.key).join(",")+")",{headers:hdr()});
   rows.sort((x,y)=>x.key==="custom"?-1:y.key==="custom"?1:0); /* added items first, then the edits on top */
   for(const r of rows){let ok=true;for(const f of D._subs){try{if(f(r.key,r.value)===false)ok=false}catch(e){}}
    if(ok)D._ver[r.key]=r.updated_at}
   sv("em_ver",D._ver);await D.seed(meta)
  }catch(e){}},
 async put(key,str){
  const tok=await API.token();if(!tok||!API.isAdmin())throw new Error("Only the admin can save for everyone.");
  const now=new Date().toISOString();
  await call("/rest/v1/site_state?on_conflict=key",{method:"POST",headers:Object.assign(hdr(tok),{Prefer:"resolution=merge-duplicates,return=minimal"}),body:JSON.stringify({key,value:str,updated_at:now,updated_by:API.user()})});
  D._ver[key]=now;sv("em_ver",D._ver)},
 /* first time the admin opens the live site: upload what is already saved in this browser so nothing is lost */
 async seed(meta){
  if(!API.isAdmin()||ld("em_seeded",false))return;
  try{const has=new Set(meta.map(m=>m.key)),g=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
   const ov=g("ovr_saved"),cu=g("em_custom");
   if(!has.has("overrides")&&ov&&ov!=="{}")await D.put("overrides",ov);
   if(!has.has("custom")&&cu&&cu!=="[]")await D.put("custom",cu);
   const lg=ld("em_log",[]);
   if(lg.length){const ex=await call("/rest/v1/site_log?select=id&limit=1",{headers:hdr()});
    if(!ex.length)await API.rest("site_log","POST",lg.slice().reverse().map(e=>({username:API.user(),item:e.item||"",text:e.text,created_at:new Date(e.t).toISOString()})),{Prefer:"return=minimal"})}
   sv("em_seeded",true)}catch(e){}}
};
if(ready){D.sync();setInterval(()=>{if(!document.hidden)D.sync()},20000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)D.sync()})}

/* Update log. With the server on, entries are written by the admin and everyone can read them. */
const cap=u=>(u||"Admin").charAt(0).toUpperCase()+(u||"Admin").slice(1);
let logQ=Promise.resolve();
window.EMLog={
 key:"em_log",
 all(){try{return JSON.parse(localStorage.getItem("em_log")||"[]")}catch(e){return[]}},
 add(item,text){
  const u=(window.EMAuth&&EMAuth.user())||"Admin";
  const L=EMLog.all();L.unshift({t:Date.now(),u:cap(u),item:item||"",text});
  try{localStorage.setItem("em_log",JSON.stringify(L.slice(0,1000)))}catch(e){}
  if(ready&&API.isAdmin())logQ=logQ.then(()=>API.rest("site_log","POST",{username:API.user(),item:item||"",text},{Prefer:"return=minimal"})).catch(()=>{})},
 async load(){
  if(!ready)return EMLog.all();
  const r=await call("/rest/v1/site_log?select=created_at,username,item,text&order=created_at.desc,id.desc&limit=1000",{headers:hdr()});
  return r.map(e=>({t:Date.parse(e.created_at),u:cap(e.username),item:e.item,text:e.text}))},
 async clear(){
  try{localStorage.removeItem("em_log")}catch(e){}
  if(ready&&API.isAdmin())await API.rest("site_log?id=gt.0","DELETE")}
};
function build(){
 const host=document.querySelector(".emnav");if(!host)return;
 const box=document.createElement("div");box.className="em-auth";host.appendChild(box);
 const modal=document.createElement("div");modal.className="em-mo";modal.hidden=true;document.body.appendChild(modal);
 const paint=()=>{const u=API.user();
  box.innerHTML='<div class="em-row">'+(u?`<button id="em-me">👤 ${u.replace(/[<>&"]/g,"")}${API.isAdmin()?' <i class="em-ad">ADMIN</i>':""} ▾</button><div class="em-menu" hidden><button id="em-out">Log out</button></div>`:'<button id="em-in">👤 Log in</button>')+'</div>'};
 let mode="in";
 const form=()=>{modal.innerHTML=`<div class="em-box" role="dialog" aria-modal="true"><div class="em-tabs"><button data-m="in" class="${mode==="in"?"on":""}">Sign in</button><button data-m="up" class="${mode==="up"?"on":""}">Sign up</button></div>
  <input id="em-u" placeholder="Username" autocomplete="username" maxlength="20"><input id="em-p" type="password" placeholder="Password" autocomplete="${mode==="in"?"current-password":"new-password"}">
  <div id="em-e" class="em-err"></div><button id="em-go" class="em-pri">${mode==="in"?"Sign in":"Create account"}</button><button id="em-x" class="em-x" aria-label="Close">✕</button></div>`;
  modal.querySelector("#em-u").focus()};
 const go=async()=>{const u=modal.querySelector("#em-u").value,p=modal.querySelector("#em-p").value,e=modal.querySelector("#em-e"),b=modal.querySelector("#em-go");
  e.textContent="";b.disabled=true;try{await(mode==="in"?API.signIn(u,p):API.signUp(u,p));location.reload()}catch(x){e.textContent=x.message;b.disabled=false}};
 box.addEventListener("click",e=>{
  if(e.target.closest("#em-in")){mode="in";modal.hidden=false;form()}
  else if(e.target.closest("#em-me")){const m=box.querySelector(".em-menu");m.hidden=!m.hidden}
  else if(e.target.closest("#em-out")){API.signOut();location.reload()}});
 modal.addEventListener("click",e=>{const t=e.target;
  if(t===modal||t.closest("#em-x"))modal.hidden=true;
  else if(t.dataset.m){mode=t.dataset.m;form()}
  else if(t.id==="em-go")go()});
 modal.addEventListener("keydown",e=>{if(e.key==="Enter")go();if(e.key==="Escape")modal.hidden=true});
 document.addEventListener("click",e=>{const m=box.querySelector(".em-menu");if(m&&!e.target.closest(".em-auth"))m.hidden=true});
 paint()}
document.addEventListener("DOMContentLoaded",build);
})();
