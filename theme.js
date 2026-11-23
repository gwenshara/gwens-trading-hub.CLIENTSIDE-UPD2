/* Dark mode is the default; light mode is the extra option. The choice is remembered on every page and in every tab. */
(function(){
if(window.__emTheme)return;window.__emTheme=1;
var K="em_theme",R=document.documentElement;
function ok(v){return v==="light"||v==="dark"}
function get(){var v=null;try{v=localStorage.getItem(K)}catch(e){}
 if(!ok(v)){var m=document.cookie.match(/(?:^|; )em_theme=(light|dark)/);v=m?m[1]:null}
 return ok(v)?v:null}
function put(v){try{localStorage.setItem(K,v)}catch(e){}
 try{document.cookie=K+"="+v+"; path=/; max-age=31536000; SameSite=Lax"}catch(e){}}
R.setAttribute("data-theme",get()||"dark"); /* nothing saved yet = dark */
new MutationObserver(function(){var t=R.getAttribute("data-theme");if(ok(t)&&t!==get())put(t)}).observe(R,{attributes:true,attributeFilter:["data-theme"]});
addEventListener("storage",function(e){if(e.key===K&&ok(e.newValue)&&R.getAttribute("data-theme")!==e.newValue)R.setAttribute("data-theme",e.newValue)});
function light(){return R.getAttribute("data-theme")==="light"}
function ready(f){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",f);else f()}
ready(function(){
 if(document.getElementById("theme")||document.querySelector(".em-theme"))return; /* the Catalog pages already have a button */
 var st=document.createElement("style");
 st.textContent=".em-theme{position:fixed;top:12px;right:12px;z-index:900;width:42px;height:42px;padding:0;border-radius:50%;border:1px solid var(--line,#3a3a42);background:var(--panel,#26262a);color:var(--text,#f1f1f4);cursor:pointer;display:grid;place-items:center}.em-theme:hover{border-color:var(--accent,#7aa7ff)}.em-theme svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}";
 document.head.appendChild(st);
 var b=document.createElement("button");b.type="button";b.className="em-theme";b.setAttribute("aria-label","Switch between light and dark mode");
 function paint(){b.title=light()?"Switch to dark mode":"Switch to light mode";
  b.innerHTML=light()?'<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'}
 b.onclick=function(){R.setAttribute("data-theme",light()?"dark":"light");paint()};
 new MutationObserver(paint).observe(R,{attributes:true,attributeFilter:["data-theme"]});
 paint();document.body.appendChild(b)});
})();
