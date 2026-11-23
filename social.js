/* Friends + Follow. Needs supabase-setup-8.sql. Used by Profile, Members and Discussions. */
(function(){
const A=window.EMAuth;if(!A)return;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const miss=e=>/does not exist|schema cache|Could not find/i.test((e&&e.message)||"");
const S=window.EMSocial={rows:[],fol:new Set(),missing:false,loaded:false,
 async load(){if(!A.user())return;
  try{S.rows=await A.rest("friendships?select=id,requester_id,addressee_id,status,created_at&or=(requester_id.eq."+A.uid()+",addressee_id.eq."+A.uid()+")&limit=1000");
   const f=await A.rest("follows?select=followee_id&follower_id=eq."+A.uid()+"&limit=2000");S.fol=new Set(f.map(x=>x.followee_id));S.missing=false}
  catch(e){if(miss(e))S.missing=true}S.loaded=true},
 rel(id){const r=S.rows.find(x=>x.requester_id===id||x.addressee_id===id);
  if(!r)return{kind:"none"};if(r.status==="accepted")return{kind:"friend",row:r};
  return{kind:r.requester_id===A.uid()?"out":"in",row:r}},
 friends(){return S.rows.filter(r=>r.status==="accepted").map(r=>r.requester_id===A.uid()?r.addressee_id:r.requester_id)},
 incoming(){return S.rows.filter(r=>r.status==="pending"&&r.addressee_id===A.uid())},
 async counts(id){try{return await A.rest("rpc/social_counts","POST",{target:id})}catch(e){return null}},
 async request(id){await A.rest("friendships","POST",{requester_id:A.uid(),addressee_id:id,status:"pending"},{Prefer:"return=minimal"})},
 async accept(row){const r=await A.rest("friendships?id=eq."+encodeURIComponent(row.id),"PATCH",{status:"accepted"},{Prefer:"return=representation"});if(!r||!r.length)throw new Error("the server refused it.")},
 async remove(row){await A.rest("friendships?id=eq."+encodeURIComponent(row.id),"DELETE",null,{Prefer:"return=minimal"})},
 async follow(id){await A.rest("follows","POST",{follower_id:A.uid(),followee_id:id},{Prefer:"return=minimal"})},
 async unfollow(id){await A.rest("follows?follower_id=eq."+A.uid()+"&followee_id=eq."+encodeURIComponent(id),"DELETE",null,{Prefer:"return=minimal"})},
 /* draws counts + buttons for one member into el. onChange() runs after every action. */
 async mount(el,id,name,onChange){
  if(!A.user()||!id){el.innerHTML="";return}
  const me=id===A.uid();
  if(!S.loaded)await S.load();
  if(S.missing){el.innerHTML='<p class="sc-note">Friends and Follow need <code>supabase-setup-8.sql</code> to be run once in Supabase.</p>';return}
  const c=await S.counts(id)||{friends:0,followers:0,following:0},r=S.rel(id),fl=S.fol.has(id);
  let b="";
  if(!me){
   if(r.kind==="none")b+='<button class="sc-b pri" data-a="req" type="button">Add friend</button>';
   else if(r.kind==="out")b+='<button class="sc-b" data-a="cancel" type="button">Request sent (cancel)</button>';
   else if(r.kind==="in")b+='<button class="sc-b pri" data-a="acc" type="button">Accept request</button><button class="sc-b" data-a="dec" type="button">Decline</button>';
   else b+='<span class="sc-tag">Friends</span><button class="sc-b" data-a="unf" type="button">Unfriend</button>';
   b+='<button class="sc-b" data-a="fol" type="button">'+(fl?"Following":"Follow")+'</button>';
   b+='<a class="sc-b" href="forum-discussions.html?u='+encodeURIComponent(name)+'">Message</a>'}
  el.innerHTML='<div class="sc-stats"><div><b>'+c.friends+'</b><span>Friends</span></div><div><b>'+c.followers+'</b><span>Followers</span></div><div><b>'+c.following+'</b><span>Following</span></div></div>'+(b?'<div class="sc-btns">'+b+'</div>':"")+'<p class="sc-err" hidden></p>';
  el.onclick=async e=>{const t=e.target.closest("[data-a]");if(!t)return;const a=t.dataset.a;t.disabled=true;
   try{if(a==="req")await S.request(id);else if(a==="cancel"||a==="dec")await S.remove(r.row);
    else if(a==="unf"){if(!confirm("Remove "+name+" from your friends?")){t.disabled=false;return}await S.remove(r.row)}
    else if(a==="acc")await S.accept(r.row);else if(a==="fol"){if(fl)await S.unfollow(id);else await S.follow(id)}
    await S.load();await S.mount(el,id,name,onChange);if(onChange)onChange()}
   catch(err){t.disabled=false;const p=el.querySelector(".sc-err");p.hidden=false;p.textContent="Couldn't do that: "+(/duplicate|23505/i.test(err.message)?"there is already a request between you two. Refresh the page.":err.message)}}}
};
})();
