export const cents=n=>Math.round((Number(n)||0)*100)/100;
export function isAgendaDay(day,id=day?.date){return !!day&&/^\d{4}-\d{2}-\d{2}$/.test(day.date)&&day.date===id&&Array.isArray(day.turns);}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function excelDate(v){if(v===''||v==null)return '';if(/^\d+(\.\d+)?$/.test(String(v)))return new Date(Date.UTC(1899,11,30)+Number(v)*86400000).toISOString().slice(0,10);const m=String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:String(v);}
export function excelTime(v){if(v===''||v==null)return '';if(!/^\d+(\.\d+)?$/.test(String(v)))return String(v);const m=Math.round(Number(v)*1440);return `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
export function hours(turn){if(!turn.start||!turn.end)return 0;const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));return Math.max(0,minutes(turn.end)-minutes(turn.start))/60;}
export function totals(day,today=localDate()){const h=(day.turns||[]).filter(t=>t.status==='planned'&&t.attendance!=='no'&&day.date<=today).reduce((s,t)=>s+hours(t),0);const earned=cents(h*day.rate);return {hours:h,earned,paid:cents(day.paid),pending:cents(earned-cents(day.paid))};}
export function fridayPeriod(date=localDate()){
 const friday=new Date(date+'T12:00:00');friday.setDate(friday.getDate()-(friday.getDay()+2)%7);
 const monday=new Date(friday);monday.setDate(monday.getDate()-4);
 return {from:localDate(monday),to:localDate(friday)};
}
export function allocatePayment(records,amount){
 let remaining=Math.round(Number(amount)*100);
 if(!Number.isFinite(remaining)||remaining<=0)throw Error('Indica un import positiu.');
 const allocations=[];
 for(const d of [...records].sort((a,b)=>a.date.localeCompare(b.date))){
  const pending=Math.max(0,Math.round(totals(d).pending*100)),part=Math.min(remaining,pending);
  if(part){allocations.push({date:d.date,amount:part/100});remaining-=part;}
 }
 if(remaining>0)throw Error('L’import supera el saldo pendent del període.');
 return allocations;
}
export function defaultDay(date){const dow=new Date(date+'T12:00:00').getDay();const schedule={1:[['morning','07:45','09:00']],2:[['morning','08:00','09:00'],['afternoon','17:15','19:15']],3:[['afternoon','16:30','18:30']],4:[['morning','08:00','09:00']],5:[['morning','07:45','09:00']]};return {date,rate:10,paid:0,payments:[],notes:'',annaNotes:'',turns:(schedule[dow]||[]).map(([id,start,end])=>({id,start,end,status:'planned',attendance:'pending',confirmation:'pending'}))};}
export function importRows(rows){return rows.filter(r=>/^\d+(\.\d+)?$/.test(r.A||'')).map(r=>{const day={date:excelDate(r.A),rate:Number(r.M)||10,paid:cents(r.O),payments:[],notes:r.R||'',annaNotes:'',source:{...r},turns:[]};for(const [id,flag,start,end] of [['morning','D','E','F'],['afternoon','G','H','I']]){if((r[flag]&&r[flag]!=='—')||r[start]||r[end])day.turns.push({id,start:excelTime(r[start]),end:excelTime(r[end]),status:r.C==='FIESTA'?'not-needed':'planned',attendance:r[flag]==='Sí'?'yes':r[flag]==='No'?'no':'pending',confirmation:'pending'});}if(day.paid>0)day.payments.push({amount:day.paid,date:excelDate(r.Q),note:'Importat del registre original'});return day;});}

export function missingDefaultDays(existing,from,to){
 const known=new Set(existing),result=[],date=new Date(from+'T12:00:00');
 for(;localDate(date)<=to;date.setDate(date.getDate()+1)){
  const key=localDate(date),day=defaultDay(key);
  if(!known.has(key)&&day.turns.length)result.push({...day,automatic:true});
 }
 return result;
}
export function untouchedDefault(day){
 return day?.automatic===true&&!day.notes?.trim()&&!day.annaNotes?.trim()
  &&cents(day.paid)===0&&!(day.payments||[]).length
  &&(day.turns||[]).every(t=>t.status==='planned'&&t.attendance==='pending'&&t.confirmation==='pending');
}
