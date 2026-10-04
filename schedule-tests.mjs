import assert from 'node:assert/strict';
import {defaultDay,totals} from './domain.mjs';
import {scheduleFromInformation,reconcileSchedule,agendaDay,agendaDays} from './schedule.mjs';
const info={sections:[{title:'Calendari de Registro',rows:[
 {cells:['Data','Matí','Tarda','Aplicació']},
 {cells:['2027-02-02','08:15–09:00','17:15–19:15','Matí confirmat']},
 {cells:['2027-02-03','—','16:30–18:30','']},
 {cells:['2027-02-09','No cal','No cal','Dia confirmat']}
]}]};
const schedule=scheduleFromInformation(info);
assert.equal(schedule.size,3);
assert.equal(agendaDay(new Map(),schedule,'2027-02-02').turns[0].start,'08:15');
assert.equal(agendaDays(new Map(),schedule,'2027-02-01','2027-02-05').length,5);
assert.equal(agendaDay(new Map(),schedule,'2027-02-06').turns.length,0);
assert.equal(agendaDay(new Map(),schedule,'2027-08-01'),null);
const edited={...defaultDay('2027-02-02'),automatic:false,notes:'Família',annaNotes:'Avís',paid:12,payments:[{amount:12,date:'2027-02-01'}]};
edited.turns[0].status='unavailable';edited.turns[0].confirmation='no';edited.turns[1].end='20:00';
const corrected=reconcileSchedule(edited,schedule.get(edited.date),'2027-02-01');
assert.equal(corrected.turns[0].start,'08:15');assert.equal(corrected.turns[0].status,'unavailable');
assert.equal(corrected.turns[1].end,'20:00');assert.equal(corrected.paid,12);assert.deepEqual(corrected.payments,edited.payments);
assert.equal(corrected.notes,'Família');assert.equal(corrected.annaNotes,'Avís');
corrected.turns[0].start='08:30';
assert.equal(reconcileSchedule(corrected,schedule.get(edited.date),'2027-02-01'),corrected);
const cancelled=reconcileSchedule(defaultDay('2027-02-09'),schedule.get('2027-02-09'),'2027-02-01');
assert.ok(cancelled.turns.every(t=>t.status==='not-needed'));
assert.equal(totals(cancelled,'2027-02-10').earned,0);
const manual={...defaultDay('2027-02-03'),automatic:false};manual.turns[0].start='17:00';
assert.equal(reconcileSchedule(manual,schedule.get(manual.date),'2027-02-01'),manual);
const auto={...defaultDay('2027-02-03'),automatic:true};
assert.notEqual(reconcileSchedule(auto,schedule.get(auto.date),'2027-02-01'),auto);
const old={...defaultDay('2027-02-03'),automatic:true};
assert.equal(reconcileSchedule(old,schedule.get(old.date),'2027-02-04'),old);
console.log('Calendari: previsió visible sense editar, excepcions, festius, pagaments i avisos preservats OK');

const {periodDates,closeDay,reopenDay,confirmedRows}=await import('./schedule.mjs');
assert.equal(periodDates('2027-02-01','2027-02-14').length,14);
assert.throws(()=>periodDates('2027-02-14','2027-02-01'));
assert.throws(()=>periodDates('2027-01-01','2028-01-02'));
const vacation={id:'holiday-example',from:'2027-02-01',to:'2027-02-14',reason:'Vacances'};
const closed=closeDay(edited,vacation);
assert.ok(closed.turns.every(t=>t.status==='not-needed'));
assert.equal(totals(closed,'2027-03-01').earned,0);
assert.equal(closed.paid,edited.paid);assert.equal(closed.annaNotes,edited.annaNotes);
assert.equal(reconcileSchedule(closed,schedule.get(closed.date),'2027-02-01'),closed);
assert.deepEqual(reopenDay(closed,vacation.id).turns,edited.turns);
assert.equal(reopenDay(closed,'different-period'),null);
const overlap=closeDay(closed,{...vacation,id:'overlap'});
assert.deepEqual(reopenDay(overlap,'overlap').turns,edited.turns);
assert.equal(closeDay(defaultDay('2027-02-06'),vacation),null);
assert.deepEqual(confirmedRows([['2027-02-02','08:15–09:00','17:15–19:15','Matí confirmat']])[0].cells,info.sections[0].rows[1].cells);
assert.throws(()=>confirmedRows([['2027-02-02','<script>','—','Dia confirmat']]));
console.log('Vacances: període sencer, caps de setmana, solapaments, restauració i sincronització preservats OK');
