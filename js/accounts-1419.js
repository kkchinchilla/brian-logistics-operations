/* Brian-only account dashboard. Privileged mutations run in account-admin. */
let accountUsers=[],accountActor='',accountBusy=false,accountReturnFocus=null;
const accountRoles={driver:'司機',dispatcher:'主管'};
function accountPhone(value){
 const phone=String(value??'').normalize('NFKC').trim().replace(/[\s()\-]/g,'');
 if(/^09\d{8}$/.test(phone))return '+886'+phone.slice(1);
 if(/^8869\d{8}$/.test(phone))return '+'+phone;
 if(phone.startsWith('+886'))return /^\+8869\d{8}$/.test(phone)?phone:null;
 return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
function phoneDisplay(value){const p=value.startsWith('+')?value:'+'+value;return /^\+8869\d{8}$/.test(p)?'0'+p.slice(4):value||'尚未設定';}
async function accountRequest(body){
 if(!finance())throw Error('帳號管理僅限 Brian 使用。');
 const {data,error}=await db.functions.invoke('account-admin',{body});
 if(error){
  let message='無法完成操作，請重新整理確認後再試。';
  try{const result=await error.context.json();if(result?.error)message=result.error;}catch{/* Network failures have no response. */}
  throw Error(message);
 }
 if(!data||data.error)throw Error(data?.error||'帳號服務未回傳結果。');
 return data;
}
async function loadPage(){
 if(!finance()){$('#page').innerHTML='<p class="empty">帳號管理僅限 Brian 使用。</p>';return;}
 $('#head-actions').insertAdjacentHTML('afterbegin','<button class="btn primary" id="account-add">＋ 新增使用者</button>');
 $('#account-add').onclick=()=>openAccountEditor('create');
 $('#page').innerHTML='<section class="panel"><div class="panel-title">使用者名單</div><div class="accounts-tools"><input class="field search" id="account-search" placeholder="搜尋姓名或手機號碼" aria-label="搜尋姓名或手機號碼"><select class="field" id="account-filter" aria-label="篩選角色與狀態"><option value="all">所有帳號</option><option value="driver">司機</option><option value="dispatcher">主管</option><option value="deleted">已刪除帳號</option></select><button class="btn" id="account-refresh">重新整理</button></div><div id="account-list"><p class="empty">載入帳號中…</p></div><div class="footer">點選手機號碼可修改登入號碼。刪除帳號後仍會保留歷史出勤與報表。</div></section>';
 $('#account-search').oninput=renderAccounts;$('#account-filter').onchange=renderAccounts;
 $('#account-refresh').onclick=async()=>{try{await reloadAccounts();}catch(e){notify(e.message);}};
 $('#account-list').onclick=e=>{const b=e.target.closest('[data-account-action]');if(b)openAccountEditor(b.dataset.accountAction,b.dataset.id);};
 await reloadAccounts();
}
async function reloadAccounts(){
 $('#account-refresh').disabled=true;
 try{const result=await accountRequest({action:'list'});accountUsers=result.users;accountActor=result.actor_id;renderAccounts();}
 finally{$('#account-refresh').disabled=false;}
}
function renderAccounts(){
 const live=accountUsers.filter(u=>!u.deleted),term=($('#account-search').value||'').toLowerCase().replace(/[\s()\-]/g,''),filter=$('#account-filter').value;
 $('#stats').innerHTML=[['使用者',live.length],['司機',live.filter(u=>u.role==='driver').length],['主管',live.filter(u=>u.role==='dispatcher').length]].map(([label,n])=>`<div class="kpi"><small>${label}</small><strong>${n}</strong></div>`).join('');
 const list=accountUsers.filter(u=>(filter==='deleted'?u.deleted:!u.deleted&&(filter==='all'||filter===u.role))&&[u.display_name,u.phone,phoneDisplay(u.phone)].some(v=>String(v).toLowerCase().replace(/[\s()\-]/g,'').includes(term)));
 const button=(u,action,label,extra='')=>`<button class="btn ${extra}" data-account-action="${action}" data-id="${esc(u.id)}">${label}</button>`;
 const body=list.map(u=>{
  const status=u.deleted?'已刪除':!u.active?'已停用':!u.phone||!u.phone_confirmed?'待設定手機':'可登入';
  const phone=u.deleted?'—':u.active?`<button class="account-phone" data-account-action="phone" data-id="${esc(u.id)}" aria-label="修改 ${esc(u.display_name)} 的手機號碼">${esc(phoneDisplay(u.phone))}</button>`:esc(phoneDisplay(u.phone));
  const actions=u.deleted?'<span class="tag">已保留歷史紀錄</span>':u.active?button(u,'edit','編輯資料')+button(u,'password','重設密碼')+(!u.is_owner?button(u,'delete','刪除','danger'):''):button(u,'delete','重試刪除','danger');
  return `<tr><td>${esc(u.display_name)}${u.is_owner?'<span class="account-owner">管理員 · 自己</span>':''}</td><td data-label="角色">${esc(accountRoles[u.role]||u.role)}</td><td data-label="手機號碼">${phone}</td><td data-label="狀態"><span class="account-badge ${u.deleted?'deleted':status==='可登入'?'':'pending'}">${status}</span></td><td><div class="account-actions">${actions}</div></td></tr>`;
 }).join('');
 $('#account-list').innerHTML=list.length?`<div class="accounts-scroll"><table class="gridtable accounts-table"><thead><tr><th>姓名</th><th>角色</th><th>手機號碼</th><th>狀態</th><th>操作</th></tr></thead><tbody>${body}</tbody></table></div>`:'<p class="empty">沒有符合條件的帳號。</p>';
}
function accountPasswordField(id,label){return `<label for="${id}">${label}</label><div class="account-password"><input class="field" id="${id}" type="password" autocomplete="new-password" minlength="8" required><button class="btn" type="button" data-reveal="${id}" aria-label="顯示${label}" aria-pressed="false">顯示</button></div>`;}
const originalCloseAccountModal=closeModal;
closeModal=function(){if(accountBusy)return;originalCloseAccountModal();$('#modal-fields').replaceChildren();$('#modal-error').textContent='';accountReturnFocus?.focus();};
function openAccountEditor(action,id){
 if(!finance()||accountBusy)return;
 const user=accountUsers.find(u=>u.id===id);
 if(action!=='create'&&(!user||user.deleted))return;
 if(action==='delete'&&user.is_owner)return;
 accountReturnFocus=document.activeElement;
 const titles={create:'新增使用者',edit:'編輯帳號資料',phone:'修改手機號碼',password:'重設密碼',delete:'刪除帳號'};
 let fields=user?`<p class="account-dialog-description">${esc(user.display_name)} · ${esc(accountRoles[user.role])}${user.is_owner?'（自己的帳號）':''}</p>`:'';
 if(['create','edit'].includes(action))fields+=`<label for="account-name-input">姓名</label><input class="field" id="account-name-input" value="${esc(user?.display_name||'')}" maxlength="70" required autocomplete="off"><label for="account-role">角色</label><select class="field" id="account-role" ${user?.is_owner?'disabled':''}>${option('driver','司機',user?.role||'driver')}${option('dispatcher','主管',user?.role||'driver')}</select>${user?.is_owner?'<p class="account-field-note">管理員角色保留，不可變更。</p>':''}`;
 if(['create','phone'].includes(action))fields+=`<label for="account-phone-input">手機號碼</label><input class="field" id="account-phone-input" type="tel" inputmode="tel" autocomplete="off" placeholder="09xxxxxxxx" value="${esc(user?.phone?phoneDisplay(user.phone):'')}" required><p class="account-field-note">台灣手機填 09 開頭的 10 碼；其他國家請加國碼（+）。</p><label class="account-check"><input type="checkbox" id="account-phone-verified" required><span>已確認此手機號碼屬於使用者本人</span></label>`;
 if(['create','password'].includes(action))fields+=accountPasswordField('account-password','新密碼')+'<p class="account-field-note">至少 8 個字元。密碼不會顯示在帳號名單中。</p>'+accountPasswordField('account-password-confirm','確認新密碼');
 if(user?.is_owner&&['phone','password'].includes(action))fields+='<p class="account-field-note">儲存後會登出，請使用新的登入資料重新登入。</p>';
 if(action==='delete')fields+=`<p class="account-dialog-description">刪除後，${esc(user.display_name)} 將無法再登入。歷史出勤、配送與薪資報表會保留。此操作無法復原。</p><label for="account-delete-name">輸入「${esc(user.display_name)}」確認刪除</label><input class="field" id="account-delete-name" autocomplete="off" required>`;
 $('#modal-title').textContent=titles[action];$('#modal-fields').innerHTML=`<form id="account-form">${fields}</form>`;$('#modal-error').textContent='';
 const save=$('#modal-save');save.hidden=false;save.disabled=false;save.textContent=action==='create'?'建立帳號':action==='delete'?'確認刪除':action==='password'?'確認重設':'儲存變更';save.classList.toggle('danger',action==='delete');save.setAttribute('form','account-form');save.type='submit';save.onclick=null;
 $('#modal').classList.add('open');$('#modal-fields').querySelector('input,select')?.focus();
 $('#account-form').onclick=e=>{const b=e.target.closest('[data-reveal]');if(!b)return;const input=document.getElementById(b.dataset.reveal);const visible=input.type==='password';input.type=visible?'text':'password';b.textContent=visible?'隱藏':'顯示';b.setAttribute('aria-pressed',String(visible));b.setAttribute('aria-label',(visible?'隱藏':'顯示')+(b.dataset.reveal.endsWith('confirm')?'確認新密碼':'新密碼'));};
 $('#account-form').onsubmit=async e=>{
  e.preventDefault();if(accountBusy)return;$('#modal-error').textContent='';
  const payload={action,...(user?{user_id:user.id}:{})};
  if(['create','edit'].includes(action)){payload.name=$('#account-name-input').value.trim();payload.role=$('#account-role').value;if(!payload.name){$('#modal-error').textContent='請輸入姓名。';return;}}
  if(['create','phone'].includes(action)){payload.phone=accountPhone($('#account-phone-input').value);payload.phone_verified=$('#account-phone-verified').checked;if(!payload.phone||!payload.phone_verified){$('#modal-error').textContent='請填寫有效手機號碼，並確認號碼屬於本人。';return;}}
  if(['create','password'].includes(action)){
   payload.password=$('#account-password').value;
   if(payload.password!==$('#account-password-confirm').value){$('#modal-error').textContent='兩次輸入的密碼不一致。';return;}
   if(payload.password.length<8||new TextEncoder().encode(payload.password).length>72){$('#modal-error').textContent='新密碼至少 8 個字元，且不得超過 72 位元組。';return;}
  }
  if(action==='delete'){payload.confirm_name=$('#account-delete-name').value;if(payload.confirm_name!==user.display_name){$('#modal-error').textContent='請輸入完整姓名以確認刪除。';return;}}
  accountBusy=true;save.disabled=true;$('#modal-cancel').disabled=true;const oldText=save.textContent;save.textContent='處理中…';
  let result;
  try{result=await accountRequest(payload);}catch(error){$('#modal-error').textContent=error.message;}
  finally{delete payload.password;accountBusy=false;save.disabled=false;$('#modal-cancel').disabled=false;save.textContent=oldText;}
  if(!result)return;
  closeModal();notify(result.message);
  if(result.self_relogin){try{await db.auth.signOut({scope:'local'});}finally{location.replace('index.html?account=updated');}return;}
  try{await reloadAccounts();if(user?.id===accountActor&&action==='edit')$('#account-name').textContent=payload.name;}catch{notify(result.message+' 名單更新失敗，請按「重新整理」。');}
 };
}
document.addEventListener('keydown',e=>{
 if(!$('#modal').classList.contains('open'))return;
 if(e.key==='Escape'){e.preventDefault();closeModal();}
 if(e.key==='Tab'){
  const nodes=[...$('#modal').querySelectorAll('input:not([disabled]),select:not([disabled]),button:not([disabled])')];
  const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }
});
