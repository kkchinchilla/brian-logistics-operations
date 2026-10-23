const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('zh-TW');
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
const notify=msg=>{const e=$('#message');if(e){e.textContent=msg;e.hidden=false;}else alert(msg)};
let currentUser=null,currentProfile=null;
async function requireLogin(){const {data:{user},error}=await db.auth.getUser();if(error||!user){location.replace('index.html');return false}const {data:p,error:pe}=await db.from('profiles').select('id,display_name,role,active,can_manage_finance').eq('id',user.id).single();if(pe||!p?.active){await db.auth.signOut();location.replace('index.html');return false}currentUser=user;currentProfile=p;await DashboardAccess146.load();$('#account-name').textContent=p.display_name;return true}
const supervisor=()=>currentProfile?.role==='dispatcher';
const finance=()=>supervisor()&&DashboardAccess146.finance();
async function rows(table,fields='*',q){let req=db.from(table).select(fields);if(q)req=q(req);const {data,error}=await req;if(error)throw error;return data||[]}
// Supabase's default API page size is often 1,000. Reports must fetch every page.
// Call only for tables with a stable unique numeric 'id' column.
async function allPagedRows(table,fields='*',scope){
 const out=[];const size=500;let offset=0;
 while(true){
  let q=db.from(table).select(fields);
  if(scope)q=scope(q);
  q=q.order('id',{ascending:true}).range(offset,offset+size-1);
  const {data,error}=await q;if(error)throw error;
  out.push(...(data||[]));
  if(!data||data.length<size)break;
  offset+=size;
  if(offset>100000)throw Error('報表筆數超出安全上限，請分批查詢');
 }
 return out;
}
async function save(table,payload,match){const q=match?db.from(table).update(payload).match(match):db.from(table).insert(payload);const {error}=await q;if(error)throw error;return true}
function modal(title,fields,onSave){$('#modal-title').textContent=title;$('#modal-fields').innerHTML=fields;$('#modal-error').textContent='';$('#modal').classList.add('open');$('#modal-save').hidden=false;$('#modal-save').onclick=async()=>{try{$('#modal-save').disabled=true;await onSave();closeModal()}catch(e){$('#modal-error').textContent=e.message||String(e)}finally{$('#modal-save').disabled=false}}}
function closeModal(){$('#modal').classList.remove('open')}
function option(v,t,selected){return `<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(t)}</option>`}
function dropdown(arr,key,label,selected){return arr.map(x=>option(x[key],x[label]||x[key],selected)).join('')}
function field(label,id,value='',type='text'){return `<label for="${id}">${label}</label><input id="${id}" class="field" type="${type}" value="${esc(value)}">`}
function chosen(id){return $('#'+id).value}
function wrapTable(headers,body){return `<div class="panel"><div class="scroll"><table class="gridtable"><thead><tr>${headers.map((h,i)=>`<th class="${i?'':'sticky'}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${headers.length}" class="empty">目前沒有資料</td></tr>`}</tbody></table></div></div>`}
async function init(){if(!await requireLogin())return;try{await window.loadPage()}catch(e){console.error(e);notify('載入失敗：'+e.message)}}
document.addEventListener('DOMContentLoaded',()=>{$('#modal-cancel').onclick=closeModal;$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});init()});
