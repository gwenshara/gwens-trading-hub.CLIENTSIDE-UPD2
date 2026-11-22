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
 $("#pf-name").innerHTML=esc(P.username)+(P.role==="admin"?'<i class="mb-ad">ADMIN</i>':"");
 $("#pf-sub").textContent=(P.role==="admin"?"Moderator":"Member")+" · Joined "+day(P.created_at);
 $("#pf-av").innerHTML=P.avatar?'<img src="'+esc(P.avatar)+'" alt="">':esc(P.username.charAt(0));$("#pf-av").style.background=P.avatar?"#2a2a30":color(P.username);
 $("#pf-ban").style.background=P.banner?"url("+P.banner+") center/cover":"linear-gradient(120deg,"+color(P.username)+",#2a2a30)";
 const b=$("#pf-bio");b.textContent=P.bio||(mine?"Nothing here yet. Tell people about yourself.":"No bio yet.");b.className=P.bio?"":"mt"}
async function load(){
 if(!window.EMAuth||!EMAuth.configured)return msg("The accounts server isn't set up yet, see SETUP.md.");
 if(!EMAuth.user())return msg("Log in (top left) to see your profile.");
 const name=want||EMAuth.user();mine=name.toLowerCase()===EMAuth.user().toLowerCase();
 try{
  const all=await EMAuth.rest("profiles?select=username,created_at&order=created_at.asc&limit=1000");
  const idx=all.findIndex(r=>r.username.toLowerCase()===name.toLowerCase());if(idx<0)return msg("Member not found.");
  let r;try{r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(all[idx].username)+"&select=username,role,created_at,avatar,banner,bio"))[0]}
  catch(e){r=(await EMAuth.rest("profiles?username=eq."+encodeURIComponent(all[idx].username)+"&select=username,role,created_at"))[0];r.__old=1}
  P=r;$("#pf").hidden=false;$("#pf-msg").hidden=true;$("#pf-n").textContent="#"+(idx+1);
  try{$("#pf-ads").textContent=(await EMAuth.rest("ads?select=id&username=eq."+encodeURIComponent(P.username)+"&limit=1000")).length}catch(e){}
  paint();
  if(mine){["#pf-bb","#pf-ab","#pf-bx","#pf-hint"].forEach(s=>$(s).hidden=false);
   if(P.__old)$("#pf-hint").textContent="Pictures can't be saved yet: run supabase-setup-4.sql in Supabase first."}
 }catch(e){msg("Couldn't load the profile: "+e.message)}}
async function save(fields,st){const s=$("#pf-st");s.style.color="";s.textContent="Saving…";
 try{await EMAuth.rest("profiles?id=eq."+encodeURIComponent(EMAuth.uid()),"PATCH",fields,{Prefer:"return=minimal"});Object.assign(P,fields);paint();s.style.color="#3bb26b";s.textContent=st||"Saved!";setTimeout(()=>{s.textContent=""},3000);return true}
 catch(e){s.style.color="#ff6b6b";s.textContent="Couldn't save: "+e.message+" (did you run supabase-setup-4.sql?)";return false}}
async function pick(inp,key,w,h){const f=inp.files[0];inp.value="";if(!f)return;
 try{const u=await shrink(f,w,h);await save({[key]:u})}catch(e){const s=$("#pf-st");s.style.color="#ff6b6b";s.textContent=e.message}}
$("#pf-ab").onclick=()=>$("#pf-fa").click();$("#pf-bb").onclick=()=>$("#pf-fb").click();
$("#pf-fa").onchange=e=>pick(e.target,"avatar",256,256);$("#pf-fb").onchange=e=>pick(e.target,"banner",960,320);
$("#pf-bx").onclick=()=>{$("#pf-bt").value=P.bio||"";$("#pf-be").hidden=false;$("#pf-bx").hidden=true;$("#pf-bio").hidden=true};
$("#pf-bs").onclick=async()=>{if(await save({bio:$("#pf-bt").value.trim()})){$("#pf-be").hidden=true;$("#pf-bx").hidden=false;$("#pf-bio").hidden=false}};
msg("Loading…");load();
