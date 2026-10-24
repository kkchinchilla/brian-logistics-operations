/* Increment 1.3.1 — actual Supabase route catalogue. Demo is served by ui-routes.js instead.
 * Reads current route masters; stores regions, zones and tariffs in RLS-protected tables.
 * Client-side checks are UX only; database RLS is authoritative. */
(()=>{'use strict';
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=(typeof db!=='undefined'?db:window.db); // js/config.js uses a global lexical const db
let regions=[],zones=[],routes=[],tariffs=[],dutyRates=[],tab='routes',editing=null,rateEditing=null,entityEditing=null,search='',filterRegion='',filterZone='',timer=null,waiting=false;
const rt=id=>regions.find(v=>v.id===Number(id))?.name||'未設定';
const regionId=name=>regions.find(v=>v.name===name)?.id||null;
const isEdit=(p)=>p&&p.role==='dispatcher'&&p.active;
const finance=()=>typeof DashboardAccess146!=='undefined'&&DashboardAccess146.finance();
const money=v=>v==null?'待設定':'NT$ '+Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const nameKey=v=>String(v??'').normalize('NFKC').trim().replace(/\s+/g,' ');
const validName=v=>v.length>0&&v.length<=50;
const notice=t=>{$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(()=>$('toast').classList.remove('show'),3000)};
const errorText=e=>String(e?.message||e||'未知錯誤');
const dutyLabels={standby:'值班',follow_along:'跟車',learning:'學習'};
let myProfile=null;
function busy(on){waiting=on;document.querySelectorAll('#route-form button,#rate-form button,#entity-form button,#add-route,#toggle-active').forEach(x=>x.disabled=on)}
async function load(){
 const [r,z,t,c,d]=await Promise.all([
  client.from('delivery_regions').select('id,name').order('name'),
  client.from('delivery_temperature_zones').select('name').order('name'),
  finance()?client.from('delivery_region_zone_rates').select('region_id,zone_name,delivery_fee').order('region_id'):Promise.resolve({data:[],error:null}),
  client.from('routes').select('id,route_name,active,temperature_zone,delivery_region_id').order('route_name'),
  finance()?client.from('duty_assignment_rates').select('kind,amount,revision').order('kind'):Promise.resolve({data:[],error:null})
 ]);
 for(const res of [r,z,t,c,d])if(res.error)throw res.error;
 regions=r.data||[];zones=(z.data||[]).map(x=>x.name);tariffs=t.data||[];dutyRates=d.data||[];
 routes=(c.data||[]).map(x=>({...x,name:x.route_name||'未設定路線名稱',region:rt(x.delivery_region_id),zone:x.temperature_zone||''}));
 buildSelects();render();
}
const rate=(region,zone)=>tariffs.find(t=>t.region_id===regionId(region)&&t.zone_name===zone)?.delivery_fee??null;
function option(value,text){return `<option value="${esc(value)}">${esc(text)}</option>`}
function buildSelects(){
 const fr=$('filter-region'),fz=$('filter-zone'),rr=$('f-region'),rz=$('f-zone');
 fr.innerHTML=option('','全部地區')+regions.map(r=>option(r.name,r.name)).join('');
 fz.innerHTML=option('','全部溫層')+zones.map(z=>option(z,z)).join('');
 rr.innerHTML=option('','請選擇地區')+regions.map(r=>option(r.name,r.name)).join('');
 rz.innerHTML=option('','請選擇溫層')+zones.map(z=>option(z,z)).join('');
 fr.value=regions.some(r=>r.name===filterRegion)?filterRegion:'';
 fz.value=zones.includes(filterZone)?filterZone:'';
}
function render(){
 if(tab==='rates'&&!finance())tab='routes';
 const visible=routes.filter(r=>([r.name,r.region,r.zone].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()))&&(!filterRegion||filterRegion===r.region)&&(!filterZone||filterZone===r.zone));
 $('stat-routes').textContent=routes.filter(x=>x.active).length;
 $('stat-regions').textContent=regions.length;$('stat-zones').textContent=zones.length;
 const prices=routes.filter(x=>x.active).map(x=>rate(x.region,x.zone)).filter(x=>x!==null);
 $('stat-avg').textContent=prices.length?money(prices.reduce((a,b)=>a+Number(b),0)/prices.length):'—';
 $('routes-body').innerHTML=visible.map(r=>`<tr tabindex="0" role="button" data-id="${r.id}" aria-label="編輯 ${esc(r.name)}"><td>${esc(r.name)}${r.active?'':'<span class="route-code">已停用</span>'}</td><td><span class="region">${esc(r.region)}</span></td><td><span class="zone">${esc(r.zone||'未設定')}</span></td>${finance()?`<td class="cost">${money(rate(r.region,r.zone))}</td>`:''}<td class="row-arrow">›</td></tr>`).join('')||`<tr><td colspan="${finance()?5:4}" style="text-align:center;height:105px;position:static">目前沒有符合條件的路線</td></tr>`;
 $('result-count').textContent=`顯示 ${visible.length} / ${routes.length} 條路線`;
 $('rates-head').innerHTML=finance()?`<tr><th>配送地區</th>${zones.map(z=>`<th>${esc(z)}</th>`).join('')}</tr>`:'';
 $('rates-body').innerHTML=finance()?regions.map(r=>`<tr><td>${esc(r.name)}</td>${zones.map(z=>`<td><button data-rate-region="${r.id}" data-rate-zone="${esc(z)}" type="button">${rate(r.name,z)===null?'＋ 設定費率':money(rate(r.name,z))}</button></td>`).join('')}</tr>`).join(''):'';
 $('duty-rates-body').innerHTML=finance()?Object.entries(dutyLabels).map(([kind,label])=>{const r=dutyRates.find(x=>x.kind===kind);return `<tr><td>${label}</td><td><button type="button" data-duty-rate="${kind}" aria-label="設定${label}費率">${r?money(r.amount):'＋ 設定費率'}</button></td></tr>`}).join(''):'';
 $('rates-head').parentElement.style.minWidth=Math.max(510,137*(zones.length+1))+'px';
 for(const [kind,names,target] of [['region',regions.map(r=>r.name),'region-list'],['zone',zones,'zone-list']]){
  $(target).innerHTML=names.map(n=>{const used=routes.filter(r=>r[kind]===n).length;return `<div class="catalog-item"><span class="catalog-name">${esc(n)}</span><span class="catalog-meta">${used} 條路線</span><button class="catalog-control" data-kind="${kind}" data-name="${esc(n)}" data-action="rename" type="button">編輯</button><button class="catalog-control delete" data-kind="${kind}" data-name="${esc(n)}" data-action="remove" type="button">移除</button></div>`}).join('');
 }
 $('region-hint').textContent=`共 ${regions.length} 個地區`;$('zone-hint').textContent=`共 ${zones.length} 個溫層`;
 ['routes','rates','manage'].forEach(t=>{$('tab-'+t).classList.toggle('active',tab===t);$(t==='routes'?'route-view':t==='rates'?'rate-view':'manage-view').classList.toggle('hide',tab!==t)});
 $('section-title').textContent={routes:'路線列表',rates:'地區 × 溫層費率表',manage:'地區與溫層管理'}[tab];
 $('section-sub').textContent={routes:'查看並管理實際 Supabase 路線',rates:'修改地區與溫層的配送費用',manage:'新增、編輯與移除分類'}[tab];
}
function openLayer(id){$('overlay').classList.add('open');$(id).classList.add('open');$(id).setAttribute('aria-hidden','false')}
function dismiss(){editing=rateEditing=entityEditing=null;['drawer','rate-modal','entity-modal'].forEach(id=>{$(id).classList.remove('open');$(id).setAttribute('aria-hidden','true')});$('overlay').classList.remove('open')}
async function bindAndroidBack(){
 const cap=window.Capacitor;
 if(cap?.getPlatform?.()!=='android'||!cap.isPluginAvailable?.('App'))return;
 const app=cap.Plugins?.App||cap.registerPlugin('App');
 await app.addListener('backButton',({canGoBack})=>{
  // Do not leave a form while its save request is still in flight.
  if(waiting)return;
  // A category dialog can sit above an unsaved route. Preserve that draft.
  if($('entity-modal').classList.contains('open')){$('entity-cancel').click();return}
  if($('rate-modal').classList.contains('open')||$('drawer').classList.contains('open')){dismiss();return}
  if(canGoBack)window.history.back();
  else app.minimizeApp().catch(err=>console.warn('Android back navigation failed',err));
 });
}
function openRoute(id){const row=id===null?null:routes.find(r=>r.id===Number(id));if(id!==null&&!row)return;
 editing=row||'new';$('drawer-kicker').textContent=row?'編輯配送路線':'建立新路線';$('drawer-title').textContent=row?'編輯路線':'新增路線';
 $('f-name').value=row?row.route_name||row.name:'';
 $('f-region').value=row&&regions.some(r=>r.name===row.region)?row.region:'';
 $('f-zone').value=row&&zones.includes(row.zone)?row.zone:'';
 $('toggle-active').classList.toggle('hide',!row);$('toggle-active').textContent=row?.active?'停用此路線':'啟用此路線';
 $('save-form').textContent=row?'儲存變更':'建立路線';$('form-error').textContent='';openLayer('drawer');
}
async function submitRoute(e){e.preventDefault();if(waiting)return;
 const region=$('f-region').value,zone=$('f-zone').value,name=nameKey($('f-name').value);
 if(!name||name.length>60||!regionId(region)||!zone){$('form-error').textContent='請填寫 1–60 字的路線名稱、配送地區與溫層。';return}
 const payload={route_name:name,temperature_zone:zone,delivery_region_id:regionId(region)};
 busy(true);
 try{
  const r=editing==='new'?await client.from('routes').insert({...payload,active:true}):await client.from('routes').update(payload).eq('id',editing.id);
  if(r.error)throw r.error;dismiss();await load();notice('路線資料已儲存至 Supabase');
 }catch(err){$('form-error').textContent=`儲存失敗：${errorText(err)}`}finally{busy(false)}
}
function openRate(regionIdValue,zone){if(!finance())return;const region=regions.find(r=>r.id===Number(regionIdValue));if(!region)return;
 $('rate-modal-title').textContent='修改配送費率';$('rate-amount-label').textContent='路線費用／趟 (NT$)';
 rateEditing={region,zone};$('rate-modal-desc').textContent=`${region.name} × ${zone} 的每趟配送費率。`;
 $('rate-amount').value=rate(region.name,zone)??'';$('rate-error').textContent='';openLayer('rate-modal');}
function openDutyRate(kind){if(!finance()||!dutyLabels[kind])return;
 const r=dutyRates.find(x=>x.kind===kind);rateEditing={kind,revision:r?.revision??0};
 $('rate-modal-title').textContent='設定'+dutyLabels[kind]+'費率';$('rate-amount-label').textContent='勤務費用／筆 (NT$)';
 $('rate-modal-desc').textContent='所有司機共用，每筆已結案勤務計一次。修改目前費率也會更新過去月份的試算金額。';
 $('rate-amount').value=r?.amount??'';$('rate-error').textContent='';openLayer('rate-modal');
}
async function submitRate(e){e.preventDefault();if(!finance()||!rateEditing||waiting)return;const s=$('rate-amount').value.trim(),n=Number(s);
 if(!s||!Number.isFinite(n)||n<0||n>10000000||!/^\d+(?:\.\d{1,2})?$/.test(s)){$('rate-error').textContent='請輸入 0 至 10,000,000 的非負金額，最多兩位小數。';return}
 busy(true);try{const res=rateEditing.kind?await client.rpc('dashboard_save_assignment_rate',{p_kind:rateEditing.kind,p_amount:n,p_expected_revision:rateEditing.revision}):await client.from('delivery_region_zone_rates').upsert({region_id:rateEditing.region.id,zone_name:rateEditing.zone,delivery_fee:n},{onConflict:'region_id,zone_name'});if(res.error)throw res.error;dismiss();await load();notice('費率已儲存')}catch(err){$('rate-error').textContent=errorText(err)}finally{busy(false)} }
function openEntity(kind,old=null,origin='catalog'){entityEditing={kind,old,origin};$('entity-modal-title').textContent=(old?'編輯':'新增')+(kind==='region'?'配送地區':'配送溫層');$('entity-modal-desc').textContent=old?'修改分類名稱，既有路線將同步採用新名稱。':'新分類加入後，新組合費率需另行設定。';$('entity-name').value=old||'';$('entity-label').textContent=kind==='region'?'配送地區名稱':'配送溫層名稱';$('entity-error').textContent='';$('entity-submit').textContent=old?'儲存變更':'新增';openLayer('entity-modal')}
async function submitEntity(e){e.preventDefault();if(!entityEditing||waiting)return;
 const {kind,old,origin}=entityEditing,name=nameKey($('entity-name').value);
 // A category can be added from an unsaved route editor. Preserve its entire form.
 const routeDraft=origin==='route' && editing ? {
  id:editing==='new'?null:editing.id,
  name:$('f-name').value,
  region:$('f-region').value,zone:$('f-zone').value
 }:null;
 if(!validName(name)){$('entity-error').textContent='名稱應為 1–50 個字。';return}
 if((kind==='region'?regions.map(r=>r.name):zones).some(n=>n.toLocaleLowerCase()===name.toLocaleLowerCase()&&n!==old)){$('entity-error').textContent='已經有同名分類。';return}
 if(old===name){dismiss();return}
 busy(true);try{let res;
  if(kind==='region'){
   res=old?await client.from('delivery_regions').update({name}).eq('id',regionId(old)):await client.from('delivery_regions').insert({name});
  }else{
   res=old?await client.rpc('route_catalog_rename_zone',{p_old_name:old,p_new_name:name}):await client.from('delivery_temperature_zones').insert({name});
  }
  if(res.error)throw res.error;
  dismiss();await load();
  if(routeDraft){
    openRoute(routeDraft.id);
    $('f-name').value=routeDraft.name;
    $('f-region').value=(kind==='region' && (old===routeDraft.region||!old))?name:routeDraft.region;
    $('f-zone').value=(kind==='zone' && (old===routeDraft.zone||!old))?name:routeDraft.zone;
  }
  notice(old?'分類名稱已更新':'已新增分類');
 }catch(err){$('entity-error').textContent=errorText(err)}finally{busy(false)} }
async function removeEntity(kind,name){const used=routes.filter(r=>r[kind]===name).length;if(used){notice(`有 ${used} 條路線使用此分類，無法移除`);return}
 if(!confirm(`確定移除「${name}」？相關費率也會刪除。`))return;
 try{const res=kind==='region'?await client.from('delivery_regions').delete().eq('id',regionId(name)):await client.from('delivery_temperature_zones').delete().eq('name',name);
  if(res.error)throw res.error;await load();notice('分類已移除');
 }catch(err){notice(`移除失敗：${errorText(err)}`)} }
async function toggleActive(){if(!editing||editing==='new'||waiting)return;
 const row=editing;if(!confirm(`確定${row.active?'停用':'啟用'}路線 ${row.name}？`))return;
 busy(true);try{const res=await client.from('routes').update({active:!row.active}).eq('id',row.id);if(res.error)throw res.error;dismiss();await load();notice('路線狀態已更新')}catch(err){$('form-error').textContent=errorText(err)}finally{busy(false)} }
function bind(){
 function applyDevice(){const mobile=window.matchMedia('(max-width: 800px)').matches;
  $('stage').classList.toggle('mobile',mobile);$('stage').classList.toggle('desktop',!mobile);

 }
 applyDevice();window.addEventListener('resize',applyDevice,{passive:true});

 ['routes','rates','manage'].forEach(t=>$('tab-'+t).onclick=()=>{if(t==='rates'&&!finance())return;tab=t;render()});
 $('route-search').oninput=e=>{search=e.target.value.trim();render()};
 $('filter-region').onchange=e=>{filterRegion=e.target.value;render()};
 $('filter-zone').onchange=e=>{filterZone=e.target.value;render()};
 $('add-route').onclick=()=>openRoute(null);$('route-form').onsubmit=submitRoute;
 $('dismiss').onclick=dismiss;$('cancel-form').onclick=dismiss;$('overlay').onclick=dismiss;
 $('rates-body').onclick=e=>{const b=e.target.closest('button[data-rate-region]');if(b)openRate(b.dataset.rateRegion,b.dataset.rateZone)};
 $('duty-rates-body').onclick=e=>{const b=e.target.closest('button[data-duty-rate]');if(b)openDutyRate(b.dataset.dutyRate)};
 $('rate-cancel').onclick=dismiss;$('rate-form').onsubmit=submitRate;
 document.querySelectorAll('[data-create-kind]').forEach(b=>b.onclick=()=>openEntity(b.dataset.createKind,null,b.dataset.origin||'catalog'));
 ['region-list','zone-list'].forEach(id=>$(id).onclick=e=>{const b=e.target.closest('[data-action]');if(!b)return;b.dataset.action==='rename'?openEntity(b.dataset.kind,b.dataset.name):removeEntity(b.dataset.kind,b.dataset.name)});
 $('entity-cancel').onclick=()=>{$('entity-modal').classList.remove('open');$('entity-modal').setAttribute('aria-hidden','true');entityEditing=null;if(!$('drawer').classList.contains('open'))$('overlay').classList.remove('open')};
 $('entity-form').onsubmit=submitEntity;
 $('routes-body').onclick=e=>{const tr=e.target.closest('tr[data-id]');if(tr)openRoute(tr.dataset.id)};
 $('routes-body').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){const tr=e.target.closest('tr[data-id]');if(tr){e.preventDefault();openRoute(tr.dataset.id)}}};
 $('toggle-active').onclick=toggleActive;

 document.addEventListener('keydown',e=>{if(e.key==='Escape')dismiss()});
 bindAndroidBack().catch(err=>console.warn('Android back listener unavailable',err));
}
async function init(){
 if(!db)throw Error('找不到 Supabase 設定。請確認 js/config.js 已正確放置。');
 const result=await client.auth.getUser();if(result.error||!result.data?.user){location.href='index.html';return}
 const id=result.data.user.id,prof=await client.from('profiles').select('id,role,active,display_name').eq('id',id).single();
 if(!prof.error&&prof.data?.active)document.body.dataset.accountRole=prof.data.role;
 if(prof.error||!isEdit(prof.data)){document.querySelector('.workspace').innerHTML='<p class="table-note" role="alert">目前帳號沒有路線管理權限。請使用主管帳號登入。</p>';return}
 myProfile=prof.data;if(typeof DashboardAccess146!=='undefined')await DashboardAccess146.load();bind();await load();
 $('account-name').textContent=myProfile.display_name;
}
init().catch(e=>{console.error('routes live error',e);document.querySelector('#route-status').textContent=`無法載入路線資料：${errorText(e)}。請重新整理後再試，或聯絡管理員。`});
})();
