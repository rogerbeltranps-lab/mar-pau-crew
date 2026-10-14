// Install as a bound Apps Script in the existing childcare spreadsheet.
// Uses the project owner's Google authorization, without storing passwords.
const CREW_PROJECT = 'mar-pau-crew';
const CREW_BASE = 'https://firestore.googleapis.com/v1/projects/' + CREW_PROJECT + '/databases/(default)/documents';

function installCrewSync() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!sheet) throw new Error('Obre Apps Script des d’Extensions del teu full.');
  PropertiesService.getScriptProperties().setProperty('crewSpreadsheetId', sheet.getId());
  syncCrew(); // Validate access before enabling the timer.
  ScriptApp.getProjectTriggers().filter(t => ['syncCrew','crewMenu'].includes(t.getHandlerFunction())).forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncCrew').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('crewMenu').forSpreadsheet(sheet).onOpen().create();
  crewMenu();
}

function crewMenu() {
  SpreadsheetApp.getUi().createMenu('Mar & Pau’s Crew')
    .addItem('Actualitzar ara', 'syncCrew')
    .addItem('Aturar actualització automàtica', 'stopCrewSync').addToUi();
}

function stopCrewSync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncCrew').forEach(t => ScriptApp.deleteTrigger(t));
}

function crewRequest(path, method, body) {
  const response = UrlFetchApp.fetch(CREW_BASE + path, {
    method: method || 'get', headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
    contentType: 'application/json', muteHttpExceptions: true,
    ...(body ? {payload: JSON.stringify(body)} : {})
  });
  if (response.getResponseCode() >= 300) {
    throw new Error('Firestore (' + response.getResponseCode() + '). Autoritza amb el compte Google que és propietari del projecte Firebase. ' + response.getContentText().slice(0,400));
  }
  return JSON.parse(response.getContentText());
}

function crewDecode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(crewDecode);
  if ('mapValue' in value) return crewFields(value.mapValue.fields || {});
  return null;
}
function crewFields(fields) {return Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,crewDecode(v)]));}
function crewEncode(value) {
  if (typeof value === 'string') return {stringValue: value};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(crewEncode)}};
  return {mapValue: {fields: Object.fromEntries(Object.entries(value).map(([k,v]) => [k,crewEncode(v)]))}};
}
function crewLoadDays() {
  const days = [];let token = '';
  do {
    const data = crewRequest('/days?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    (data.documents || []).forEach(doc => days.push(crewFields(doc.fields || {})));
    token = data.nextPageToken || '';
  } while (token);
  return days.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date)).sort((a,b) => a.date.localeCompare(b.date));
}
function crewSafeCell(value) {return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;}
function crewCents(n) {return Math.round((Number(n)||0)*100)/100;}
function crewTotals(day, today) {
  const hours = (day.turns || []).filter(t => t.status === 'planned' && t.attendance === 'yes' && day.date <= today)
    .reduce((sum,t) => {const minutes = s => Number(s.slice(0,2))*60 + Number(s.slice(3));return sum + (t.start && t.end ? Math.max(0,minutes(t.end)-minutes(t.start))/60 : 0);},0);
  const earned = crewCents(hours * day.rate),paid=crewCents(day.paid);
  return {hours,earned,paid,pending:crewCents(earned-paid)};
}
function crewOutput(days, today) {
  const groups = new Map();
  const register = days.map(day => {
    const sums=crewTotals(day,today),turn=id=>{const t=(day.turns||[]).find(t=>t.id===id);return t ? t.start+'–'+t.end+' · '+(t.status==='planned'&&t.attendance==='no'?'No va venir':({'planned':'Ve','not-needed':'No cal','unavailable':'No pot'}[t.status]||t.status)) : '';};
    (day.payments || []).forEach((p,i)=>{
      const key=p.id || (p.date ? 'import-'+p.date : 'import-'+day.date+'-'+i);
      const g=groups.get(key)||{id:key,date:p.date||'',from:p.from||'',to:p.to||'',amount:0,days:[],note:p.note||''};
      g.amount=crewCents(g.amount+p.amount);if(!g.days.includes(day.date))g.days.push(day.date);groups.set(key,g);
    });
    return [day.date,turn('morning'),turn('afternoon'),sums.hours,day.rate,sums.earned,sums.paid,sums.pending,sums.earned>0&&sums.paid>0&&sums.pending<=0?'💶 Pagat':sums.pending>0?'Pendent':'',day.notes||'',day.annaNotes||''];
  });
  const payments=[...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
    .map(g=>[g.date,g.amount,g.from,g.to,g.days.join(', '),g.note,g.id]);
  return {register,payments};
}
function crewWrite(sheet, name, headers, rows, stamp, currencyColumns) {
  const target=sheet.getSheetByName(name)||sheet.insertSheet(name),width=headers.length;
  if(target.getMaxRows()<rows.length+2)target.insertRowsAfter(target.getMaxRows(),rows.length+2-target.getMaxRows());
  if(target.getMaxColumns()<width)target.insertColumnsAfter(target.getMaxColumns(),width-target.getMaxColumns());
  const existingRows=target.getLastRow();
  if(existingRows)target.getRange(1,1,existingRows,width).clearContent();
  target.getRange(1,1,1,width).breakApart().merge();
  target.getRange(1,1).setValue('Actualitzat: '+stamp+' · Dades de l’app. Modifica els horaris i els pagaments a la web.');
  target.getRange(2,1,1,width).setValues([headers]).setFontWeight('bold').setBackground('#eeeeee');
  if(rows.length)target.getRange(3,1,rows.length,width).setValues(rows.map(row=>row.map(crewSafeCell)));
  target.setFrozenRows(2);target.getRange(1,1,Math.max(rows.length+2,3),width).setVerticalAlignment('top').setWrap(true);
  target.setColumnWidths(1,width,150);target.setRowHeights(1,2,48);
  if(name==='Registre app')target.setColumnWidths(10,2,300);
  if(name==='Pagaments app')target.setColumnWidth(5,300);
  currencyColumns.forEach(column=>target.getRange(3,column,Math.max(1,rows.length),1).setNumberFormat('€0.00'));
  if(target.getFilter())target.getFilter().remove();
  if(rows.length)target.getRange(2,1,rows.length+1,width).createFilter();
  target.getRange('A1').setNote('Actualització automàtica cada 30 minuts. Menú Mar & Pau’s Crew → Actualitzar ara. Els fulls originals es conserven.');
}
function syncCrew() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    const id=PropertiesService.getScriptProperties().getProperty('crewSpreadsheetId');
    if(!id)throw new Error('Executa primer installCrewSync.');
    const sheet=SpreadsheetApp.openById(id),days=crewLoadDays();
    const informationSheet=sheet.getSheetByName('Información');
    if(!informationSheet)throw new Error('No s’ha trobat la pestanya Información.');
    const rows=informationSheet.getRange(1,1,informationSheet.getLastRow(),4).getDisplayValues()
      .map(row=>Object.fromEntries(['A','B','C','D'].map((k,i)=>[k,row[i]])));
    const info=parseInformationRows(rows);
    if(!info.sections.length)throw new Error('Información és buida. Es conserva la informació de l’app.');
    const encoded=crewEncode(info).mapValue.fields;
    encoded.updatedBy={stringValue:'google-sheets-sync'};encoded.updatedAt={timestampValue:new Date().toISOString()};
    crewRequest('/information/ana','patch',{fields:encoded});
    const today=Utilities.formatDate(new Date(),'Europe/Madrid','yyyy-MM-dd'),stamp=Utilities.formatDate(new Date(),'Europe/Madrid','dd/MM/yyyy HH:mm');
    if(!days.length){['Registre app','Pagaments app'].forEach(name=>{const tab=sheet.getSheetByName(name);if(tab)tab.getRange('A1').setValue('App sense dies: importa primer l’Excel a Gestió. Última comprovació: '+stamp);});return;}
    const output=crewOutput(days,today);
    crewWrite(sheet,'Registre app',['Dia','Matí','Tarda','Hores','Tarifa €/h','Generat €','Pagat €','Pendent €','Estat','Observacions família','Missatge Ana'],output.register,stamp,[5,6,7,8]);
    crewWrite(sheet,'Pagaments app',['Data pagament','Import €','Des de','Fins a','Dies coberts','Nota','Identificador'],output.payments,stamp,[2]);
  } finally {lock.releaseLock();}
}

function parseInformationRows(rows){
 const sections=[];let current=null;
 for(const row of rows){
  const values=['A','B','C','D'].map(k=>String(row[k]??'').trim());
  while(values.length&&!values.at(-1))values.pop();
  if(!values.length){current=null;continue;}
  if(!current){
   if(/^informaci[oó]n para ana$/i.test(values[0]))continue;
   current={title:values[0],rows:[]};sections.push(current);
  }else current.rows.push({cells:values});
 }
 return {title:'Información para Ana',sections:sections.filter(s=>s.rows.length)};
}


// Email notices for deliberate app edits. Runs with the owner's Apps Script
// authorization; no email credentials or service account secrets are published.
function installCrewNotifications(annaEmail, rogerEmail) {
  const props=PropertiesService.getScriptProperties();
  const owner=(rogerEmail||Session.getEffectiveUser().getEmail()||'').trim();
  const anna=(annaEmail||'').trim();
  const valid=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if(!valid(owner)||!valid(anna)||owner.toLowerCase()===anna.toLowerCase())
    throw new Error('Indica els dos correus diferents: installCrewNotifications("anna@example.com", "roger@example.com"). El segon és opcional si el compte que executa el script és el de Roger.');
  props.setProperties({crewRogerEmail:owner,crewAnnaEmail:anna});
  // The first installation starts from NOW, not from historical data.
  if(!props.getProperty('crewNotificationCursor'))
    props.setProperty('crewNotificationCursor',JSON.stringify({at:new Date().toISOString(),id:'initial'}));
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='notifyCrew').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('notifyCrew').timeBased().everyMinutes(5).create();
}

function stopCrewNotifications() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='notifyCrew').forEach(t=>ScriptApp.deleteTrigger(t));
}

function crewNotificationEvents(cursor) {
  // A server-side cursor avoids scanning the entire notification history every five minutes.
  const documentName='projects/'+CREW_PROJECT+'/databases/(default)/documents/notifications/'+cursor.id;
  const query={structuredQuery:{
    from:[{collectionId:'notifications'}],
    orderBy:[{field:{fieldPath:'createdAt'},direction:'ASCENDING'},
             {field:{fieldPath:'__name__'},direction:'ASCENDING'}],
    startAt:{values:[{timestampValue:cursor.at},{referenceValue:documentName}],before:false},
    limit:100
  }};
  const response=crewRequest(':runQuery','post',query);
  return (response||[]).filter(row=>row.document).map(row=>{
    const doc=row.document,entry=crewFields(doc.fields||{});
    return {...entry,id:doc.name.slice(doc.name.lastIndexOf('/')+1)};
  });
}

function notifyCrew() {
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    const props=PropertiesService.getScriptProperties();
    const annaEmail=props.getProperty('crewAnnaEmail'),rogerEmail=props.getProperty('crewRogerEmail');
    if(!annaEmail||!rogerEmail)throw new Error('Executa installCrewNotifications amb els dos correus.');
    let cursor=JSON.parse(props.getProperty('crewNotificationCursor')||'null');
    if(!cursor)throw new Error('No hi ha punt inicial de notificacions. Torna a executar installCrewNotifications.');
    const events=crewNotificationEvents(cursor),verified=new Map();
    for(let i=0;i<events.length;){
      const first=events[i],group=[first];
      while(i+group.length<events.length&&group.length<10
       &&events[i+group.length].actorUid===first.actorUid
       &&events[i+group.length].actorRole===first.actorRole)group.push(events[i+group.length]);
      const role=first.actorRole,recipient=role==='owner'?annaEmail:role==='anna'?rogerEmail:'';
      if(recipient){
        if(!verified.has(first.actorUid)){
          const member=crewRequest('/members/'+encodeURIComponent(first.actorUid));
          verified.set(first.actorUid,crewFields(member.fields||{}).role);
        }
        if(verified.get(first.actorUid)===role){
          const name=role==='owner'?'Roger':'Anna';
          const title=role==='owner'?'Canvis d’en Roger':'Avisos de l’Ana';
          const body=group.map(e=>'Data: '+e.date+'\nTipus: '+({day:'Torns o missatges',payment:'Pagaments',vacation:'Vacances / horaris',schedule:'Calendari'}[e.kind]||'Canvi')+'\n'+e.summary).join('\n\n---\n\n');
          MailApp.sendEmail({to:recipient,subject:"Mar & Pau's Crew — "+title+(group.length>1?' ('+group.length+')':''),body:name+' ha fet aquests canvis a l’app:\n\n'+body+'\n\nObre l’agenda per consultar-ne els detalls.'});
        }
      }
      const last=group[group.length-1];
      cursor={at:last.createdAt,id:last.id};
      props.setProperty('crewNotificationCursor',JSON.stringify(cursor));
      i+=group.length;
    }
  } finally {lock.releaseLock();}
}

function testCrewNotifications() {
  const props=PropertiesService.getScriptProperties();
  const anna=props.getProperty('crewAnnaEmail'),roger=props.getProperty('crewRogerEmail');
  if(!anna||!roger)throw new Error('Executa primer installCrewNotifications.');
  MailApp.sendEmail(anna,"Mar & Pau's Crew — prova","Aquest és un correu de prova per a l’Ana. Les notificacions de canvis d’en Roger arribaran aquí.");
  MailApp.sendEmail(roger,"Mar & Pau's Crew — prova","Aquest és un correu de prova per a Roger. Els avisos de l’Ana arribaran aquí.");
}
