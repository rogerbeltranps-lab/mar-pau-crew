import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {totals} from './domain.mjs';
import {parseInformationRows} from './information.mjs';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('./google-sheets-sync.gs',import.meta.url),'utf8'),context);
const days=[{date:'2026-09-28',rate:10,paid:12.5,notes:'=test',turns:[{id:'morning',start:'07:45',end:'09:00',status:'planned',attendance:'pending'}],payments:[{id:'weekly',date:'2026-10-02',amount:12.5}]},
 {date:'2026-09-29',rate:10,paid:5,turns:[{id:'morning',start:'08:00',end:'09:00',status:'planned',attendance:'yes'}],payments:[{id:'weekly',date:'2026-10-02',amount:5}]},
 {date:'2027-01-01',rate:10,paid:0,turns:[{id:'morning',start:'08:00',end:'10:00',status:'planned'}]}];
for(const day of days)assert.deepEqual(JSON.parse(JSON.stringify(context.crewTotals(day,'2026-10-04'))),totals(day,'2026-10-04'));
const output=context.crewOutput(days,'2026-10-04');
assert.equal(output.payments.length,1);assert.equal(output.payments[0][1],17.5);
assert.equal(output.register[0][8],'💶 Pagat');assert.equal(output.register[1][8],'Pendent');
assert.equal(context.crewSafeCell('=test'),"'=test");assert.equal(context.crewSafeCell(-5),-5);
const rows=[{A:'Información para Ana'},{},{A:'Horario semanal'},{A:'Día',B:'Mañana'},{A:'Lunes',B:'08:00–09:00'},{},{A:'Antes de salir de casa'},{A:'Primera indicación'},{A:'Segunda indicación'}];
const info=parseInformationRows(rows);assert.equal(info.sections.length,2);assert.equal(info.sections[1].rows.length,2);
assert.deepEqual(JSON.parse(JSON.stringify(context.parseInformationRows(rows))),info);
const fields=context.crewEncode(info).mapValue.fields;assert.deepEqual(JSON.parse(JSON.stringify(context.crewFields(fields))),info);
let calls=[];context.crewRequest=path=>{calls.push(path);return calls.length===1?{documents:[{fields:{date:{stringValue:'2026-09-28'}}}],nextPageToken:'page 2'}:{documents:[{fields:{date:{stringValue:'2026-09-29'}}}]};};
assert.equal(context.crewLoadDays().length,2);assert.ok(calls[1].includes('pageToken=page%202'));
console.log('Sync: paritat amb l’app, pagaments agrupats, text segur, informació i paginació OK');
