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
 $("#pf-av").innerHTML=P.avatar?'<img src="'+esc(P.avatar)+'" alt="">':esc(P.username.charAt(0));$("#pf-av").style.background=P.avatar?"#2a2a30":color(P.username);
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
  P=r;$("#pf").hidden=false;$("#pf-msg").hidden=true;$("#pf-n").textContent="#"+(idx+1);
  try{$("#pf-ads").textContent=(await EMAuth.rest("ads?select=id&username=eq."+encodeURIComponent(P.username)+"&limit=1000")).length}catch(e){}
  paint();paintPres();
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
 if(ADMIN){h+='<div class="em-rle" id="pf-rle">'+Object.keys(PR.ROLES).map(k=>'<label><input type="checkbox" data-r="'+k+'"'+((P.roles||[]).includes(k)?" checked":"")+'><i class="em-role" style="--rc:'+PR.ROLES[k].c+'">'+PR.ROLES[k].n+'</i></label>').join("")+'</div>'}
 box.innerHTML=h;
 const b=$("#pf-stb");if(b)b.onclick=e=>{e.stopPropagation();$("#pf-stp").hidden=!$("#pf-stp").hidden};
 box.querySelectorAll("#pf-stp [data-s]").forEach(x=>x.onclick=async()=>{const k=x.dataset.s;$("#pf-stp").hidden=true;await PR.beat(k);P.status=k;P.last_seen=new Date().toISOString();paintPres()});
 box.querySelectorAll("#pf-rle input").forEach(c=>c.onchange=async()=>{const r=[...box.querySelectorAll("#pf-rle input:checked")].map(i=>i.dataset.r);
  if(await rpc("set_roles",{target:P.username,r:r},"Roles updated.")){P.roles=r;paintPres()}else paintPres()});
}
document.addEventListener("click",()=>{const m=$("#pf-stp");if(m)m.hidden=true});
