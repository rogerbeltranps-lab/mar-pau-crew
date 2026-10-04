import {defaultDay,localDate,untouchedDefault,cents} from './domain.mjs?v=11';

// Calendar data travels through the existing private Información sync.
export function scheduleFromInformation(info){
 const days=new Map(),section=info?.sections?.find(s=>s.title==='Calendari de Registro');
 for(const {cells} of section?.rows||[]){
  const [date,morning,afternoon,application]=cells;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  const day=defaultDay(date),turns=[];
  for(const [id,value] of [['morning',morning],['afternoon',afternoon]]){
   const match=String(value||'').match(/^(\d{2}:\d{2})[–-](\d{2}:\d{2})$/);
   if(match)turns.push({id,start:match[1],end:match[2],status:'planned',attendance:'pending',confirmation:'pending'});
  }
  const cancelled=morning==='No cal'&&afternoon==='No cal';
  if(cancelled)turns.push(...day.turns.map(t=>({...t,status:'not-needed'})));
  const calendarRevision=JSON.stringify([date,morning,afternoon,application||'']);
  days.set(date,{...day,turns,automatic:true,calendarRevision,calendarApplication:application||''});
 }
 return days;
}

export function reconcileSchedule(current,planned,today=localDate()){
 if(!planned)return current;
 if(!current)return planned;
 if(current.closure?.id)return current;
 if(current.calendarRevision===planned.calendarRevision)return current;
 const confirmed=planned.calendarApplication==='Dia confirmat'||planned.calendarApplication==='Matí confirmat';
 const imported=current.source&&current.automatic!==false&&!current.annaNotes?.trim()
  &&cents(current.paid)===0&&!(current.payments||[]).length
  &&current.turns.every(t=>t.status==='planned'&&t.attendance==='pending'&&t.confirmation==='pending');
 if(!confirmed&&(current.date<today||(!untouchedDefault(current)&&!imported)))return current;
 let turns;
 if(planned.calendarApplication==='Matí confirmat'){
  const morning=planned.turns.find(t=>t.id==='morning');
  turns=current.turns.map(t=>t.id==='morning'?{...t,start:morning.start,end:morning.end}:t);
  if(!turns.some(t=>t.id==='morning'))turns.unshift(morning);
 }else turns=planned.turns.map(t=>{
  const old=current.turns.find(o=>o.id===t.id);
  return {...t,confirmation:old?.confirmation||'pending',
   ...(t.status==='planned'&&old?.status==='unavailable'?{status:'unavailable'}:{})};
 });
 return {...current,turns,calendarRevision:planned.calendarRevision,calendarApplication:planned.calendarApplication};
}

export function agendaDay(records,planned,date){
 const saved=records.get(date),source=planned.get(date);
 if(saved||source)return reconcileSchedule(saved,source);
 if(date>='2026-09-14'&&date<='2027-06-22')return {...defaultDay(date),automatic:true};
 return null;
}

export function agendaDays(records,planned,from,to){
 const result=[],cursor=new Date(from+'T12:00:00');
 for(;localDate(cursor)<=to;cursor.setDate(cursor.getDate()+1)){
  const day=agendaDay(records,planned,localDate(cursor));
  if(day?.turns.length)result.push(day);
 }
 return result;
}

export function periodDates(from,to){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)throw Error('Revisa la data inicial i la final.');
 const result=[],cursor=new Date(from+'T12:00:00');
 if(Number.isNaN(cursor.getTime()))throw Error('Revisa les dates.');
 for(;localDate(cursor)<=to;cursor.setDate(cursor.getDate()+1)){
  result.push(localDate(cursor));
  if(result.length>366)throw Error('Tria un període de com a màxim un any.');
 }
 return result;
}

export function closeDay(day,closure){
 if(!day?.turns.length)return null;
 return {...day,automatic:false,closure,
  closurePreviousTurns:day.closurePreviousTurns||day.turns.map(t=>({...t})),
  turns:day.turns.map(t=>({...t,status:'not-needed'}))};
}

export function reopenDay(day,id){
 if(day?.closure?.id!==id)return null;
 const next={...day,automatic:false,turns:day.closurePreviousTurns||day.turns};
 delete next.closure;delete next.closurePreviousTurns;
 return next;
}

export function confirmedRows(payload){
 if(!Array.isArray(payload)||!payload.length||payload.length>366)throw Error('El calendari rebut no és vàlid.');
 const seen=new Set();
 for(const row of payload){
  if(!Array.isArray(row)||row.length!==4||row.some(c=>typeof c!=='string'||c.length>30)
   ||!/^\d{4}-\d{2}-\d{2}$/.test(row[0])||seen.has(row[0])
   ||![row[1],row[2]].every(v=>v==='—'||v==='No cal'||/^([01]\d|2[0-3]):[0-5]\d–([01]\d|2[0-3]):[0-5]\d$/.test(v))
   ||!['Dia confirmat','Matí confirmat'].includes(row[3]))throw Error('El calendari rebut no és vàlid.');
  seen.add(row[0]);
 }
 return payload.map(cells=>({cells}));
}
