const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const color=n=>{let h=0;for(const c of n.toLowerCase())h=(h*31+c.charCodeAt(0))%360;return"hsl("+h+",55%,45%)"};
const day=t=>new Date(t).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"});
const want=new URLSearchParams(location.search).get("u");
const msg=t=>{$("#pf").hidden=true;const m=$("#pf-msg");m.hidden=false;m.textContent=t};
/* crop an image file to the middle and shrink it, so it fits in the database */
function shrink(file,w,h){return new Promise((ok,no)=>{const r=new FileReader();r.onerror=()=>no(new Error("Couldn't read that file."));
 r.onload=()=>{const im=new Image();im.onerror=()=>no(new Error("That file isn't a picture I can open."));
  im.onload=()=>{const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d"),s=Math.max(w/im.width,h/im.height),dw=im.width*s,dh=im.height*s;
   x.drawImage(im,(w-dw)/2,(h-dh)/2,dw,dh);let u=c.toDataURL("image/webp",.85);if(u.indexOf("data:image/webp")!==0)u=c.toDataURL("image/jpeg",.85);ok(u)};im.src=r.result};r.readAsDataURL(file)})}
let P=null,mine=false;
function paint(){
 $("#pf-name").innerHTML=esc(P.nickname||P.username)+(P.role==="admin"?'<i class="mb-ad">ADMIN</i>':"");
 $("#pf-sub").textContent=(P.nickname?"@"+P.username+" · ":"")+(P.role==="admin"?"Moderator":"Member")+" · Joined "+day(P.created_at);
 $("#pf-av").innerHTML='<img src="'+(P.avatar?esc(P.avatar):emDefAv(P.username))+'" alt="">';$("#pf-av").style.background="#2a2a30";
 $("#pf-ban").style.background=P.banner?"url("+P.banner+") center/cover":"linear-gradient(120deg,"+color(P.username)+",#2a2a30)";
 const b=$("#pf-bio");b.textContent=P.bio||(mine?"Nothing here yet. Tell people about yourself.":"No bio yet.");b.className=P.bio?"":"mt";paintDc()}
const ADMIN=EMAuth.isAdmin&&EMAuth.isAdmin();
function paintDc(){const v=$("#pf-dv");
 if(P.discord){v.innerHTML='@'+esc(P.discord)+' <i class="pf-tag '+(P.discord_verified?'ok':'wait')+'">'+(P.discord_verified?'Verified':'Not verified yet')+'</i>'}
 else{v.textContent=mine?"No Discord added yet.":"No Discord added.";v.className="mt"}
 if(P.discord)v.className="";
 $("#pf-dx").hidden=!mine||!$("#pf-de").hidden;$("#pf-dx").textContent=P.discord?"Change Discord":"Add your Discord here";
 $("#pf-dok").hidden=!(ADMIN&&!mine&&P.discord&&!P.discord_verified);$("#pf-dno").hidden=!(ADMIN&&!mine&&P.discord&&P.discord_verified);
 $("#pf-dm").hidden=!(mine&&(!$("#pf-de").hidden||(P.discord&&!P.discord_verified)));$("#pf-dok").textContent="Confirm Discord";if(ADMIN&&mine&&P.discord&&!P.discord_verified){$("#pf-dok").hidden=false;$("#pf-dok").textContent="Confirm my Discord (admin)"}}
async function load(){
 if(!window.EMAuth||!EMAuth.configured)return msg("The accounts server isn't set up yet, see SETUP.md.");
 if(!EMAuth.user())return msg("Log in (top left) to see your profile.");
 const name=want||EMAuth.user();mine=name.toLowerCase()===EMAuth.user().toLowerCase();
 try{
  const all=await EMAuth.rest("profiles?select=username,created_at&order=created_at.asc&limit=1000");
  const idx=all.findIndex(r=>r.username.toLowerCase()===name.toLowerCase());if(idx<0)return msg("Member not found.");
  let r;try{r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(all[idx].username)+"&select=id,username,role,created_at,avatar,banner,bio,nickname,discord,discord_verified"))[0]}
  catch(e){try{r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(all[idx].username)+"&select=id,username,role,created_at,avatar,banner,bio"))[0];r.__nodc=1}catch(e2){r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(all[idx].username)+"&select=id,username,role,created_at"))[0];r.__old=1}}
  try{const x=(await EMAuth.rest("profiles?id=eq."+encodeURIComponent(r.id)+"&select=status,last_seen,roles"))[0];if(x)Object.assign(r,x)}catch(e){r.__nopres=1}
  try{const x=(await EMAuth.rest("profiles?id=eq."+encodeURIComponent(r.id)+"&select=roblox_id,roblox_name"))[0];if(x)Object.assign(r,x)}catch(e){r.__norb=1}
  P=r;$("#pf").hidden=false;$("#pf-msg").hidden=true;$("#pf-n").textContent="#"+(idx+1);
  try{$("#pf-ads").textContent=(await EMAuth.rest("ads?select=id&username=eq."+encodeURIComponent(P.username)+"&limit=1000")).length}catch(e){}
  paint();paintPres();paintMod();paintIpBox();paintRb();paintDel();paintReviews();
  if(window.EMSocial)EMSocial.mount($("#pf-soc"),P.id,P.username);
  if(mine){["#pf-bb","#pf-ab","#pf-bx","#pf-hint","#pf-nx"].forEach(s=>$(s).hidden=false);$("#pf-un").textContent=P.username;if(P.__nodc)$("#pf-hint").textContent="Nickname and Discord can't be saved yet: run supabase-setup-7.sql in Supabase first.";
   if(P.__old)$("#pf-hint").textContent="Pictures can't be saved yet: run supabase-setup-4.sql in Supabase first."}
 }catch(e){msg("Couldn't load the profile: "+e.message)}}
async function save(fields,st){const s=$("#pf-st");s.style.color="";s.textContent="Saving…";
 try{await EMAuth.rest("profiles?id=eq."+encodeURIComponent(EMAuth.uid()),"PATCH",fields,{Prefer:"return=minimal"});Object.assign(P,fields);if("avatar"in fields){try{localStorage.setItem("em_av_"+EMAuth.uid(),fields.avatar)}catch(e){}}paint();s.style.color="#3bb26b";s.textContent=st||"Saved!";setTimeout(()=>{s.textContent=""},3000);return true}
 catch(e){s.style.color="#ff6b6b";s.textContent="Couldn't save: "+e.message+" (did you run supabase-setup-4.sql and supabase-setup-7.sql?)";return false}}
async function pick(inp,key,w,h){const f=inp.files[0];inp.value="";if(!f)return;
 try{const u=await shrink(f,w,h);await save({[key]:u})}catch(e){const s=$("#pf-st");s.style.color="#ff6b6b";s.textContent=e.message}}
$("#pf-ab").onclick=()=>$("#pf-fa").click();$("#pf-bb").onclick=()=>$("#pf-fb").click();
$("#pf-fa").onchange=e=>pick(e.target,"avatar",256,256);$("#pf-fb").onchange=e=>pick(e.target,"banner",960,320);
$("#pf-bx").onclick=()=>{$("#pf-bt").value=P.bio||"";$("#pf-be").hidden=false;$("#pf-bx").hidden=true;$("#pf-bio").hidden=true};
$("#pf-bs").onclick=async()=>{if(await save({bio:$("#pf-bt").value.trim()})){$("#pf-be").hidden=true;$("#pf-bx").hidden=false;$("#pf-bio").hidden=false}};
/* nickname */
$("#pf-nx").onclick=()=>{$("#pf-nt").value=P.nickname||"";$("#pf-nb").hidden=false;$("#pf-nx").hidden=true;$("#pf-nt").focus()};
$("#pf-nc").onclick=()=>{$("#pf-nb").hidden=true;$("#pf-nx").hidden=false};
$("#pf-ns").onclick=async()=>{const v=$("#pf-nt").value.trim();if(await save({nickname:v||null},"Nickname saved!")){$("#pf-nb").hidden=true;$("#pf-nx").hidden=false}};
/* discord: saved through a server function, then an admin confirms it */
async function rpc(fn,args,ok){const s=$("#pf-st");s.style.color="";s.textContent="Saving…";
 try{await EMAuth.rest("rpc/"+fn,"POST",args);s.style.color="#3bb26b";s.textContent=ok;setTimeout(()=>{s.textContent=""},4000);return true}
 catch(e){s.style.color="#ff6b6b";s.textContent=/does not exist|schema cache/i.test(e.message)?"Run supabase-setup-7.sql in Supabase first.":e.message;return false}}
$("#pf-dx").onclick=()=>{$("#pf-dt").value=P.discord||"";$("#pf-de").hidden=false;$("#pf-dm").hidden=false;paintDc();$("#pf-dt").focus()};
$("#pf-dx2").onclick=()=>{$("#pf-de").hidden=true;paintDc()};
$("#pf-ds").onclick=async()=>{const v=$("#pf-dt").value.trim().replace(/^@/,"");
 if(await rpc("set_discord",{d:v},v?"Discord saved. Now ask @gwensharra to confirm it.":"Discord removed.")){P.discord=v||null;P.discord_verified=false;$("#pf-de").hidden=true;paintDc()}};
$("#pf-dok").onclick=async()=>{if(await rpc("verify_discord",{target:P.username,ok:true},"Discord confirmed.")){P.discord_verified=true;paintDc()}};
$("#pf-dno").onclick=async()=>{if(await rpc("verify_discord",{target:P.username,ok:false},"Confirmation removed.")){P.discord_verified=false;paintDc()}};
/* roblox: a one-time code typed into the Roblox game links the account. No Roblox password is ever used. */
const ROBLOX_GAME_URL="https://www.roblox.com/games/116396707306418/"; /* paste your game's link here, e.g. https://www.roblox.com/games/123456789/Your-Game */
let rbTimer=null,rbEnd=0;
function rbStop(){clearInterval(rbTimer);rbTimer=null}
function paintRb(){const v=$("#pf-rv");if(!v)return;
 const id=Number(P.roblox_id);
 if(id>0&&P.roblox_name){v.className="";v.innerHTML='<a href="https://www.roblox.com/users/'+id+'/profile" target="_blank" rel="noopener noreferrer">'+esc(P.roblox_name)+' \u2197</a> <i class="pf-tag ok">Verified</i>'}
 else{v.className="mt";v.textContent=P.__norb&&mine?"Roblox linking isn't ready yet: run supabase-setup-23.sql in Supabase first.":(mine?"No Roblox linked yet.":"No Roblox linked.")}
 const linked=id>0&&!!P.roblox_name,coding=!$("#pf-rc").hidden;
 $("#pf-rx").hidden=!mine||P.__norb||coding;$("#pf-rx").textContent=linked?"Link a different Roblox account":"Link my Roblox";
 $("#pf-ru").hidden=!(linked&&(mine||ADMIN));
 const g=$("#pf-rgame");if(ROBLOX_GAME_URL&&/^https:\/\/www\.roblox\.com\//.test(ROBLOX_GAME_URL)){g.href=ROBLOX_GAME_URL;g.style.display=coding?"inline-block":"none"}else g.style.display="none"}
async function rbPoll(){
 if(Date.now()>rbEnd){rbStop();$("#pf-rc").hidden=true;paintRb();$("#pf-st").style.color="#ff6b6b";$("#pf-st").textContent="The code expired. Press Link my Roblox for a new one.";return}
 try{const x=(await EMAuth.rest("profiles?id=eq."+encodeURIComponent(P.id)+"&select=roblox_id,roblox_name"))[0];
  if(x&&x.roblox_id){rbStop();Object.assign(P,x);$("#pf-rc").hidden=true;paintRb();const s=$("#pf-st");s.style.color="#3bb26b";s.textContent="Roblox linked!";setTimeout(()=>{s.textContent=""},5000)}}catch(e){}}
$("#pf-rx").onclick=async()=>{const s=$("#pf-st");s.style.color="";s.textContent="";
 try{const r=await EMAuth.rest("rpc/roblox_start","POST",{});
  $("#pf-rcode").textContent=r.code;
  $("#pf-rhelp").innerHTML="1. Open the link game on Roblox.<br>2. Type this code in the game and press Link.<br>3. Come back here. This page updates by itself. The code works for "+(r.minutes||10)+" minutes.";
  $("#pf-rwait").textContent="Waiting for the game\u2026";$("#pf-rc").hidden=false;rbEnd=Date.now()+(r.minutes||10)*60000;rbStop();rbTimer=setInterval(rbPoll,4000);paintRb()}
 catch(e){s.style.color="#ff6b6b";s.textContent=/does not exist|schema cache/i.test(e.message)?"Run supabase-setup-23.sql in Supabase first.":e.message}};
$("#pf-ru").onclick=async()=>{if(!confirm("Unlink this Roblox account?"))return;
 if(await rpc("roblox_unlink",mine?{}:{target:P.username},"Roblox unlinked.")){P.roblox_id=null;P.roblox_name=null;paintRb()}};
/* bans: admins and moderators can ban a member's account and (optionally) their IP address */
let BANS=null,_bnOpen=false,_bnList=false,_dlOpen=false;
const BTNR='padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer;background:#e5484d;border-color:#e5484d;color:#fff',BTNA='padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer';
const setupMsg=e=>/does not exist|schema cache|Could not find/i.test(e.message)?"Run supabase-setup-24.sql in Supabase first.":e.message;
function say(t,ok){const s=$("#pf-st");if(!s)return;s.style.color=ok?"#3bb26b":"#ff6b6b";s.textContent=t}
async function paintBan(){
 if(mine||!P||!EMAuth.canMod||!EMAuth.canMod())return;
 if(P.role==="admin"||((P.roles||[]).includes("moderator")&&!ADMIN))return;
 let w=$("#pf-bn");if(!w)return;
 if(BANS===null){try{BANS=await EMAuth.rest("rpc/list_bans","POST",{})}catch(e){w.innerHTML='<h4>Ban</h4><p class="pf-hint" style="margin:0">'+esc(setupMsg(e))+'</p>';return}}
 const isB=BANS.some(b=>b.kind==="user"&&String(b.username).toLowerCase()===P.username.toLowerCase());
 let h='';
 if(isB)h+='<p style="margin:0 0 10px;color:#ff7b7b;font-weight:700">This member is banned.</p><button type="button" id="pf-unban" class="pri" style="'+BTNA+'">Unban this member</button>';
 else h+='<textarea id="pf-bnr" maxlength="200" rows="3" placeholder="Your message to them (they read it when they try to log in)" style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid var(--bl,#3a3a42);background:var(--b3,#1c1c20);color:inherit;font:inherit;resize:vertical"></textarea>'
  +'<div style="display:grid;gap:14px;margin-top:12px">'
  +'<div><button type="button" id="pf-bngo" class="pri" style="'+BTNR+'">Ban account</button><p class="pf-hint" style="margin:6px 0 0">Blocks only this account. Their IP address is not touched.</p></div>'
  +'<div><button type="button" id="pf-bnip" class="pri" style="'+BTNR+';background:#a31d22;border-color:#a31d22">IP ban (account + IP address)</button><p class="pf-hint" style="margin:6px 0 0"><b>This is the IP ban.</b> It bans the account and blocks their IP address too, so it also blocks everyone else on the same network (family, school, a mobile carrier). Use it only for people who keep coming back. If they have no IP on record yet, only the account is banned.</p></div></div>';
 h+='<div style="margin-top:14px"><button type="button" id="pf-bll" class="pf-link" style="margin:0">'+(_bnList?"Hide the banned list":"Show the banned list ("+BANS.length+")")+'</button></div>';
 if(_bnList)h+='<div style="margin-top:8px">'+(BANS.length?BANS.map(b=>'<div style="display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid var(--bl,#3a3a42);font-size:13px"><span style="flex:1;min-width:0;overflow-wrap:anywhere"><b>'+(b.kind==="user"?esc(b.username):'<span style="background:#e5484d;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px">IP BAN</span> '+esc(b.ip))+'</b>'+(b.kind==="ip"&&b.username?' <i style="opacity:.6">(from '+esc(b.username)+')</i>':"")+'<br><span style="opacity:.65">'+(b.reason?esc(b.reason)+" \u00b7 ":"")+'by '+esc(b.banned_by)+' \u00b7 '+esc(new Date(b.created_at).toLocaleDateString())+'</span></span><button type="button" data-ub="'+esc(b.kind)+'" data-k="'+esc(b.key)+'" class="pri" style="'+BTNA+';padding:6px 12px">Unban</button></div>').join(""):'<p class="pf-hint" style="margin:0">Nobody is banned.</p>')+'</div>';
 let hd="";if(ADMIN)hd+='<div><button type="button" id="pf-dlu" class="pri" style="'+BTNR+'">'+(_dlOpen?"Hide":"Delete this account permanently")+'</button>'
  +'<div style="display:'+(_dlOpen?"block":"none")+';margin-top:10px"><p class="pf-hint" style="margin:0 0 8px">This removes '+esc(P.username)+' and everything of theirs for good. It can\'t be undone. Type their username to confirm.</p><input id="pf-dlt" placeholder="'+esc(P.username)+'" style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid var(--bl,#3a3a42);background:var(--b3,#1c1c20);color:inherit"><div class="pf-row" style="margin-top:10px"><button type="button" id="pf-dlgo" class="pri" style="'+BTNR+'">Delete forever</button></div></div></div>';
 w.innerHTML=h;const dd=$("#pf-bdel");if(dd)dd.innerHTML=hd;
 const re=()=>{BANS=null;paintBan()};
 const q=s=>$("#pf-md").querySelector(s);
 if(q("#pf-bll"))q("#pf-bll").onclick=()=>{_bnList=!_bnList;paintBan()};
 if(q("#pf-dlu"))q("#pf-dlu").onclick=()=>{_dlOpen=!_dlOpen;paintBan()};
 const doBan=async wantIp=>{const why=q("#pf-bnr").value.trim();
  if(!confirm((wantIp?"IP BAN: ban ":"Ban ")+P.username+(wantIp?" and their IP address? This can also block other people on the same network.":"?")))return;say("Saving…",true);
  try{const r=await EMAuth.rest("rpc/ban_user","POST",{target:P.username,reason:why,ban_ip:wantIp});_bnOpen=false;
   say("Banned."+(r&&r.ip_banned?" Their IP is banned too.":(wantIp?" No IP on record for them yet, so only the account is banned.":"")),true);re()}
  catch(e){say(setupMsg(e))}};
 if(q("#pf-bngo"))q("#pf-bngo").onclick=()=>doBan(false);if(q("#pf-bnip"))q("#pf-bnip").onclick=()=>doBan(true);
 if(q("#pf-unban"))q("#pf-unban").onclick=async()=>{if(!confirm("Unban "+P.username+" (and their IP)?"))return;
  try{await EMAuth.rest("rpc/unban_member","POST",{target:P.username});say("Unbanned.",true);re()}catch(e){say(setupMsg(e))}};
 w.querySelectorAll("[data-ub]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this ban?"))return;
  try{await EMAuth.rest("rpc/unban_entry","POST",{p_kind:b.dataset.ub,p_key:b.dataset.k});say("Ban removed.",true);re()}catch(e){say(setupMsg(e))}});
 if(q("#pf-dlgo"))q("#pf-dlgo").onclick=async()=>{if(q("#pf-dlt").value.trim().toLowerCase()!==P.username.toLowerCase()){say("Type their username exactly to confirm.");return}
  if(!confirm("Delete "+P.username+" permanently? This cannot be undone."))return;say("Deleting…",true);
  try{await EMAuth.rest("rpc/admin_delete_user","POST",{target:P.username});location.href="members.html"}catch(e){say(setupMsg(e))}}}
/* delete my own account */
function paintDel(){
 const box=$("#pf-dl");if(!box)return;
 if(!mine||!P||P.role==="admin"){box.hidden=true;return}
 box.hidden=false;const b=$("#pf-dlb");
 b.innerHTML='<p class="pf-hint" style="margin:0 0 10px">Deleting your account removes your profile, trade ads, votes, comments, friends and chats for good. Private messages disappear for the other person too. This cannot be undone.</p>'
  +'<button type="button" id="pf-dm0" class="pri" style="'+BTNR+'">'+(_dlOpen?"Cancel":"Delete my account")+'</button>'
  +'<div style="display:'+(_dlOpen?"block":"none")+';margin-top:12px"><p class="pf-hint" style="margin:0 0 8px">Type your username <b>'+esc(P.username)+'</b> to confirm.</p><input id="pf-dm1" autocomplete="off" style="width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid var(--bl,#3a3a42);background:var(--b3,#1c1c20);color:inherit"><div class="pf-row" style="margin-top:10px"><button type="button" id="pf-dm2" class="pri" style="'+BTNR+'">Delete forever</button></div></div>';
 $("#pf-dm0").onclick=()=>{_dlOpen=!_dlOpen;paintDel()};
 $("#pf-dm2").onclick=async()=>{if($("#pf-dm1").value.trim().toLowerCase()!==P.username.toLowerCase()){say("Type your username exactly to confirm.");return}
  if(!confirm("Last chance: delete your account permanently?"))return;say("Deleting…",true);
  try{await EMAuth.rest("rpc/delete_my_account","POST",{});try{localStorage.removeItem("em_session")}catch(e){}alert("Your account was deleted.");location.href="index.html"}
  catch(e){say(setupMsg(e))}}}
msg("Loading…");load();

/* online status + roles */
const PR=window.EMPresence;
function paintPres(){
 if(!PR)return;
 const w=document.querySelector(".pf-avw");if(w){w.style.position="relative";let d=$("#pf-dot");if(!d){d=document.createElement("span");d.id="pf-dot";w.appendChild(d)}
  const s=PR.eff(P);d.style.cssText="position:absolute;left:6px;bottom:6px;width:18px;height:18px;border-radius:50%;border:4px solid #1c1c1f;box-sizing:content-box;background:"+PR.STATUS[s].c;d.title=PR.STATUS[s].n}
 let box=$("#pf-pres");if(!box){box=document.createElement("div");box.id="pf-pres";$("#pf-sub").insertAdjacentElement("afterend",box)}
 let h='<div class="em-roles">'+PR.tags(P)+'</div>';
 if(mine){h+='<div class="em-stm"><button type="button" class="em-stb" id="pf-stb">'+PR.dot({status:P.status,last_seen:new Date().toISOString()})+' '+PR.STATUS[P.status||"online"].n+' \u25BE</button><div class="em-stp" id="pf-stp" hidden>'+["online","idle","dnd"].map(k=>'<button type="button" data-s="'+k+'"><i class="em-dot" style="background:'+PR.STATUS[k].c+'"></i>'+PR.STATUS[k].n+'</button>').join("")+'</div></div>'}
 else h+='<div style="margin-top:6px;font:700 13px Montserrat,sans-serif;color:var(--mute)">'+PR.dot(P)+' '+PR.STATUS[PR.eff(P)].n+'</div>';
 box.innerHTML=h;
 const b=$("#pf-stb");if(b)b.onclick=e=>{e.stopPropagation();$("#pf-stp").hidden=!$("#pf-stp").hidden};
 box.querySelectorAll("#pf-stp [data-s]").forEach(x=>x.onclick=async()=>{const k=x.dataset.s;$("#pf-stp").hidden=true;await PR.beat(k);P.status=k;P.last_seen=new Date().toISOString();paintPres()});
 paintRoleMgr();
}
let _rmOpen=false;
function paintRoleMgr(){
 if(!PR||!ADMIN)return;
 let w=$("#pf-rm");if(!w){w=document.createElement("div");w.id="pf-rm";w.className="pf-box";const a=$("#pf-hint")||$("#pf-st");(a||$("#pf")).insertAdjacentElement("afterend",w)}
 w.innerHTML='<button type="button" id="pf-rmb" class="pri" style="padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer">'+(_rmOpen?"Hide roles":"Manage roles")+'</button>'
  +'<div class="em-rle" id="pf-rle"'+' style="margin-top:12px;display:'+(_rmOpen?"flex":"none")+';flex-wrap:wrap;gap:10px">'+Object.keys(PR.ROLES).map(k=>'<label><input type="checkbox" data-r="'+k+'"'+((P.roles||[]).includes(k)?" checked":"")+'><i class="em-role" style="--rc:'+PR.ROLES[k].c+'">'+PR.ROLES[k].n+'</i></label>').join("")+'</div>';
 $("#pf-rmb").onclick=()=>{_rmOpen=!_rmOpen;paintRoleMgr()};
 w.querySelectorAll("#pf-rle input").forEach(c=>c.onchange=async()=>{const r=[...w.querySelectorAll("#pf-rle input:checked")].map(i=>i.dataset.r);
  if(await rpc("set_roles",{target:P.username,r:r},"Roles updated.")){P.roles=r}paintPres()})}

/* IP address of a member: only admins and moderators get this (the server checks it too) */
let IPD=null,IPFOR="";
async function paintIpBox(){
 if(mine||!P||!EMAuth.canMod||!EMAuth.canMod())return;
 let w=$("#pf-ipb");if(!w){w=document.createElement("div");w.id="pf-ipb";w.className="pf-box";w.style.borderColor="#e5484d";$("#pf-bio").closest(".pf-box").insertAdjacentElement("afterend",w)}
 if(IPFOR!==P.username){IPD=null;IPFOR=P.username}
 const H='<h4>IP address <span style="font-weight:600;font-size:11px;opacity:.7">(staff only)</span></h4>';
 if(IPD===null){w.innerHTML=H+'<p class="pf-hint" style="margin:0">Loading\u2026</p>';
  try{IPD=await EMAuth.rest("rpc/get_member_ip","POST",{target:P.username})}
  catch(e){w.innerHTML=H+'<p class="pf-hint" style="margin:0">'+esc(/does not exist|schema cache|Could not find/i.test(e.message)?"Run supabase-setup-33.sql in Supabase first.":e.message)+'</p>';return}}
 const d=IPD,row=(k,v)=>'<div style="display:flex;gap:10px;padding:7px 0;border-top:1px solid var(--bl,#3a3a42);font-size:13px"><span style="width:130px;flex:none;opacity:.65">'+k+'</span><span style="flex:1;min-width:0;overflow-wrap:anywhere;font-weight:700">'+v+'</span></div>';
 const same=(d.same_ip_accounts||[]).map(n=>'<a href="profile.html?u='+encodeURIComponent(n)+'" style="color:inherit">'+esc(n)+'</a>').join(", ");
 w.innerHTML=H+row("Last seen IP",d.ip?esc(d.ip)+(d.ip_banned?' <span style="background:#e5484d;color:#fff;border-radius:6px;padding:1px 6px;font-size:11px">IP BAN</span>':""):'<i style="opacity:.6">not recorded yet (they must open the site once while logged in)</i>')
  +row("Last seen",d.seen_at?esc(new Date(d.seen_at).toLocaleString()):"-")
  +row("Made from IP",d.signup_ip?esc(d.signup_ip):"-")
  +row("Same IP accounts",same||'<i style="opacity:.6">none</i>')}
/* moderation: admins and moderators can reset parts of someone else's profile and send a warning */
let _mdOpen=false,_mdTab="warn";
function paintMod(){
 if(mine||!P||!EMAuth.canMod||!EMAuth.canMod())return;
 if(P.role==="admin"||((P.roles||[]).includes("moderator")&&!ADMIN))return;
 let w=$("#pf-md");if(!w){w=document.createElement("div");w.id="pf-md";w.className="pf-box";w.style.borderColor="#e5484d";$("#pf-bio").closest(".pf-box").insertAdjacentElement("afterend",w)}
 const opts=[["avatar","Profile picture"],["banner","Banner"],["nickname","Nickname"],["bio","About me"],["username","Username (they must pick a new one)"]];
 const tabs=[["warn","Warn / reset"],["ban","Ban"]].concat(ADMIN?[["del","Delete account"]]:[]);
 if(!tabs.some(t=>t[0]===_mdTab))_mdTab="warn";
 const TB='padding:7px 14px;border-radius:10px;font-weight:700;cursor:pointer',inp='width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid var(--bl,#3a3a42);background:var(--b3,#1c1c20);color:inherit;font:inherit';
 w.innerHTML='<h4>Moderation</h4><button type="button" id="pf-mdb" class="pri" style="padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer;background:#e5484d;border-color:#e5484d;color:#fff">'+(_mdOpen?"Close moderation":"Open moderation")+'</button>'
  +'<div id="pf-mdf" style="display:'+(_mdOpen?"block":"none")+';margin-top:14px">'
  +'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">'+tabs.map(t=>'<button type="button" class="pri" data-mt="'+t[0]+'" style="'+TB+(t[0]===_mdTab?';background:#e5484d;border-color:#e5484d;color:#fff':'')+'">'+t[1]+'</button>').join("")+'</div>'
  +'<div id="pf-mw" style="display:'+(_mdTab==="warn"?"block":"none")+'"><p class="pf-hint" style="margin:0 0 8px">Tick what to reset. Nickname: only the nickname is cleared. Username: they get a temporary name and must choose a new one.</p>'
  +'<div style="display:flex;flex-wrap:wrap;gap:12px 18px">'+opts.map(o=>'<label style="display:flex;gap:6px;align-items:center;font-weight:700;font-size:13px;cursor:pointer"><input type="checkbox" data-w="'+o[0]+'">'+o[1]+'</label>').join("")+'</div>'
  +'<label style="display:block;font-weight:700;font-size:13px;margin:14px 0 6px">Your message to them (optional)</label><textarea id="pf-mdm" maxlength="500" rows="3" placeholder="Write what you want them to read. If you leave it empty, the standard warning is sent." style="'+inp+';resize:vertical"></textarea>'
  +'<label style="display:flex;gap:6px;align-items:center;font-weight:700;font-size:13px;margin-top:10px;cursor:pointer"><input type="checkbox" id="pf-mdw" checked>Send them a warning</label>'
  +'<div class="pf-row" style="margin-top:12px"><button type="button" id="pf-mdgo" class="pri" style="padding:8px 16px;border-radius:10px;font-weight:700;cursor:pointer">Send / reset now</button></div></div>'
  +'<div id="pf-bn" style="display:'+(_mdTab==="ban"?"block":"none")+'"></div>'
  +'<div id="pf-bdel" style="display:'+(_mdTab==="del"?"block":"none")+'"></div></div>';
 $("#pf-mdb").onclick=()=>{_mdOpen=!_mdOpen;paintMod()};
 w.querySelectorAll("[data-mt]").forEach(b=>b.onclick=()=>{_mdTab=b.dataset.mt;paintMod()});
 const go=$("#pf-mdgo");if(go)go.onclick=async()=>{
  const what=[...w.querySelectorAll("[data-w]:checked")].map(i=>i.dataset.w),msgT=$("#pf-mdm").value.trim(),warn=$("#pf-mdw").checked||!!msgT;
  if(!what.length&&!warn)return;
  if(!confirm((what.length?"Reset "+what.join(", ")+" for ":"Send a warning to ")+P.username+(what.length&&warn?" and send a warning?":"?")))return;
  const st=$("#pf-st");st.style.color="";st.textContent="Saving…";let nu=null;
  try{nu=await EMAuth.rest("rpc/mod_reset","POST",{target:P.username,what:what,warn:warn,p_message:msgT});st.style.color="#3bb26b";st.textContent="Done."+(warn?" Warning sent.":"")}
  catch(e){st.style.color="#ff6b6b";st.textContent=/does not exist|schema cache|Could not find/i.test(e.message)?"Run supabase-setup-26.sql in Supabase first.":e.message}
  if(nu!==null){
   if(typeof nu==="string"&&nu){location.href="profile.html?u="+encodeURIComponent(nu);return}
   if(what.includes("avatar"))P.avatar=null;if(what.includes("banner"))P.banner=null;if(what.includes("nickname"))P.nickname=null;if(what.includes("bio"))P.bio=null;
   paint();paintMod()}};
 paintBan()}
document.addEventListener("click",()=>{const m=$("#pf-stp");if(m)m.hidden=true});

/* star reviews other members left on this person's trade ads */
async function paintReviews(){const b=$("#pf-revb");if(!b)return;
 try{const L=await EMAuth.rest("ad_reviews?ad_owner=eq."+encodeURIComponent(P.id)+"&select=reviewer_name,stars,comment,created_at&order=created_at.desc&limit=100");
  if(!L.length){b.innerHTML='<p class="mt">No reviews yet.</p>';return}
  const st=n=>'<span class="stars">'+"\u2605".repeat(n)+"<i>"+"\u2605".repeat(5-n)+"</i></span>",avg=L.reduce((t,r)=>t+r.stars,0)/L.length;
  b.innerHTML='<div style="margin-bottom:8px">'+st(Math.round(avg))+' <b>'+avg.toFixed(1)+'</b> <span class="mt">\u00b7 '+L.length+' review'+(L.length>1?'s':'')+'</span></div>'+
   L.map(r=>'<div class="rv"><div class="rv-t"><b>'+esc(r.reviewer_name)+'</b>'+st(r.stars)+'</div>'+(r.comment?'<p>'+esc(r.comment)+'</p>':'')+'</div>').join("")}
 catch(e){b.innerHTML='<p class="mt">'+(/does not exist|schema cache|Could not find/i.test(e.message)?(mine?"Reviews aren't ready yet: run supabase-setup-30.sql in Supabase first.":"No reviews yet."):"Couldn't load reviews.")+'</p>'}}
