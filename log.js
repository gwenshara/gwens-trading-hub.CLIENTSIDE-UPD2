const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const q=$("#lg-q"),box=$("#lg"),clr=$("#lg-clr");
clr.hidden=!(window.EMAuth&&EMAuth.isAdmin());
let LOG=[],ERR="";
async function refresh(){try{LOG=await EMLog.load();ERR=""}catch(e){ERR=e.message}draw()}
function draw(){
 if(ERR&&!LOG.length){box.innerHTML='<div class="lg-empty">Couldn\'t load the log: '+esc(ERR)+'</div>';return}
 const f=q.value.trim().toLowerCase();
 const L=LOG.filter(e=>!f||(e.u+" "+e.item+" "+e.text).toLowerCase().includes(f));
 if(!L.length){box.innerHTML='<div class="lg-empty">'+(f?"No log entries match.":"No updates yet.")+'</div>';return}
 let day="",h="";
 for(const e of L){const d=new Date(e.t),ds=d.toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  if(ds!==day){day=ds;h+='<div class="lg-d">'+esc(ds)+'</div>'}
  h+='<div class="lg-e"><time>'+d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})+'</time><span><b>'+esc(e.u)+'</b> '+esc(e.text)+(e.item?' <span class="it">'+esc(e.item)+'</span>':"")+'</span></div>'}
 box.innerHTML=h}
q.addEventListener("input",draw);
clr.addEventListener("click",async()=>{if(confirm("Clear the whole log for everyone?")){try{await EMLog.clear();LOG=[];draw()}catch(e){alert("Couldn't clear: "+e.message)}}});
box.innerHTML='<div class="lg-empty">Loading…</div>';refresh();
setInterval(()=>{if(!document.hidden)refresh()},20000);
