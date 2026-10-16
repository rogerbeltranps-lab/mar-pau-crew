(function(){
var KEY='crew-theme',MODES=['auto','light','dark'],mq=matchMedia('(prefers-color-scheme: dark)');
function read(){try{var v=localStorage.getItem(KEY);return MODES.includes(v)?v:'auto';}catch(e){return 'auto';}}
function apply(){
 var mode=read(),dark=mode==='dark'||(mode==='auto'&&mq.matches),root=document.documentElement;
 root.dataset.theme=dark?'dark':'light';root.dataset.themeMode=mode;
 var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#1b3a33':'#275c52';
 var select=document.getElementById('theme-select');if(select)select.value=mode;
}
window.setTheme=function(mode){if(!MODES.includes(mode))return;try{localStorage.setItem(KEY,mode);}catch(e){}apply();};
window.applyTheme=apply;
(mq.addEventListener?mq.addEventListener('change',apply):mq.addListener(apply));
document.addEventListener('DOMContentLoaded',apply,{once:true});
apply();
})();
