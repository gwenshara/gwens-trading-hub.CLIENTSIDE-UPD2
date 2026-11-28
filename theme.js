(function(){
if(window.__emTheme)return;window.__emTheme=1;
var K="em_theme",R=document.documentElement;
function ok(v){return v==="light"||v==="dark"}
function get(){var v=null;try{v=localStorage.getItem(K)}catch(e){}
 if(!ok(v)){var m=document.cookie.match(/(?:^|; )em_theme=(light|dark)/);v=m?m[1]:null}
 return ok(v)?v:null}
function put(v){try{localStorage.setItem(K,v)}catch(e){}
 try{document.cookie=K+"="+v+"; path=/; max-age=31536000; SameSite=Lax"}catch(e){}}
R.setAttribute("data-theme",get()||"dark");
new MutationObserver(function(){var t=R.getAttribute("data-theme");if(ok(t)&&t!==get())put(t)}).observe(R,{attributes:true,attributeFilter:["data-theme"]});
addEventListener("storage",function(e){if(e.key===K&&ok(e.newValue)&&R.getAttribute("data-theme")!==e.newValue)R.setAttribute("data-theme",e.newValue)});
function light(){return R.getAttribute("data-theme")==="light"}
function ready(f){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",f);else f()}
ready(function(){
 if(document.getElementById("theme")||document.querySelector(".em-setb"))return;
 var base=".sec{border-top:1px solid var(--line,#3a3a42);padding:10px 0}.sec:first-of-type{border-top:0;padding-top:0}.stt{font:700 13px Montserrat,Nunito,system-ui,sans-serif;color:var(--mute,#a0a0ab);margin:0 0 6px}"+
 ".thr{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;background:var(--bg,#1b1b1d);color:var(--text,#f1f1f4);border:1px solid var(--line,#3a3a42);border-radius:10px;padding:9px 12px;font:600 14px Nunito,system-ui,sans-serif;cursor:pointer}.thr:hover{border-color:var(--accent,#7aa7ff)}"+
 ""+
 ".sn{font:500 13px/1.4 Nunito,system-ui,sans-serif;color:var(--text,#f1f1f4)}.sn small{display:block;color:var(--mute,#a0a0ab);margin-top:2px}.sn .sd{display:inline-block;width:9px;height:9px;border-radius:50%;background:#80848e;margin-right:6px}.sn .sd.on{background:#3bb26b}.sn .sd.bad{background:#e5484d}"+
 ".sn button{margin-top:8px;border:0;border-radius:10px;padding:8px 14px;background:#2e8bff;color:#fff;font:700 13px Montserrat,Nunito,system-ui,sans-serif;cursor:pointer}.sn button.alt{background:var(--bg,#1b1b1d);color:var(--text,#f1f1f4);border:1px solid var(--line,#3a3a42)}.sn .er{color:#e5484d;margin-top:6px}";
 var css=base.replace(/(^|\})([^{}@]+)\{/g,function(m,a,sel){return a+sel.split(",").map(function(x){return ".em-setp "+x.trim().replace(/^:root\[data-theme=\"light\"\] /,"")}).join(",")+"{"});
 css=css.replace(/\.em-setp :root\[data-theme="light"\] /g,":root[data-theme=\"light\"] .em-setp ");
 var st=document.createElement("style");
 st.textContent=css+".em-setb{position:fixed;top:12px;right:12px;z-index:900;height:42px;padding:0 14px;border-radius:21px;border:1px solid var(--line,#3a3a42);background:var(--panel,#26262a);color:var(--text,#f1f1f4);cursor:pointer;display:flex;align-items:center;gap:6px;font:700 13px Montserrat,Nunito,system-ui,sans-serif}.em-setb:hover{border-color:var(--accent,#7aa7ff)}"+
 ".em-setp{position:fixed;top:62px;right:12px;z-index:901;width:min(300px,calc(100vw - 24px));max-height:calc(100vh - 80px);overflow:auto;background:var(--panel,#26262a);color:var(--text,#f1f1f4);border:1px solid var(--line,#3a3a42);border-radius:14px;padding:14px 16px;box-shadow:0 10px 30px rgba(0,0,0,.35)}.em-setp[hidden]{display:none}";
 document.head.appendChild(st);
 var b=document.createElement("button");b.type="button";b.className="em-setb";b.setAttribute("aria-haspopup","true");b.setAttribute("aria-expanded","false");b.title="Settings";b.textContent="\u2699 Settings";
 var p=document.createElement("div");p.className="em-setp";p.hidden=true;
 p.innerHTML='<div class="sec"><div class="stt">Notifications</div><div class="sn em-setnotif">Loading\u2026</div></div><div class="sec"><div class="stt">Appearance</div><button type="button" class="thr" aria-label="Switch between light and dark mode"><span>Theme: <b class="thv"></b></span><span class="thi" aria-hidden="true"></span></button></div>';
 function open(o){p.hidden=!o;b.setAttribute("aria-expanded",o)}
 b.onclick=function(e){e.stopPropagation();open(p.hidden)};
 p.querySelector(".thr").onclick=function(){R.setAttribute("data-theme",light()?"dark":"light")};
 function sync(){var v=p.querySelector(".thv"),i=p.querySelector(".thi");if(v)v.textContent=light()?"Light":"Dark";if(i)i.textContent=light()?"\u2600\uFE0F":"\uD83C\uDF19"}
 sync();new MutationObserver(sync).observe(R,{attributes:true,attributeFilter:["data-theme"]});
 document.addEventListener("click",function(e){if(!e.target.closest(".em-setp,.em-setb"))open(false)});
 document.addEventListener("keydown",function(e){if(e.key==="Escape")open(false)});
 setTimeout(function(){var n=document.querySelector(".em-setnotif");if(n&&n.textContent==="Loading\u2026")n.textContent="Notifications could not load. Refresh the page with Ctrl+Shift+R."},4000);
 document.body.appendChild(b);document.body.appendChild(p)});
})();

(function(){try{if(!/^https?:$/.test(location.protocol))return;var p=location.pathname,n=p;
if(/\/index\.html$/.test(p))n=p.replace(/index\.html$/,"");else if(/\.html$/.test(p))n=p.replace(/\.html$/,"");
if(n!==p)history.replaceState(history.state,"",n+location.search+location.hash)}catch(e){}})();

(function(){try{if(window.top!==window.self){window.top.location=window.self.location.href}}catch(e){try{document.documentElement.style.display="none"}catch(_){}}})();
