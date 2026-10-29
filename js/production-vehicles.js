let vehicles=[],drivers=[],bindings=[],fleetTab="vehicles";
async function loadPage(){if(!supervisor()){$('#page').innerHTML='<p class="empty">車輛綁定由主管管理。</p>';return}$('#head-actions').insertAdjacentHTML('afterbegin','<button class="btn primary" id="header-new-vehicle">＋ 新增車輛</button>');await reloadVehicles()}
async function reloadVehicles(){[vehicles,drivers,bindings]=await Promise.all([rows('vehicles','id,plate_number,label,active'),rows('profiles','id,display_name,role,active',q=>q.eq('role','driver')),rows('vehicle_owner_bindings','id,driver_id,vehicle_id,effective_from,effective_to,note')]);renderVehicles()}
const dName=id=>drivers.find(x=>x.id===id)?.display_name||'未綁定';
const vehicleName=id=>vehicles.find(x=>String(x.id)===String(id))?.plate_number||'—';
function selectFleetTab(next){globalThis.DashboardTabs?.record('dashboard',fleetTab,next,selectFleetTab);fleetTab=next;renderVehicles();return true}
function renderVehicles(){
 const active=bindings.filter(b=>b.effective_from<=today()&&(!b.effective_to||b.effective_to>=today()));
 const boundVehicleIds=new Set(active.map(b=>String(b.vehicle_id)));
 const ownDrivers=new Set(active.map(b=>b.driver_id));
 $('#stats').innerHTML=`<div class="kpi"><small>自有車司機</small><strong>${ownDrivers.size}</strong></div><div class="kpi"><small>已綁定車輛</small><strong>${boundVehicleIds.size}</strong></div><div class="kpi"><small>未綁定車輛</small><strong>${vehicles.filter(v=>v.active&&!boundVehicleIds.has(String(v.id))).length}</strong></div>`;
 $('#page').innerHTML=`<div class="subtabs"><button type="button" id="fleet-tab-vehicles" class="${fleetTab==='vehicles'?'on':''}">車輛與綁定</button><button type="button" id="fleet-tab-drivers" class="${fleetTab==='drivers'?'on':''}">司機名單</button></div><section class="panel fleet-section"><div class="panel-title" id="fleet-title">${fleetTab==='vehicles'?'車輛與綁定':'司機名單'}</div><div class="tools fleet-filter" style="padding:0 18px"><input class="field search" id="filter" placeholder="搜尋司機或車號"><button class="btn" id="new-binding" ${fleetTab==='vehicles'?'':'hidden'}>＋ 綁定司機</button><button class="btn" id="edit-driver" ${fleetTab==='drivers'?'':'hidden'}>編輯司機</button></div><div id="fleet-table" data-fleet-view="${fleetTab}"></div><div class="footer">${fleetTab==='vehicles'?'點選車號編輯車輛；綁定保留生效日期與歷史。':'查閱司機姓名及所屬車輛，可透過「編輯司機」修改顯示名稱。'}</div></section>`;
 $('#fleet-tab-vehicles').onclick=()=>selectFleetTab('vehicles');
 $('#fleet-tab-drivers').onclick=()=>selectFleetTab('drivers');
 $('#header-new-vehicle').onclick=()=>vehicleEditor();$('#new-binding').onclick=()=>bindingEditor();$('#edit-driver').onclick=()=>driverEditor();
 $('#filter').oninput=renderFleetTable;renderFleetTable();
}
function renderFleetTable(){
 const term=($('#filter')?.value||'').toLocaleLowerCase();
 if(fleetTab==='drivers'){
  const list=drivers.filter(d=>[d.display_name,...bindings.filter(b=>b.driver_id===d.id).map(b=>vehicleName(b.vehicle_id))].join(' ').toLocaleLowerCase().includes(term));
  const body=list.map(d=>{
   const current=bindings.filter(b=>b.driver_id===d.id&&b.effective_from<=today()&&(!b.effective_to||b.effective_to>=today()));
   const plates=current.map(b=>vehicleName(b.vehicle_id)).filter(Boolean).join('、');
   return `<tr><td class="sticky">${esc(d.display_name)}</td><td>${esc(plates||'')}</td><td>${current.length||''}</td></tr>`;
  }).join('');
  $('#fleet-table').innerHTML=wrapTable(['司機姓名','綁定車號','車輛數'],body);
  return;
 }
 const list=vehicles.filter(v=>[v.plate_number,v.label,...bindings.filter(b=>String(b.vehicle_id)===String(v.id)).map(b=>dName(b.driver_id))].join(' ').toLocaleLowerCase().includes(term));
 const body=list.map(v=>{
  const match=bindings.filter(b=>String(b.vehicle_id)===String(v.id)).sort((a,b)=>b.effective_from.localeCompare(a.effective_from));
  const cur=match.filter(b=>b.effective_from<=today()&&(!b.effective_to||b.effective_to>=today()));
  return `<tr><td class="sticky"><button class="rowlink" data-v="${v.id}">${esc(v.plate_number)}</button></td><td>${esc(v.label||'')}</td><td>${esc(cur.map(b=>dName(b.driver_id)).join('、'))}</td><td>${esc(cur.map(b=>b.effective_from).join('、'))}</td><td>${esc(cur.map(b=>b.effective_to||'持續有效').join('、'))}</td><td><span class="status-pill ${v.active?'ok':'off'}">${v.active?'使用中':'停用'}</span></td><td><button class="btn" data-b="${v.id}">管理綁定</button></td></tr>`;
 }).join('');
 $('#fleet-table').innerHTML=wrapTable(['車號','名稱','綁定司機','生效日期','到期日期','狀態','操作'],body);
 document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>vehicleEditor(vehicles.find(v=>v.id==b.dataset.v)));
 document.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>bindingHistory(Number(b.dataset.b)));
}

function vehicleEditor(v){modal(v?'編輯車輛':'新增車輛',field('車號','plate',v?.plate_number||'')+field('名稱／備註','vlabel',v?.label||'')+`<label>狀態</label><select class="field" id="vactive">${option('true','使用中',String(v?.active??true))}${option('false','停用',String(v?.active??true))}</select>`,async()=>{const plate=chosen('plate').trim();if(!plate)throw Error('請填寫車號');await save('vehicles',{plate_number:plate,label:chosen('vlabel'),active:chosen('vactive')==='true'},v?{id:v.id}:null);await reloadVehicles()})}
// Open existing binding history instead of silently creating a duplicate period.
function bindingHistory(vehicleId){
 const v=vehicles.find(x=>String(x.id)===String(vehicleId));if(!v)return;
 const history=bindings.filter(x=>String(x.vehicle_id)===String(vehicleId)).sort((a,b)=>b.effective_from.localeCompare(a.effective_from));
 const body=history.map(b=>`<tr><td>${esc(dName(b.driver_id))}</td><td>${esc(b.effective_from)}</td><td>${esc(b.effective_to||'持續有效')}</td><td>${esc(b.note||'')}</td><td><button type="button" class="rowlink" data-edit-binding="${b.id}">編輯／結束</button></td></tr>`).join('');
 modal('綁定歷史 · '+v.plate_number,`<p class="note">舊綁定保留歷史紀錄，不刪除已發生的期間。</p>${wrapTable(['司機','起始','截止','備註','操作'],body)}<div class="actions"><button class="btn primary" type="button" id="add-binding-here">＋ 新增綁定期間</button></div>`,async()=>{});
 $('#modal-save').hidden=true;
 $('#add-binding-here').onclick=()=>bindingEditor(vehicleId);
 document.querySelectorAll('[data-edit-binding]').forEach(btn=>btn.onclick=()=>bindingEditor(vehicleId,Number(btn.dataset.editBinding)));
}
function bindingEditor(vid=null,editId=null){
 const entry=editId?bindings.find(x=>x.id===editId):null;
 $('#modal-save').hidden=false;
 const vList=entry?vehicles.filter(v=>String(v.id)===String(entry.vehicle_id)):vehicles.filter(v=>v.active);
 const dList=entry?drivers.filter(d=>d.id===entry.driver_id):drivers.filter(d=>d.active);
 modal(entry?'編輯／結束車輛綁定':'設定自有車綁定',`<p class="note">同一台車可同時綁定多位司機，同一司機也可綁定多台車；同一組司機與車輛的生效期間不可重疊。結束日期包含當日。</p><label>車輛</label><select id="bvehicle" class="field">${dropdown(vList,'id','plate_number',entry?.vehicle_id??vid)}</select><label>司機</label><select id="bdriver" class="field">${dropdown(dList,'id','display_name',entry?.driver_id)}</select>${field('生效日期','bfrom',entry?.effective_from||today(),'date')}${field('結束日期（不填代表持續有效）','bto',entry?.effective_to||'','date')}${field('備註','bnote',entry?.note||'')}`,async()=>{
   const vehicle_id=Number(chosen('bvehicle')),driver_id=chosen('bdriver'),effective_from=chosen('bfrom'),effective_to=chosen('bto')||null;
   if(!Number.isInteger(vehicle_id)||!vehicle_id||!drivers.some(d=>d.id===driver_id))throw Error('請選擇車輛與司機');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(effective_from))throw Error('請填寫生效日期');
   if(effective_to&&effective_to<effective_from)throw Error('結束日期不得早於生效日期');
   // Same condition as DB guard; database remains the final arbiter during races.
   if(bindings.some(b=>b.id!==entry?.id&&String(b.vehicle_id)===String(vehicle_id)&&b.driver_id===driver_id&&b.effective_from<=(effective_to||'9999-12-31')&&(b.effective_to||'9999-12-31')>=effective_from))throw Error('這位司機與此車輛的綁定期間已存在重疊紀錄，請先結束原綁定。');
   await save('vehicle_owner_bindings',{vehicle_id,driver_id,effective_from,effective_to,note:chosen('bnote').trim()},entry?{id:entry.id}:null);
   await reloadVehicles();notify('車輛綁定已儲存');
 });
}

function driverEditor(driverId){modal('修改司機顯示名稱',`<label>司機</label><select class="field" id="ename">${dropdown(drivers,'id','display_name',driverId)}</select>${field('新顯示名稱','newname')}`,async()=>{if(!chosen('newname').trim())throw Error('請輸入姓名');const {error}=await db.rpc('dashboard_rename_driver',{p_driver:chosen('ename'),p_name:chosen('newname').trim()});if(error)throw error;await reloadVehicles()})}

