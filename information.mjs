export function parseInformationRows(rows){
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
