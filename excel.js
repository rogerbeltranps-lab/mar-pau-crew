import {importRows} from './domain.mjs';
import {parseInformationRows} from './information.mjs';
export async function readExcel(file){
 if(file.size>10*1024*1024)throw Error('El fitxer és massa gran (màxim 10 MB).');
 const {unzipSync,strFromU8}=await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm');
 const zip=unzipSync(new Uint8Array(await file.arrayBuffer()));
 const xml=path=>{if(!zip[path])throw Error('No s’ha trobat el registre dins de l’Excel.');return new DOMParser().parseFromString(strFromU8(zip[path]),'application/xml');};
 const all=(root,name)=>Array.from(root.getElementsByTagNameNS('*',name));
 const shared=zip['xl/sharedStrings.xml']?all(xml('xl/sharedStrings.xml'),'si').map(si=>all(si,'t').map(t=>t.textContent).join('')):[];
 const workbook=xml('xl/workbook.xml');
 function sheetRows(name){
  const sheet=all(workbook,'sheet').find(s=>s.getAttribute('name')===name);if(!sheet)return [];
  const rel=all(xml('xl/_rels/workbook.xml.rels'),'Relationship').find(r=>r.getAttribute('Id')===sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));
  if(!rel)throw Error(`No es pot llegir la pestanya ${name}.`);
  const target=rel.getAttribute('Target'),path=target.startsWith('/')?target.slice(1):'xl/'+target;
  return all(xml(path),'row').map(row=>{const values={};for(const c of all(row,'c')){const type=c.getAttribute('t'),v=all(c,'v')[0]?.textContent||'';values[c.getAttribute('r').replace(/\d/g,'')]=type==='s'?shared[Number(v)]||'':type==='inlineStr'?all(c,'t').map(t=>t.textContent).join(''):v;}return values;});
 }
 const rows=sheetRows('Registro');
 const days=importRows(rows);if(!days.length)throw Error('No s’han trobat dates vàlides.');days.information=parseInformationRows(sheetRows('Información'));return days;
}
