import fs from 'node:fs';
import path from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb,REPO_ROOT } from './lib/db.mjs';
import { parseCsv,pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';

export const reads={
 agreements:'SELECT code,name,licensor,territory,category,currency,starts_on,ends_on,owner FROM agreements ORDER BY code',
 products:'SELECT a.code AS agreement,p.code,p.name,p.approved_on,p.approval_evidence FROM products p JOIN agreements a ON a.id=p.agreement_id ORDER BY a.code,p.code',
 'reporting-due':"SELECT code,agreement,due_on,status,sale_count,exception_count,currency,earned_cents FROM period_position WHERE closed_at IS NULL ORDER BY due_on,code",
 'sales-exceptions':"SELECT reference,agreement,period,product,issue FROM sale_review WHERE issue<>'' ORDER BY reference",
 'royalty-review':'SELECT code,agreement,status,currency,eligible_net_cents,earned_cents,exception_count FROM period_position ORDER BY code',
 'guarantee-exposure':'SELECT code,currency,minimum_cents,advance_cents,earned_cents,guarantee_gap_cents,earned_above_advance_cents,unresolved_sales FROM guarantee_position ORDER BY code',
 'approvals-due':'SELECT a.code AS agreement,p.code,p.name FROM products p JOIN agreements a ON a.id=p.agreement_id WHERE p.approved_on IS NULL ORDER BY a.code,p.code',
 'renewals-due':"SELECT code,name,ends_on,owner FROM agreements WHERE ends_on<=current_date+60 ORDER BY ends_on,code",
 'stale-actions':"SELECT f.id,a.code AS agreement,f.note,f.owner,f.due_on FROM followups f JOIN agreements a ON a.id=f.agreement_id WHERE f.closed_at IS NULL AND f.due_on<current_date ORDER BY f.due_on",
 compliance:'SELECT * FROM compliance_findings ORDER BY rule,record',
 activity:'SELECT kind,record_id,actor,detail,created_at FROM activity ORDER BY created_at,id',
};
export const options={...Object.fromEntries(Object.keys(reads).map(c=>[c,[]])),help:[],agreement:['agreement'],period:['period'],
 'add-agreement':['code','name','licensor','property','territory','category','currency','start','end','rate-bps','minimum-cents','advance-cents','owner','evidence','review','actor'],
 'add-product':['agreement','code','name','actor'],
 'approve-product':['agreement','product','date','evidence','actor'],
 'add-period':['agreement','code','start','end','due','actor'],
 'add-sale':['period','product','reference','date','territory','currency','gross-cents','deductions-cents','evidence','actor'],
 'void-sale':['period','sale','reason','actor'],
 'close-period':['period','reconciliation','actor'],
 'log-followup':['agreement','note','owner','due','actor'],
 'close-followup':['followup','resolution','actor'],
 'review-records':['agreement','tax-year-end','retain-until','review','actor'],
 import:['period','file','map','dry-run','actor'],export:['out'],
 'weekly-review':[], 'draft-statement':['period'],
};
export const commands=Object.keys(options);
export function parse(argv){
 const [cmd='help',...args]=argv; if(!options[cmd])throw Error(`Unknown command ${cmd}. Use help.`);
 const flags={};
 if(cmd==='import'){if(args.shift()!=='licensee')throw Error('Use import licensee --period=... --file=...');}
 for(const arg of args){const m=arg.match(/^--([a-z-]+)(?:=(.*))?$/s);if(!m)throw Error(`Unexpected argument ${arg}`);
 const [,key,value]=m;if(key!=='json'&&!options[cmd].includes(key))throw Error(`Unknown flag --${key}`);if(key in flags)throw Error(`Duplicate --${key}`);
 if(['json','dry-run'].includes(key)){if(value!==undefined)throw Error(`--${key} takes no value`);flags[key]=true;}
 else{if(!value)throw Error(`--${key}=value is required`);flags[key]=value;}}
 return {cmd,flags};
}
export function date(value){const s=String(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Error(`Invalid ISO date ${s}`);return s;}
const need=(f,k)=>{if(typeof f[k]!=='string'||!f[k].trim())throw Error(`--${k} is required`);return f[k].trim();};
const int=(s,max=1000000000000)=>{if(!/^\d+$/.test(String(s))||!Number.isSafeInteger(Number(s))||Number(s)>max)throw Error(`Invalid nonnegative integer ${s}`);return Number(s);};
const today=()=>new Date().toISOString().slice(0,10);
const sources=['agreements','products','periods','sales','followups','imports','activity'];
export function display(rows){if(!Array.isArray(rows))return JSON.stringify(rows,null,2);if(!rows.length)return '  (none)';return table(rows,Object.keys(rows[0]).map(key=>({key,label:key.replace(/_cents$/,'').replaceAll('_',' '),format:v=>{if(v==null)return '';if(key.endsWith('_cents'))return (Number(v)/100).toFixed(2);if(typeof v==='object')return JSON.stringify(v);return String(v);}})));}
async function match(db,kind,value,scope){
 const ref=String(value).toLowerCase();const col=kind==='sales'?'reference':kind==='followups'?'note':'code';
 const rows=await db.query(`SELECT * FROM ${kind} ${scope?'WHERE '+scope.column+'=$1':''}`,scope?[scope.id]:[]);
 const exact=rows.filter(r=>r.id===value||String(r[col]).toLowerCase()===ref);const found=exact.length?exact:rows.filter(r=>r.id.startsWith(ref)||String(r[col]).toLowerCase().includes(ref)||String(r.name||'').toLowerCase().includes(ref));
 if(found.length!==1)throw Error(found.length?`Ambiguous ${kind}:\n${found.map(r=>`${r.id} ${r[col]} ${r.name||''}`).join('\n')}`:`No match for ${kind}: ${value}`);return found[0];
}
const event=(db,kind,id,actor,detail)=>db.query('INSERT INTO activity(kind,record_id,actor,detail) VALUES($1,$2,$3,$4)',[kind,id,actor,JSON.stringify(detail)]);
async function lock(db,agreement){await db.query('SELECT id FROM agreements WHERE id=$1 FOR UPDATE',[agreement]);}
async function getPeriod(db,value){const p=await match(db,'periods',value);await lock(db,p.agreement_id);return (await db.query('SELECT * FROM periods WHERE id=$1',[p.id]))[0];}
async function addSale(db,f,extra={}){
 const p=await getPeriod(db,need(f,'period'));if(p.closed_at)throw Error('Closed period is frozen');
 const pr=await match(db,'products',need(f,'product'),{column:'agreement_id',id:p.agreement_id});
 const sold=date(need(f,'date'));if(sold>today())throw Error('Sale date cannot be in the future');
 const [row]=await db.query(`INSERT INTO sales(period_id,product_id,reference,sold_on,territory,currency,gross_cents,deductions_cents,source_evidence,import_id,source_row) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[p.id,pr.id,need(f,'reference'),sold,need(f,'territory').toUpperCase(),need(f,'currency').toUpperCase(),int(need(f,'gross-cents')),int(f['deductions-cents']||'0'),need(f,'evidence'),extra.importId||null,JSON.stringify(extra.raw||{})]);return row;
}
const aliases={product:['Product','SKU','Product Code'],reference:['Reference','Sales Reference','Invoice Line'],date:['Sale Date','Date'],territory:['Territory','Country'],currency:['Currency'],'gross-cents':['Gross Cents'],'deductions-cents':['Deductions Cents'],evidence:['Evidence','Source Reference']};
async function importSales(db,f){
 const original=fs.readFileSync(need(f,'file'),'utf8');const rows=parseCsv(original);if(!rows.length)throw Error('Empty CSV');
 const map=f.map?JSON.parse(fs.readFileSync(f.map,'utf8')):{};
 if(!map||Array.isArray(map)||typeof map!=='object')throw Error('Mapping must be an object');
 for(const [k,v] of Object.entries(map))if(!aliases[k]||typeof v!=='string'||!Object.hasOwn(rows[0],v))throw Error(`Invalid mapping ${k}`);
 const p=await getPeriod(db,need(f,'period'));if(p.closed_at)throw Error('Closed period is frozen');
 const mapping={columns:map,period_id:p.id};const digest=createHash('sha256').update(original+JSON.stringify(mapping)).digest('hex');
 if((await db.query('SELECT id FROM imports WHERE digest=$1',[digest])).length)return {already_imported:true,inserted:0};
 const [im]=await db.query('INSERT INTO imports(digest,original_csv,mapping,actor) VALUES($1,$2,$3,$4) RETURNING id',[digest,original,JSON.stringify(mapping),need(f,'actor')]);
 let inserted=0;
 for(const raw of rows){const data=Object.fromEntries(Object.entries(aliases).map(([k,n])=>[k,pick(raw,...(map[k]?[map[k]]:n))]));
 await addSale(db,{...data,period:p.id}, {importId:im.id,raw});inserted++;}
 await event(db,'import-sales',im.id,f.actor,{inserted,period:p.code,digest});return {inserted,dry_run:Boolean(f['dry-run'])};
}
function draftFile(name,body){const dir=path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,`${name}-${randomUUID()}.md`);fs.writeFileSync(file,body,{flag:'wx',mode:0o600});return {file};}
export async function run(db,cmd,f={}){
 if(!options[cmd])throw Error('Unknown command');
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='help')return commands.map(command=>({command,flags:options[command].map(x=>'--'+x+(x==='dry-run'?'':'=...')).join(' ')}));
 if(cmd==='agreement'){const a=await match(db,'agreements',need(f,'agreement'));return {agreement:a,products:await db.query('SELECT * FROM products WHERE agreement_id=$1 ORDER BY code',[a.id]),periods:await db.query('SELECT * FROM period_position WHERE agreement_id=$1 ORDER BY starts_on',[a.id]),followups:await db.query('SELECT * FROM followups WHERE agreement_id=$1 ORDER BY due_on',[a.id])};}
 if(cmd==='period'){const p=await match(db,'periods',need(f,'period'));return {period:p,position:(await db.query('SELECT * FROM period_position WHERE id=$1',[p.id]))[0],sales:await db.query('SELECT * FROM sale_review WHERE period_id=$1 ORDER BY reference',[p.id])};}
 if(cmd==='export'){
 const out=path.resolve(need(f,'out'));const records={};await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{for(const t of sources)records[t]=await db.query(`SELECT * FROM ${t} ORDER BY id`);await db.exec('COMMIT');}catch(e){await db.exec('ROLLBACK');throw e;}
 fs.writeFileSync(out,JSON.stringify({format:'licensed-products-v1',exported_at:new Date().toISOString(),records},null,2)+'\n',{flag:'wx',mode:0o600});return {file:out};
 }
 if(cmd==='weekly-review'){
 const sections=[];for(const name of ['reporting-due','sales-exceptions','stale-actions'])sections.push(`## ${name}\n\n${display(await run(db,name))}`);
 return draftFile('weekly-review',`# Licensing weekly review\n\nInternal draft. Synthetic demo when seeded. Nothing sent.\n\n${sections.join('\n\n')}\n`);
 }
 if(cmd==='draft-statement'){
 const p=await match(db,'periods',need(f,'period'));const position=p.snapshot?.position||(await db.query('SELECT * FROM period_position WHERE id=$1',[p.id]))[0];
 const lines=p.snapshot?.sales||await db.query('SELECT reference,product,territory,currency,net_cents,royalty_cents,issue FROM sale_review WHERE period_id=$1 ORDER BY reference',[p.id]);
 return draftFile('statement',`# Royalty working statement: ${p.code}\n\n${p.closed_at?'Frozen reviewed snapshot.':'DRAFT, NOT REVIEWED.'} Not a licensor submission or payment instruction. Amount columns are currency units.\n\n${display([position])}\n\n${display(lines)}\n\nFixed percentage of net sales, rounded per line. Invalid sales excluded from earned totals and must be resolved. Minimum guarantees, advance recoupment, tax and payment amounts need separate contract review.\n`);
 }
 const actor=need(f,'actor');await db.exec('BEGIN');
 try{
 let row,detail={...f};delete detail.actor;delete detail.json;
 if(cmd==='add-agreement'){
 const vals=[need(f,'code'),need(f,'name'),need(f,'licensor'),need(f,'property'),need(f,'territory').toUpperCase(),need(f,'category'),need(f,'currency').toUpperCase(),date(need(f,'start')),date(need(f,'end')),int(need(f,'rate-bps'),10000),int(f['minimum-cents']||'0'),int(f['advance-cents']||'0'),need(f,'owner'),need(f,'evidence'),date(need(f,'review'))];
 [row]=await db.query(`INSERT INTO agreements(code,name,licensor,property,territory,category,currency,starts_on,ends_on,rate_bps,minimum_cents,advance_cents,owner,evidence,review_on) VALUES(${vals.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,vals);
 }else if(cmd==='add-product'){
 const a=await match(db,'agreements',need(f,'agreement'));await lock(db,a.id);
 [row]=await db.query('INSERT INTO products(agreement_id,code,name) VALUES($1,$2,$3) RETURNING *',[a.id,need(f,'code'),need(f,'name')]);
 }else if(cmd==='approve-product'){
 const a=await match(db,'agreements',need(f,'agreement'));await lock(db,a.id);const p=await match(db,'products',need(f,'product'),{column:'agreement_id',id:a.id});
 if(p.approved_on)throw Error('Approval is already recorded; use a reviewed amendment migration');const on=date(need(f,'date'));if(on>today())throw Error('Approval date cannot be future');
 [row]=await db.query('UPDATE products SET approved_on=$1,approval_evidence=$2 WHERE id=$3 RETURNING *',[on,need(f,'evidence'),p.id]);
 }else if(cmd==='add-period'){
 const a=await match(db,'agreements',need(f,'agreement'));await lock(db,a.id);
 [row]=await db.query('INSERT INTO periods(agreement_id,code,starts_on,ends_on,due_on,preparer) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[a.id,need(f,'code'),date(need(f,'start')),date(need(f,'end')),date(need(f,'due')),actor]);
 }else if(cmd==='add-sale')row=await addSale(db,f);
 else if(cmd==='void-sale'){
 const p=await getPeriod(db,need(f,'period'));const s=await match(db,'sales',need(f,'sale'),{column:'period_id',id:p.id});
 [row]=await db.query('UPDATE sales SET void_reason=$1,voided_at=now() WHERE id=$2 RETURNING *',[need(f,'reason'),s.id]);
 }else if(cmd==='close-period'){
 const p=await getPeriod(db,need(f,'period'));if(p.closed_at)throw Error('Period already closed');if(p.ends_on>today())throw Error('Cannot close a future period');if(p.preparer===actor)throw Error('Reviewer must differ from preparer');
 const position=(await db.query('SELECT * FROM period_position WHERE id=$1',[p.id]))[0];if(position.exception_count)throw Error('Resolve sales exceptions before closing');
 const [a]=await db.query('SELECT * FROM agreements WHERE id=$1',[p.agreement_id]);if(!a.evidence.trim())throw Error('Missing signed agreement evidence');
 const sales=await db.query('SELECT * FROM sale_review WHERE period_id=$1 ORDER BY reference',[p.id]);
 const snapshot={position,sales,agreement:a,reviewed_by:actor,reconciliation:need(f,'reconciliation'),captured_at:new Date().toISOString()};
 [row]=await db.query('UPDATE periods SET closed_at=now(),reviewer=$1,reconciliation=$2,snapshot=$3 WHERE id=$4 RETURNING *',[actor,f.reconciliation,JSON.stringify(snapshot),p.id]);
 }else if(cmd==='log-followup'){
 const a=await match(db,'agreements',need(f,'agreement'));await lock(db,a.id);
 [row]=await db.query('INSERT INTO followups(agreement_id,note,owner,due_on) VALUES($1,$2,$3,$4) RETURNING *',[a.id,need(f,'note'),need(f,'owner'),date(need(f,'due'))]);
 }else if(cmd==='close-followup'){
 const fup=await match(db,'followups',need(f,'followup'));await lock(db,fup.agreement_id);
 [row]=await db.query('UPDATE followups SET resolution=$1,closed_at=now() WHERE id=$2 AND closed_at IS NULL RETURNING *',[need(f,'resolution'),fup.id]);if(!row)throw Error('Follow-up already closed');
 }else if(cmd==='review-records'){
 const a=await match(db,'agreements',need(f,'agreement'));await lock(db,a.id);
 [row]=await db.query('UPDATE agreements SET tax_year_end=$1,retain_until=$2,review_on=$3 WHERE id=$4 RETURNING *',[date(need(f,'tax-year-end')),date(need(f,'retain-until')),date(need(f,'review')),a.id]);
 }else if(cmd==='import'){
 const result=await importSales(db,f);await db.exec(f['dry-run']?'ROLLBACK':'COMMIT');return result;
 }else throw Error('Unhandled command');
 await event(db,cmd,row.id,actor,detail);await db.exec('COMMIT');return row;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{const {cmd,flags}=parse(process.argv.slice(2));db=await getDb();const value=await run(db,cmd,flags);console.log(flags.json?JSON.stringify(value,null,2):display(value));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
