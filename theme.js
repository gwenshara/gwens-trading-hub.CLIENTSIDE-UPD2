/* Remembers light/dark mode on every page and in every tab. Loaded in <head> so there is no flash. */
(function(){
var K="em_theme",R=document.documentElement;
function get(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"?v:null}catch(e){return null}}
function put(v){try{localStorage.setItem(K,v)}catch(e){}}
var s=get();if(s)R.setAttribute("data-theme",s);
/* any change to the theme (the Catalog's own button, or ours) is saved */
new MutationObserver(function(){var t=R.getAttribute("data-theme");if(t==="light"||t==="dark"){if(t!==get())put(t)}}).observe(R,{attributes:true,attributeFilter:["data-theme"]});
/* another open tab changed it */
addEventListener("storage",function(e){if(e.key===K&&(e.newValue==="light"||e.newValue==="dark")&&R.getAttribute("data-theme")!==e.newValue)R.setAttribute("data-theme",e.newValue)});
function light(){var t=R.getAttribute("data-theme");return t?t==="light":matchMedia("(prefers-color-scheme:light)").matches}
document.addEventListener("DOMContentLoaded",function(){
 if(document.getElementById("theme"))return; /* the Catalog pages already have a button */
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
