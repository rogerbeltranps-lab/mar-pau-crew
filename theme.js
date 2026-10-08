(function(){
var KEY='crew-theme',MODES=['auto','light','dark'],mq=matchMedia('(prefers-color-scheme: dark)');
function read(){try{var v=localStorage.getItem(KEY);return MODES.indexOf(v)<0?'auto':v;}catch(e){return 'auto';}}
function apply(){
 var mode=read(),dark=mode==='dark'||(mode==='auto'&&mq.matches),root=document.documentElement;
 root.dataset.theme=dark?'dark':'light';root.dataset.themeMode=mode;
 var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=dark?'#14241f':'#275c52';
 var btn=document.getElementById('theme-toggle');
 if(btn){var label={auto:'Automàtic',light:'Clar',dark:'Fosc'}[mode];btn.textContent={auto:'🌓',light:'☀️',dark:'🌙'}[mode];btn.title=btn.ariaLabel='Tema: '+label;}
}
window.cycleTheme=function(){var next=MODES[(MODES.indexOf(read())+1)%MODES.length];try{localStorage.setItem(KEY,next);}catch(e){}apply();};
window.applyTheme=apply;
(mq.addEventListener?mq.addEventListener('change',apply):mq.addListener(apply));
apply();
})();
