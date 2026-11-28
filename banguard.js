(function(){
if(window.__emBan)return;window.__emBan=1;
var cfg=window.EM_SUPABASE,shown=false,timer=null;
if(!cfg||!cfg.url)return;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function show(j){
 if(shown)return;shown=true;clearInterval(timer);
 try{localStorage.removeItem("em_session")}catch(e){}
 var acc=j.kind==="account";
 var st=document.createElement("style");st.textContent="#em-ban{position:fixed;inset:0;z-index:2147483000;background:#0f0f12;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:Montserrat,Inter,system-ui,sans-serif}#em-ban div{max-width:460px}#em-ban h1{margin:0 0 12px;font-size:28px;font-weight:800}#em-ban p{margin:0 0 10px;line-height:1.5;opacity:.85;font-size:15px}#em-ban em{display:block;margin-top:14px;padding:10px 14px;border-radius:10px;background:#ffffff14;font-style:normal;font-size:14px}";
 document.head.appendChild(st);
 function mk(){var o=document.createElement("div");o.id="em-ban";
  o.innerHTML="<div><h1>"+(acc?"Your account is banned":"This network is banned")+"</h1><p>"+(acc?"You can't use this website anymore.":"Access to this website from this network or device has been blocked.")+"</p>"+(j.reason?"<em>Reason: "+esc(j.reason)+"</em>":"")+"<p style=\"margin-top:16px;font-size:13px;opacity:.6\">If you think this is a mistake, contact the site owner.</p></div>";
  document.body.appendChild(o);document.documentElement.style.overflow="hidden";return o}
 var o=mk();
 try{new MutationObserver(function(){if(!document.getElementById("em-ban"))o=mk()}).observe(document.body,{childList:true})}catch(e){}
}
async function check(){
 if(shown||document.hidden)return;
 try{
  var j;
  if(window.EMAuth&&EMAuth.user&&EMAuth.user()){j=await EMAuth.rest("rpc/session_check","POST",{})}
  else{var r=await fetch(cfg.url+"/rest/v1/rpc/session_check",{method:"POST",headers:{apikey:cfg.anonKey,"Content-Type":"application/json"},body:"{}"});if(!r.ok)return;j=await r.json()}
  if(j&&j.banned)show(j)
 }catch(e){}
}
function init(){setTimeout(check,600);timer=setInterval(check,120000);document.addEventListener("visibilitychange",function(){if(!document.hidden)check()})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
