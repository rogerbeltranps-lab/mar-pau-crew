import assert from 'node:assert/strict';
import {excelDate,excelTime,defaultDay,totals,importRows,fridayPeriod,allocatePayment,isAgendaDay} from './domain.mjs';
assert.equal(excelDate('46279.0'),'2026-09-14');
assert.equal(excelDate('19/09/2026'),'2026-09-19');
assert.equal(excelDate('46063.0'),'2026-02-10');
assert.equal(excelTime('0.3229166666666667'),'07:45');
const t=defaultDay('2026-09-15');assert.equal(t.turns.length,2);assert.equal(totals(t,'2026-09-14').earned,0);t.turns[1].status='not-needed';
t.turns[0].attendance='yes';t.paid=4;assert.deepEqual(totals(t),{hours:1,earned:10,paid:4,pending:6});
t.turns[1].attendance='yes';t.turns[1].status='planned';assert.equal(totals(t).earned,30);
const row={A:'46287.0',C:'Mañana + tarde',D:'Sí',E:'0.3333333333333333',F:'0.375',G:'No',H:'0.71875',I:'0.8020833333333334',M:'10',O:'10',Q:'46063.0',R:'Nota original'};
const d=importRows([row])[0];assert.equal(d.notes,'Nota original');assert.equal(d.turns[1].attendance,'no');assert.equal(d.payments[0].date,'2026-02-10');assert.deepEqual(d.source,row);assert.equal(totals(d).pending,0);
assert.equal(importRows([{A:'Fecha'},{}]).length,0);
console.log('Dates, torns, hores, pagaments i preservació d’importació: OK');

assert.deepEqual(fridayPeriod('2026-10-04'),{from:'2026-09-28',to:'2026-10-02'});
assert.deepEqual(fridayPeriod('2026-10-02'),{from:'2026-09-28',to:'2026-10-02'});
const a=defaultDay('2026-09-28'),b=defaultDay('2026-09-29');a.turns[0].attendance='yes';a.paid=2.5;b.turns[0].attendance='yes';b.turns[1].status='not-needed';
assert.deepEqual(allocatePayment([b,a],15),[{date:a.date,amount:10},{date:b.date,amount:5}]);
assert.deepEqual(allocatePayment([a,b],20),[{date:a.date,amount:10},{date:b.date,amount:10}]);
assert.throws(()=>allocatePayment([a,b],20.01));assert.throws(()=>allocatePayment([a,b],0));
assert.equal(a.paid,2.5);assert.equal(b.paid,0);
console.log('Pagaments conjunts: import exacte, pagament parcial i límit de saldo OK');

const scheduled=defaultDay('2026-09-28');
assert.equal(totals(scheduled,'2026-09-28').earned,12.5);
scheduled.turns[0].end='09:30';assert.equal(totals(scheduled,'2026-09-28').earned,17.5);
scheduled.turns[0].status='not-needed';assert.equal(totals(scheduled,'2026-09-28').earned,0);
scheduled.turns[0].status='unavailable';assert.equal(totals(scheduled,'2026-09-28').earned,0);
scheduled.turns[0].status='planned';scheduled.turns[0].attendance='no';assert.equal(totals(scheduled,'2026-09-28').earned,0);
console.log('Horaris: còmput automàtic, canvis d’hora, futur i cancel·lacions OK');

assert.equal(isAgendaDay({role:'anna'},'test-user-uid'),false);
assert.equal(isAgendaDay(defaultDay('2026-10-05'),'2026-10-05'),true);
assert.equal(isAgendaDay(defaultDay('2026-10-05'),'test-user-uid'),false);
console.log('Documents de permisos fora del calendari: OK');
