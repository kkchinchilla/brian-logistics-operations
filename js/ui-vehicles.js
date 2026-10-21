
(()=>{
 'use strict';
 const KEY='logistics_vehicle_mgmt_demo_v1';
 const defaultData=()=>({
  drivers:[{id:'d1',name:'林小美'},{id:'d2',name:'王小明'},{id:'d3',name:'陳小華'},{id:'d4',name:'楊子祥'},{id:'d5',name:'趙雅婷'},{id:'d6',name:'張柏翰'},{id:'d7',name:'吳佳穎'},{id:'d8',name:'劉志強'}],
  vehicles:[{id:'v1',plate:'KLC-728',driverId:'d1',note:''},{id:'v2',plate:'TDJ-662',driverId:'d2',note:''},{id:'v3',plate:'BMT-255',driverId:'d3',note:''},{id:'v4',plate:'BNE-401',driverId:'d4',note:''},{id:'v5',plate:'ALP-176',driverId:'d5',note:''},{id:'v6',plate:'RDX-221',driverId:'d6',note:''},{id:'v7',plate:'KPA-507',driverId:'d7',note:''},{id:'v8',plate:'BCG-228',driverId:'d8',note:''},{id:'v9',plate:'BXD-105',driverId:null,note:'備用車輛'},{id:'v10',plate:'TCD-337',driverId:null,note:''}],

 });
 let data; try{const saved=JSON.parse(localStorage.getItem(KEY));data=saved?.drivers&&saved?.vehicles?{drivers:saved.drivers,vehicles:saved.vehicles}:defaultData()}catch{data=defaultData()}
 const S={device:'desktop',tab:'vehicles',search:'',filter:'all',modal:null};
 const $=id=>document.getElementById(id);
 const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=p=>String(p??'').toUpperCase().replace(/[\s\-]/g,'');
 const fmtPlate=p=>String(p??'').trim().toUpperCase().replace(/\s+/g,'');
 const byDriver=id=>data.drivers.find(d=>d.id===id);
 const driverName=id=>byDriver(id)?.name||'—';
 const owned=id=>data.vehicles.filter(v=>v.driverId===id);
 // 每日出勤使用這項規則自動判定租車，不在車輛管理提供手動判定介面。
 // 僅對已登記的自有車司機、有實際車號的有效配送趟次判定。
 const classifyAttendanceTrip=(driverId,actualPlate)=>{
  if(!byDriver(driverId)||!norm(actualPlate))return null;
  return owned(driverId).some(v=>norm(v.plate)===norm(actualPlate))?'自有車':'租車';
 };
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){console.warn('Unable to save prototype',e)}};
 let toastHandle;
 function toast(m){$('toast').textContent=m;$('toast').classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>$('toast').classList.remove('show'),2200)}
 function renderStats(){$('driverCount').textContent=data.drivers.length;$('boundCount').textContent=data.vehicles.filter(v=>v.driverId).length;$('unboundCount').textContent=data.vehicles.filter(v=>!v.driverId).length}
 function render(){renderStats();document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===S.tab);b.setAttribute('aria-selected',String(b.dataset.tab===S.tab))});$('newBtnLabel').textContent=S.tab==='drivers'?'新增司機':'新增車輛';if(S.tab==='vehicles')renderVehicles();else renderDrivers()}
 const icoSearch='<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>';
 const editIcon='<svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4.5-1L20 7.5 16.5 4 5 15.5z"/></svg>';
 function renderVehicles(){
  $('panel').innerHTML=`<section class="section"><div class="section-head"><div><h2>自有車綁定清單</h2><p>車號與司機建立固定關係；可直接修改或解除綁定</p></div><div class="small-actions"><button class="textbutton" id="addVehicleInline">＋ 新增車輛</button></div></div><div class="toolbar"><label class="search">${icoSearch}<input id="listSearch" placeholder="搜尋車號、司機" value="${escapeHTML(S.search)}" autocomplete="off"></label><select class="select" id="listFilter" aria-label="綁定篩選"><option value="all">全部車輛</option><option value="bound">已綁定</option><option value="unbound">未綁定</option></select></div><div class="table-scroll"><table class="data-table" aria-label="車輛綁定列表"><thead><tr><th class="sticky-first">車號</th><th>綁定司機</th><th>備註</th><th style="width:70px;text-align:right">編輯</th></tr></thead><tbody id="rows"></tbody></table></div><div class="table-foot"><span id="listTotal"></span><span>點選車輛可編輯</span></div></section><p class="helper">同一位司機可以綁定多台自有車，每台車同時只能綁定一位司機。每日出勤的租車趟數由系統依實際車號自動計算，無須在此操作。</p>`;
  $('listFilter').value=S.filter;$('listSearch').addEventListener('input',e=>{S.search=e.target.value;renderVehicleRows()});$('listFilter').addEventListener('change',e=>{S.filter=e.target.value;renderVehicleRows()});$('addVehicleInline').onclick=()=>openDrawer('vehicle',null);renderVehicleRows();
 }
 function renderVehicleRows(){
  const term=S.search.trim().toLowerCase();let list=data.vehicles.filter(v=>(!term||(v.plate+' '+driverName(v.driverId)+' '+v.note).toLowerCase().includes(term))&&(S.filter==='all'||(S.filter==='bound'?!!v.driverId:!v.driverId)));
  $('rows').innerHTML=list.map(v=>`<tr class="clickable" data-vehicle="${escapeHTML(v.id)}" tabindex="0" role="button" aria-label="編輯車輛 ${escapeHTML(v.plate)}"><td class="sticky-first"><span class="plate">${escapeHTML(v.plate)}</span></td><td>${v.driverId?escapeHTML(driverName(v.driverId)):'<span class="muted">—</span>'}</td><td class="soft">${v.note?escapeHTML(v.note):'<span class="muted">—</span>'}</td><td style="text-align:right"><button type="button" class="row-link" tabindex="-1" aria-label="編輯">${editIcon}</button></td></tr>`).join('')||'<tr><td class="empty" colspan="4">沒有符合條件的車輛</td></tr>';
  $('listTotal').textContent=`共 ${list.length} 輛車`;
  $('rows').querySelectorAll('[data-vehicle]').forEach(tr=>{tr.onclick=()=>openDrawer('vehicle',tr.dataset.vehicle);tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDrawer('vehicle',tr.dataset.vehicle)}}});
 }
 function renderDrivers(){
  $('panel').innerHTML=`<section class="section"><div class="section-head"><div><h2>自有車司機名單</h2><p>編輯司機姓名、查看與新增車輛綁定</p></div><button class="textbutton" id="addDriverInline">＋ 新增司機</button></div><div class="toolbar"><label class="search">${icoSearch}<input id="driverSearch" placeholder="搜尋司機、綁定車號" value="${escapeHTML(S.search)}"></label></div><div class="table-scroll"><table class="data-table" aria-label="自有車司機列表"><thead><tr><th class="sticky-first">司機姓名</th><th>綁定車輛</th><th>車輛數</th><th style="width:70px;text-align:right">編輯</th></tr></thead><tbody id="driverRows"></tbody></table></div><div class="table-foot"><span id="driverTotal"></span><span>點選司機可編輯</span></div></section><p class="helper">司機與車輛分開管理；綁定變更後，正式系統須依生效日期保留歷史，避免影響過往月度租車統計。</p>`;
  $('driverSearch').addEventListener('input',e=>{S.search=e.target.value;renderDriverRows()});$('addDriverInline').onclick=()=>openDrawer('driver',null);renderDriverRows();
 }
 function renderDriverRows(){
  const term=S.search.trim().toLowerCase();const list=data.drivers.filter(d=>(d.name+' '+owned(d.id).map(v=>v.plate).join(' ')).toLowerCase().includes(term));
  $('driverRows').innerHTML=list.map(d=>`<tr data-driver="${escapeHTML(d.id)}" class="clickable" role="button" tabindex="0" aria-label="編輯司機 ${escapeHTML(d.name)}"><td class="sticky-first">${escapeHTML(d.name)}</td><td><div class="plate-pills">${owned(d.id).length?owned(d.id).map(v=>`<span class="pill">${escapeHTML(v.plate)}</span>`).join(''):'<span class="muted">—</span>'}</div></td><td><span class="count">${owned(d.id).length}</span></td><td style="text-align:right"><button class="row-link" tabindex="-1" aria-label="編輯">${editIcon}</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty">沒有符合條件的司機</td></tr>';
  $('driverTotal').textContent=`共 ${list.length} 位司機`;
  $('driverRows').querySelectorAll('[data-driver]').forEach(tr=>{tr.onclick=()=>openDrawer('driver',tr.dataset.driver);tr.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDrawer('driver',tr.dataset.driver)}}});
 }
 function openDrawer(type,id){S.modal={type,id};$('drawerError').textContent='';
  if(type==='vehicle'){
   const v=data.vehicles.find(x=>x.id===id);$('drawerTitle').textContent=id?'編輯車輛':'新增車輛';$('drawerSub').textContent=id?'更新車號、綁定司機或備註':'新增車號後，可立即指定自有車司機';
   $('drawerBody').innerHTML=`<div class="form-field"><label for="formPlate">車號</label><input id="formPlate" value="${escapeHTML(v?.plate||'')}" placeholder="例如 KLC-728" maxlength="30" autocomplete="off"></div><div class="form-field"><label for="formOwner">綁定司機</label><select id="formOwner"><option value="">未指定</option>${data.drivers.map(d=>`<option value="${escapeHTML(d.id)}" ${v?.driverId===d.id?'selected':''}>${escapeHTML(d.name)}</option>`).join('')}</select><p class="form-tip">可以把車輛改綁至其他司機；每輛車同時只會有一位綁定司機。</p></div><div class="form-field"><label for="formNote">備註（選填）</label><input id="formNote" value="${escapeHTML(v?.note||'')}" placeholder="例如 備用車輛" maxlength="100"></div><div class="inline-note">每日出勤將依實際使用車號和配送當日的有效綁定，自動計算租車趟次。</div>`;
  }else{
   const d=data.drivers.find(x=>x.id===id);$('drawerTitle').textContent=id?'編輯司機':'新增司機';$('drawerSub').textContent=id?'修改司機資料或新增車輛綁定':'登錄新的自有車司機';const bound=id?owned(id):[];const unbound=data.vehicles.filter(v=>!v.driverId);
   $('drawerBody').innerHTML=`<div class="form-field"><label for="formName">司機姓名</label><input id="formName" value="${escapeHTML(d?.name||'')}" placeholder="輸入司機姓名" maxlength="40"></div><div class="form-field"><label>目前綁定車輛</label><div class="plate-pills">${bound.length?bound.map(v=>`<span class="pill">${escapeHTML(v.plate)}</span>`).join(''):'<span class="muted">尚未綁定車輛</span>'}</div></div><div class="form-field"><label for="formAssign">再綁定一台未指定的車輛（選填）</label><select id="formAssign"><option value="">暫不新增</option>${unbound.map(v=>`<option value="${escapeHTML(v.id)}">${escapeHTML(v.plate)}</option>`).join('')}</select><p class="form-tip">若要解除綁定或將已綁定車輛轉給別人，請到「車輛與綁定」編輯該車。</p></div>`;
  }
  $('overlay').classList.add('open');$('drawer').classList.add('open');setTimeout(()=>$(type==='vehicle'?'formPlate':'formName')?.focus(),30);
 }
 function closeDrawer(){S.modal=null;$('overlay').classList.remove('open');$('drawer').classList.remove('open')}
 function saveDrawer(){if(!S.modal)return;const {type,id}=S.modal;$('drawerError').textContent='';
  if(type==='vehicle'){
   const plate=fmtPlate($('formPlate').value),driverId=$('formOwner').value||null,note=$('formNote').value.trim();if(!plate){$('drawerError').textContent='請填寫車號。';return}if(data.vehicles.some(v=>v.id!==id&&norm(v.plate)===norm(plate))){$('drawerError').textContent='此車號已存在，請確認是否重複登錄。';return}
   if(id){const v=data.vehicles.find(v=>v.id===id);v.plate=plate;v.driverId=driverId;v.note=note}else data.vehicles.push({id:'v'+Date.now().toString(36),plate,driverId,note});
  }else{
   const name=$('formName').value.trim(),extra=$('formAssign').value;if(!name){$('drawerError').textContent='請填寫司機姓名。';return}if(data.drivers.some(d=>d.id!==id&&d.name===name)){$('drawerError').textContent='已有同名司機，請確認資料。';return}
   const did=id||'d'+Date.now().toString(36);if(id)data.drivers.find(d=>d.id===id).name=name;else data.drivers.push({id:did,name});if(extra){const v=data.vehicles.find(v=>v.id===extra);if(v&&!v.driverId)v.driverId=did}
  }
  persist();closeDrawer();render();toast('已儲存變更');
 }
 $('newBtn').onclick=()=>openDrawer(S.tab==='drivers'?'driver':'vehicle',null);$('drawerClose').onclick=closeDrawer;$('drawerCancel').onclick=closeDrawer;$('overlay').onclick=closeDrawer;$('drawerSave').onclick=saveDrawer;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.modal)closeDrawer()});
 document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{S.tab=btn.dataset.tab;S.search='';S.filter='all';render()}));
 document.querySelectorAll('[data-device]').forEach(btn=>btn.addEventListener('click',()=>{S.device=btn.dataset.device;$('stage').classList.toggle('mobile',S.device==='mobile');$('stage').classList.toggle('desktop',S.device==='desktop');document.querySelectorAll('[data-device]').forEach(b=>b.classList.toggle('active',b.dataset.device===S.device));closeDrawer()}));
 $('resetBtn').onclick=()=>{if(!confirm('將車輛與司機資料還原為初始示範資料？'))return;data=defaultData();persist();S.search='';S.filter='all';closeDrawer();render();toast('已還原示範資料')};
 render();
})();
