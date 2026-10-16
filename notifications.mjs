// Displays private cross-account changes already recorded by reportChange().
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const milliseconds=e=>e.createdAt?.toMillis?.()||0;
const kinds={day:'Horaris o missatges',payment:'Pagament',vacation:'Vacances',schedule:'Instruccions'};

export function mountNotifications({f,db,user,role,notice}){
 const button=$('notification-toggle'),panel=$('notification-panel'),list=$('notification-list'),count=$('notification-count'),close=$('notification-close');
 const receipt=f.doc(db,'notificationViews',user.uid);
 let events=[],seenMs=null,feedReady=false,receiptReady=false,previousIds=null,active=true,feedError=false,receiptError=false;
 button.hidden=false;button.setAttribute('aria-expanded','false');panel.hidden=true;
 const render=()=>{
  if(!active)return;
  const since=seenMs??Date.now()-7*86400000;
  const unread=feedReady&&receiptReady?events.filter(e=>milliseconds(e)>since).length:0;
  count.hidden=!unread;count.textContent=unread>99?'99+':String(unread);
  button.setAttribute('aria-label',unread?'Notificacions: '+unread+' sense llegir':'Notificacions');
  if(feedError||receiptError){list.textContent='Per activar els avisos, cal publicar les regles de Firestore actualitzades.';return;}
  if(!feedReady||!receiptReady){list.innerHTML='<p class="muted">Carregant avisos…</p>';return;}
  list.innerHTML=events.length?events.map(e=>{
   const timestamp=milliseconds(e);
   const when=timestamp?new Date(timestamp).toLocaleString('ca-ES',{dateStyle:'short',timeStyle:'short'}):'Recent';
   const name=e.actorRole==='owner'?'Roger':'Ana';
   return '<article class="notification-row '+(timestamp>since?'unread':'')+'"><div class="notification-meta"><strong>'+escapeHtml(name+' · '+(kinds[e.kind]||'Canvi'))+'</strong><time>'+escapeHtml(when)+'</time></div><p>'+escapeHtml(e.summary)+'</p><small class="muted">Dia: '+escapeHtml(e.date)+'</small></article>';
  }).join(''):'<p class="muted">Encara no hi ha notificacions.</p>';
 };
 const onToggle=async()=>{
  panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));
  if(panel.hidden||!events.length||!feedReady)return;
  try{await f.setDoc(receipt,{lastSeenAt:f.serverTimestamp()});}
  catch(e){console.error('No es poden marcar els avisos com a llegits',e);notice('No s’han pogut marcar els avisos com a llegits.');}
 };
 const onClose=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
 button.addEventListener('click',onToggle);close.addEventListener('click',onClose);
 const otherRole=role==='owner'?'anna':'owner';
 // This query needs only Firestore's built-in actorRole field index.
 const query=f.query(f.collection(db,'notifications'),f.where('actorRole','==',otherRole));
 const stopFeed=f.onSnapshot(query,snapshot=>{
  const incoming=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>milliseconds(b)-milliseconds(a));
  if(previousIds){
   const fresh=incoming.filter(e=>!previousIds.has(e.id)&&milliseconds(e)>Date.now()-90000);
   if(fresh.length&&panel.hidden)notice(fresh.length===1?'🔔 Tens una notificació nova.':'🔔 Tens '+fresh.length+' notificacions noves.');
  }
  previousIds=new Set(incoming.map(e=>e.id));
  events=incoming.slice(0,40);feedReady=true;render();
 },e=>{console.error('No es poden carregar les notificacions',e);feedError=true;render();});
 const stopReceipt=f.onSnapshot(receipt,snapshot=>{
  seenMs=snapshot.exists()?snapshot.data().lastSeenAt?.toMillis?.()??null:null;
  receiptReady=true;render();
 },e=>{console.error('No es pot consultar l’estat de lectura',e);receiptError=true;render();});
 render();
 return ()=>{
  active=false;stopFeed();stopReceipt();
  button.removeEventListener('click',onToggle);close.removeEventListener('click',onClose);
  button.hidden=true;count.hidden=true;panel.hidden=true;list.textContent='';
 };
}
