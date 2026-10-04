import {firebaseConfig} from './firebase-config.js';
import {cents,localDate,defaultDay,totals,hours,fridayPeriod,allocatePayment,isAgendaDay,missingDefaultDays,untouchedDefault} from './domain.mjs?v=9';
import {readExcel} from './excel.js';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('ca-ES',{style:'currency',currency:'EUR'}).format(n), labels={morning:'Matí',afternoon:'Tarda'};
let db,auth,api,authApi,user,role,days=new Map(),month=new Date(),selected='',view='calendar',unsubscribe,infoUnsubscribe,defaultsSession,imported=[],saving=false;
const notice=s=>{$('toast').textContent=s;$('toast').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('toast').hidden=true,6500);};
const fail=e=>notice(e.code==='permission-denied'?'Aquest compte no té permís. Revisa els membres i les regles de Firebase.':e.code?.startsWith('auth/')?'No s’ha pogut entrar. Comprova el correu, la contrasenya i la configuració d’accés.':e.message||'No s’ha pogut desar. Torna-ho a provar.');
const online=()=>{if(!navigator.onLine)throw Error('Cal connexió per desar. Els canvis encara no s’han guardat.');};
async function busy(action){if(saving)return;saving=true;document.querySelectorAll('dialog button,#import-confirm,#weekly-pay-button').forEach(b=>b.disabled=true);try{online();await action();}catch(e){fail(e);}finally{saving=false;document.querySelectorAll('dialog button,#import-confirm,#weekly-pay-button').forEach(b=>b.disabled=false);}}
function render(){
 renderAnaAlerts();
 $('month-title').textContent=month.toLocaleDateString('ca-ES',{month:'long',year:'numeric'});const year=month.getFullYear(),m=month.getMonth(),count=new Date(year,m+1,0).getDate(),offset=(new Date(year,m,1).getDay()+6)%7;
 let html=['Dl','Dt','Dc','Dj','Dv','Ds','Dg'].map(s=>`<div class="weekday">${s}</div>`).join('')+'<div></div>'.repeat(offset);
 for(let i=1;i<=count;i++){const date=localDate(new Date(year,m,i)),day=days.get(date),t=day?.turns||[],done=!!day&&totals(day).hours>0,unavailable=t.some(t=>t.status==='unavailable'),cancelled=t.length&&t.every(t=>t.status==='not-needed'),paid=!!day&&totals(day).paid>0&&totals(day).pending<=0&&totals(day).earned>0,state=unavailable?'unavailable':done?'done':cancelled?'cancelled':t.length?'planned':'';html+=`<button class="date ${state} ${date===localDate()?'today':''}" data-date="${date}" aria-label="${date}${done?', horari comptabilitzat':''}${paid?', pagat':''}"><b>${i}${paid?' <span title="Pagat">💶</span>':''}</b><small>${unavailable?'× No pot':cancelled?'− No cal':done?'✓ Fet':t.length?'● Prevista':''}</small>${t.filter(t=>t.status==='planned'&&t.attendance!=='no').map(t=>`<small class="calendar-turn"><span>${t.id==='morning'?'☀️ Matí':'🌇 Tarda'}</span><span>${esc(t.start)}–<wbr>${esc(t.end)}</span></small>`).join('')}${t.some(t=>t.status==='planned'&&t.attendance!=='no')?`<small class="calendar-hours">${t.filter(t=>t.status==='planned'&&t.attendance!=='no').reduce((sum,t)=>sum+hours(t),0).toLocaleString('ca-ES',{maximumFractionDigits:2})} h</small>`:''}</button>`;}
 $('calendar').innerHTML=html;
 const list=[...days.values()].filter(d=>d.date.startsWith(`${year}-${String(m+1).padStart(2,'0')}`)).sort((a,b)=>a.date.localeCompare(b.date));const sums=list.reduce((s,d)=>{const t=totals(d);return {hours:s.hours+t.hours,earned:cents(s.earned+t.earned),paid:cents(s.paid+t.paid),pending:cents(s.pending+t.pending)};},{hours:0,earned:0,paid:0,pending:0});
 $('totals').innerHTML=[['Hores fetes',sums.hours.toLocaleString('ca-ES')],['Pagat',money(sums.paid)],['Saldo pendent',money(sums.pending)]].map(([k,v])=>`<div class="stat">${k}<strong>${v}</strong></div>`).join('');
 renderWeeklyPayments();
 $('payment-list').innerHTML=list.filter(d=>totals(d).earned||d.paid).map(d=>{const t=totals(d);return `<div class="row"><button data-date="${d.date}">${new Date(d.date+'T12:00:00').toLocaleDateString('ca-ES',{day:'numeric',month:'short'})}</button><div>${money(t.earned)}<small>${t.hours.toLocaleString('ca-ES')} h · pagat ${money(t.paid)} · pendent ${money(t.pending)}</small></div></div>`;}).join('')||'<p>Encara no hi ha horaris comptabilitzats ni pagaments aquest mes.</p>';
 const upcoming=[...days.values()].filter(d=>d.date>=localDate()&&d.turns.some(t=>t.status==='planned')).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,7);
 $('upcoming').innerHTML='<h3>Dies i horaris previstos</h3>'+ (upcoming.map(d=>`<div class="row"><button data-date="${d.date}">${new Date(d.date+'T12:00:00').toLocaleDateString('ca-ES',{weekday:'short',day:'numeric',month:'short'})}</button><span>${d.turns.filter(t=>t.status==='planned'&&t.attendance!=='no').map(t=>`${labels[t.id]}: ${esc(t.start)}–${esc(t.end)} · ${hours(t).toLocaleString('ca-ES',{maximumFractionDigits:2})} h`).join('<br>')}</span></div>`).join('')||'<p>Importeu l’Excel o afegiu dies al calendari.</p>');
}
async function populateDefaults(uid){
 const missing=missingDefaultDays(days.keys(),localDate(),'2027-06-22');
 for(let i=0;i<missing.length;i+=15){
  if(user?.uid!==uid||role!=='owner')return;
  const chunk=missing.slice(i,i+15);
  await api.runTransaction(db,async tx=>{
   const records=[];for(const d of chunk){const ref=api.doc(db,'days',d.date);records.push({d,ref,snap:await tx.get(ref)});}
   if(user?.uid!==uid)throw Error('La sessió ha canviat. Torna a entrar per completar l’horari.');
   for(const {d,ref,snap} of records)if(!snap.exists())tx.set(ref,{...d,updatedBy:uid,updatedAt:api.serverTimestamp()});
  });
 }
 if(missing.length&&user?.uid===uid)notice('Horari habitual incorporat. Els dies que ja havies editat es conserven.');
}
function anaWarning(day){
 const turns=(day?.turns||[]).filter(t=>t.status==='unavailable'||t.confirmation==='no');
 return turns.length?'⚠️ Ana no pot venir: '+turns.map(t=>labels[t.id]+' '+t.start+'–'+t.end).join(' · '):'';
}
function renderAnaAlerts(){
 const relevant=[...days.values()].filter(d=>d.date>=localDate()&&(anaWarning(d)||d.annaNotes?.trim())).sort((a,b)=>a.date.localeCompare(b.date));
 $('ana-alerts').hidden=role!=='owner'||!relevant.length;
 $('ana-alerts').innerHTML='<h3>Avisos de l’Ana</h3>'+relevant.map(d=>`<div class="row"><button data-date="${esc(d.date)}">${new Date(d.date+'T12:00:00').toLocaleDateString('ca-ES',{weekday:'short',day:'numeric',month:'short'})}</button><div>${esc(anaWarning(d))}${d.annaNotes?.trim()?`<p>${esc(d.annaNotes)}</p>`:''}</div></div>`).join('');
 if($('day-dialog').open&&days.has(selected)){
  const d=days.get(selected),warning=anaWarning(d);
  $('day-summary').textContent=warning||'Horari guardat. Pots ajustar l’entrada i la sortida; es recalcularà l’import.';
  if(role==='owner')$('anna-notes').value=d.annaNotes||'';
 }
}
function renderInformation(info){
 if(!info?.sections?.length){$('ana-information').innerHTML='<div class="card"><p>Importa l’Excel a Gestió per incorporar la pestanya Información. Si ja has importat els dies, pots repetir-ho: es conservaran els dies existents.</p></div>';return;}
 $('ana-information').innerHTML=info.sections.map(section=>`<section class="card"><h3>${esc(section.title)}</h3>${section.rows.map(({cells:row})=>`<div class="info-row">${row.map((cell,i)=>i===0&&row.length>1?`<strong>${esc(cell)}</strong>`:`<span>${esc(cell)}</span>`).join('')}</div>`).join('')}</section>`).join('');
}
function periodDays(){return [...days.values()].filter(d=>d.date>=$('week-from').value&&d.date<=$('week-to').value);}
function renderWeeklyPayments(){
 $('weekly-payment').hidden=role!=='owner';
 const pending=cents(periodDays().reduce((sum,d)=>sum+Math.max(0,totals(d).pending),0));
 $('week-summary').textContent=`Pendent del període: ${money(pending)}. Es compten els horaris guardats fins avui.`;
 $('week-amount').value=pending>0?pending:'';
 const groups=new Map();
 for(const d of days.values())for(const p of d.payments||[]){
  if(!p.date?.startsWith(localDate(month).slice(0,7)))continue;
  const key=p.id||`import-${p.date}`,g=groups.get(key)||{date:p.date,amount:0,note:p.note,from:p.from,to:p.to};
  g.amount=cents(g.amount+p.amount);groups.set(key,g);
 }
 $('weekly-history').innerHTML=[...groups.values()].sort((a,b)=>b.date.localeCompare(a.date)).map(p=>`<div class="row"><div>${esc(p.date)}<small>${esc(p.note||'Pagament')}${p.from?` · ${esc(p.from)} – ${esc(p.to)}`:''}</small></div><strong>${money(p.amount)}</strong></div>`).join('')||'<p>Encara no hi ha pagaments amb data aquest mes.</p>';
}
async function payWeek(){await busy(async()=>{
 if(role!=='owner')throw Error('Cal un compte de gestió.');
 const from=$('week-from').value,to=$('week-to').value,date=$('week-date').value,amount=cents($('week-amount').value);
 if(!from||!to||from>to||!date||amount<=0)throw Error('Revisa el període, la data i l’import.');
 const records=periodDays();if(records.length>100)throw Error('Tria un període de com a màxim 100 dies registrats.');
 const id=crypto.randomUUID();
 await api.runTransaction(db,async tx=>{
  const snapshots=[];for(const d of records)snapshots.push(await tx.get(api.doc(db,'days',d.date)));
  const current=snapshots.filter(s=>s.exists()).map(s=>s.data()),allocations=allocatePayment(current,amount);
  for(const part of allocations){const d=current.find(d=>d.date===part.date);
   const payment={id,amount:part.amount,date,from,to,note:'Pagament conjunt'};
   tx.update(api.doc(db,'days',part.date),{paid:cents(d.paid+part.amount),payments:[...(d.payments||[]),payment],updatedBy:user.uid,updatedAt:api.serverTimestamp()});
  }
 });notice('Pagament conjunt desat.');
});}
function openDay(date){selected=date;const day=days.get(date)||defaultDay(date),owner=role==='owner';$('day-title').textContent=new Date(date+'T12:00:00').toLocaleDateString('ca-ES',{weekday:'long',day:'numeric',month:'long'});$('day-summary').textContent=days.has(date)?'Horari guardat. Pots ajustar l’entrada i la sortida; es recalcularà l’import.':'Dia nou: horari habitual proposat.';
 const base=['morning','afternoon'].map(id=>day.turns.find(t=>t.id===id)||{id,start:'',end:'',status:'none',attendance:'pending',confirmation:'pending'});
 $('turns').innerHTML=base.map(t=>`<div class="turn" data-turn="${t.id}"><h3>${labels[t.id]}</h3><label>Previsió<select data-field="status"><option value="none">Sense torn</option><option value="planned">Ve a l’horari indicat</option><option value="not-needed">No cal venir</option><option value="unavailable">Ana no pot venir</option></select></label><div class="times"><label>Entrada<input type="time" data-field="start" value="${esc(t.start)}" ${owner?'':'disabled'}></label><label>Sortida<input type="time" data-field="end" value="${esc(t.end)}" ${owner?'':'disabled'}></label></div><label>Disponibilitat de l’Ana (opcional)<select data-field="confirmation"><option value="pending">Sense resposta (opcional)</option><option value="yes">Confirmat: vindrà</option><option value="no">No pot venir</option></select></label></div>`).join('');
 document.querySelectorAll('[data-turn]').forEach((el,i)=>{const t=base[i];for(const k of ['status','confirmation'])el.querySelector(`[data-field="${k}"]`).value=k==='status'&&t.attendance==='no'&&t.status==='planned'?'unavailable':t[k];el.querySelector('[data-field="confirmation"]').disabled=owner||t.status==='none'||t.status==='not-needed';if(!owner){el.querySelector('[data-field="status"]').disabled=true;el.querySelector('[data-field="confirmation"]').onchange=()=>saveDay(false);}});
 $('day-summary').textContent=anaWarning(day)||$('day-summary').textContent;
 $('rate').value=day.rate;$('rate').disabled=!owner;$('notes').value=day.notes||'';$('notes').readOnly=!owner;$('anna-notes').value=day.annaNotes||'';$('anna-notes').readOnly=owner;$('pay-section').hidden=!owner;$('pay-amount').value='';$('pay-date').value=localDate();const t=totals(day);$('pay-summary').textContent=`Generat ${money(t.earned)} · Pagat ${money(t.paid)} · Pendent ${money(t.pending)}`;$('pay-history').innerHTML=(day.payments||[]).map(p=>`<p class="muted">${esc(p.date||'Sense data')} · ${money(p.amount)} · ${esc(p.note||'')}</p>`).join('');if(!$('day-dialog').open)$('day-dialog').showModal();
}
async function saveDay(close=true){await busy(async()=>{const owner=role==='owner',turns=[];for(const el of document.querySelectorAll('[data-turn]')){const value=k=>el.querySelector(`[data-field="${k}"]`).value;const status=value('status');if(status==='none')continue;const t={id:el.dataset.turn,start:value('start'),end:value('end'),status,attendance:status==='planned'?'yes':'pending',confirmation:value('confirmation')};if(owner&&(!t.start||!t.end||hours(t)<=0))throw Error('Revisa l’entrada i la sortida dels torns.');turns.push(t);}const rate=Number($('rate').value);if(owner&&(!Number.isFinite(rate)||rate<0||rate>1000))throw Error('Revisa la tarifa.');
 await api.runTransaction(db,async tx=>{const ref=api.doc(db,'days',selected),snap=await tx.get(ref),current=snap.exists()?snap.data():defaultDay(selected);if(!owner&&!snap.exists())throw Error('Roger ha d’afegir aquest dia primer.');let next;if(owner){next={...current,automatic:false,turns:turns.map(t=>{const old=current.turns.find(x=>x.id===t.id);return {...t,confirmation:old?.confirmation||'pending'};}),rate,notes:$('notes').value};}else{next={...current,annaNotes:$('anna-notes').value,turns:current.turns.map(t=>{const entered=turns.find(x=>x.id===t.id);if(!entered||['not-needed','none'].includes(t.status))return t;return {...t,confirmation:entered.confirmation,status:entered.confirmation==='no'?'unavailable':t.status==='unavailable'?'planned':t.status};})};}tx.set(ref,{...next,updatedBy:user.uid,updatedAt:api.serverTimestamp()});});if(close)$('day-dialog').close();notice(role==='anna'?'Avís desat i compartit amb la família.':'Canvis desats i compartits.');});}
async function pay(){await busy(async()=>{const amount=cents($('pay-amount').value),date=$('pay-date').value;if(amount<=0||!date)throw Error('Indica un import positiu i una data.');const payment={amount,date,note:'Pagament registrat',id:crypto.randomUUID()};await api.runTransaction(db,async tx=>{const ref=api.doc(db,'days',selected),snap=await tx.get(ref);if(!snap.exists())throw Error('Desa primer el dia i els horaris abans de registrar el pagament.');const d=snap.data(),pending=totals(d).pending;if(amount>pending)throw Error(`L’import supera el pendent (${money(pending)}).`);tx.update(ref,{paid:cents(d.paid+amount),payments:[...(d.payments||[]),payment],updatedBy:user.uid,updatedAt:api.serverTimestamp()});});$('day-dialog').close();notice('Pagament registrat.');});}
async function start(config){
 try{const base='https://www.gstatic.com/firebasejs/12.19.0/';const [app,a,f]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);authApi=a;api=f;const instance=app.initializeApp(config);db=f.getFirestore(instance);auth=a.getAuth(instance);$('connect').hidden=true;
 a.onAuthStateChanged(auth,async u=>{unsubscribe?.();infoUnsubscribe?.();defaultsSession=null;$('ana-information').textContent='Carregant la informació…';days.clear();user=u;role=null;$('app').hidden=true;$('logout').hidden=!u;$('login').hidden=!!u;if(!u){$('status').textContent='Accés privat';return;}try{const member=await f.getDoc(f.doc(db,'members',u.uid));role=member.data()?.role;if(!['owner','anna'].includes(role)){const detail=member.exists()?`El document existeix, però role val ${JSON.stringify(role??null)}. Ha de ser el camp role de tipus string amb valor anna per a l’Ana.`:'No existeix el document de permisos amb aquest UID.';throw Error(`Accés pendent. ${detail} Correu: ${u.email}. UID: ${u.uid}. Projecte: ${config.projectId}.`);}$('app').hidden=false;$('owner-settings').hidden=role!=='owner';$('identity').hidden=role==='anna';$('access-title').textContent=role==='anna'?'La teva agenda':'Gestió de l’agenda';$('access-description').textContent=role==='anna'?'Aquí pots consultar els teus horaris, els pagaments i la informació per cuidar la Mar i el Pau. Si un dia no pots venir, toca’l al calendari per avisar-nos. També pots deixar-nos un missatge. No cal que confirmis cada visita: seguim l’horari del calendari, llevat que ens indiquis un canvi.':'Pots ajustar els horaris, registrar pagaments i consultar els missatges de l’Ana. Els imports es calculen amb els horaris guardats fins avui. Els canvis es comparteixen quan tens connexió.';$('identity').textContent=`${u.email} · ${role==='owner'?'Gestió familiar':'Accés de l’Ana'}`;$('greeting').textContent=role==='owner'?'La vostra agenda':'Hola, Ana';infoUnsubscribe=f.onSnapshot(f.doc(db,'information','ana'),snap=>renderInformation(snap.exists()?snap.data():null),()=>{$('ana-information').textContent='Cal publicar les regles actualitzades de Firebase per consultar aquesta secció.';});unsubscribe=f.onSnapshot(f.collection(db,'days'),{includeMetadataChanges:true},snapshot=>{days=new Map(snapshot.docs.filter(d=>isAgendaDay(d.data(),d.id)).map(d=>[d.id,d.data()]));$('status').textContent=snapshot.metadata.fromCache?'Connectant… Les dades poden estar pendents d’actualitzar.':'Agenda sincronitzada';render();if(role==='owner'&&!snapshot.metadata.fromCache&&defaultsSession!==u.uid){defaultsSession=u.uid;populateDefaults(u.uid).catch(fail);}},e=>{$('status').textContent='No s’ha pogut sincronitzar l’agenda.';fail(e);});}catch(e){$('status').textContent=e.message;fail(e);}});
 }catch(e){$('status').textContent='No s’ha pogut carregar la connexió.';$('connect').hidden=false;fail(e);}
}
$('config-form').onsubmit=e=>{e.preventDefault();try{const c=JSON.parse($('config').value);if(!c.apiKey||!c.projectId||!c.authDomain)throw Error('Falten camps a la configuració.');localStorage.setItem('crew-firebase-config',JSON.stringify(c));location.reload();}catch(e){fail(e);}};
$('login-form').onsubmit=async e=>{e.preventDefault();try{await authApi.signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);$('password').value='';}catch(e){fail(e);}};
$('reset').onclick=async()=>{try{const email=$('email').value.trim();if(!email)throw Error('Escriu primer el teu correu.');await authApi.sendPasswordResetEmail(auth,email);notice('Si el compte existeix, rebràs un correu per canviar la contrasenya.');}catch(e){fail(e);}};
$('logout').onclick=()=>{authApi.signOut(auth);$('day-dialog').close();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;for(const v of ['calendar','payments','information','settings'])$(v+'-view').hidden=v!==view;document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===b));});
$('prev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);render();};$('next').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);render();};$('today').onclick=()=>{month=new Date();render();openDay(localDate());};
document.addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(b)openDay(b.dataset.date);});$('close-dialog').onclick=()=>$('day-dialog').close();$('day-form').onsubmit=e=>{e.preventDefault();saveDay();};$('pay-button').onclick=pay;
const period=fridayPeriod();$('week-from').value=period.from;$('week-to').value=period.to;$('week-date').value=period.to;
$('week-from').onchange=renderWeeklyPayments;$('week-to').onchange=renderWeeklyPayments;$('weekly-pay-form').onsubmit=e=>{e.preventDefault();payWeek();};
$('import').onchange=async()=>{imported=[];$('import-confirm').hidden=true;$('import-preview').textContent='';try{const file=$('import').files[0];if(!file)return;imported=await readExcel(file);const s=imported.reduce((s,d)=>{const t=totals(d);s.hours+=t.hours;s.paid=cents(s.paid+t.paid);return s;},{hours:0,paid:0});const done=imported.filter(d=>d.turns.some(t=>t.attendance==='yes')).length;$('import-preview').textContent=`${imported.length} dies · ${done} amb assistència · ${s.hours.toLocaleString('ca-ES')} h · ${money(s.paid)} pagats. Es conservaran les dates i les notes originals. ${imported.information?.sections.length?'També s’incorporarà Información para Ana.':''} Revisa aquestes dades abans d’importar.`;$('import-confirm').hidden=false;}catch(e){fail(e);}};
$('import-confirm').onclick=()=>busy(async()=>{if(imported.information?.sections.length)await api.setDoc(api.doc(db,'information','ana'),{...imported.information,updatedBy:user.uid,updatedAt:api.serverTimestamp()});let added=0,skipped=0;$('import-result').textContent='Important…';for(const d of imported){const result=await api.runTransaction(db,async tx=>{const ref=api.doc(db,'days',d.date),snap=await tx.get(ref);if(snap.exists()&&!untouchedDefault(snap.data()))return false;tx.set(ref,{...d,updatedBy:user.uid,updatedAt:api.serverTimestamp()});return true;});if(result)added++;else skipped++;$('import-result').textContent=`${added} dies incorporats · ${skipped} dies existents conservats`;}$('import-confirm').hidden=true;notice('Importació completada.');});
$('export').onclick=()=>{const data=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),days:data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`mar-pau-crew-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('offline',()=>$('status').textContent='Sense connexió. Cal tornar a connectar per desar.');window.addEventListener('online',()=>$('status').textContent='Reconnectant l’agenda…');
let config=firebaseConfig;try{config ||=JSON.parse(localStorage.getItem('crew-firebase-config')||'null');}catch{}if(config)start(config);else{$('connect').hidden=false;$('status').textContent='Pendent de connectar Firebase';}
