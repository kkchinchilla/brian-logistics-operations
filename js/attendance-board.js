/* Increment 1.2 — Phase 1 attendance UI.
 * Real mode: read-only Supabase run projection. No attendance writes or approvals.
 * ?demo=1: explicitly synthetic roster + local (in-memory) interaction only.
 * IMPORTANT: Public full-roster access, slot mappings, and writes need new RLS/schema in later phases.
 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo') === '1';
  // Excel-style delivery groups are presentation columns, NOT the route temperature_zone.
  // Their default counts come from the original attendance template, but they can grow.
  const GROUPS = [
    {name:'日配',prefix:'日',initial:2},
    {name:'OC',prefix:'OC',initial:3},
    {name:'鮮二',prefix:'鮮二',initial:3},
    {name:'冷凍',prefix:'冷凍',initial:4},
    {name:'低鮮',prefix:'低鮮',initial:4}
  ];
  const MAX_PREVIEW_SLOTS = 50; // Browser performance guard, not a real-world trip quota.
  const defaultCounts = () => Object.fromEntries(GROUPS.map(g=>[g.name,g.initial]));
  const groupsFromCounts = (counts) => GROUPS.filter(g=>counts[g.name]>0)
    .map(g=>[g.name,Array.from({length:counts[g.name]},(_,i)=>`${g.prefix}${i+1}`)]);
  const sampleDrivers = [
    ['a','林小美'],['b','王小明'],['c','陳小華'],['d','楊子祥'],
    ['e','趙雅婷'],['f','張柏翰'],['g','吳佳穎'],['h','劉志強'],
    ['i','黃俊豪'],['j','鄭宜靜'],['k','高建民'],['l','許雅雯']
  ];
  const sampleAssignments = {
    a:{日1:['01','1001'],日2:['02','1001']},
    b:{OC1:['EB','1003'],OC2:['HB','1003']},
    c:{鮮二1:['RC','6203'],鮮二2:['TC','6203']},
    d:{冷凍1:['RG','0115'],冷凍2:['爆量','0115']},
    e:{低鮮1:['AT','1277']},g:{日1:['03','1608']},
    h:{OC3:['ES','1007']},i:{鮮二3:['WS','2118']},
    j:{冷凍4:['CT','1199']},k:{低鮮3:['LF','2281']},l:{日2:['04','2190']}
  };
  const model = {
    date: demo ? '2026-10-15' : localDate(),
    role: demo ? 'driver' : null,
    userId: demo ? 'a' : null,
    drivers: [], assignments: {}, changed: {}, closed: {}, notes: {},
    extras: [], sourceError: '', search: '', modal: null, loading: false,
    dateCounts: {}, detectedCounts: {}, currentGroups: []
  };
  let toastTimer = null;
  function localDate() {
    const d = new Date();
    const p = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }
  function safe(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function pairKey(driverId, slot) { return `${model.date}|${driverId}|${slot}`; }
  function slotValue(id, slot) {
    const edited = model.changed[pairKey(id,slot)];
    return edited || model.assignments[id]?.[slot] || ['', ''];
  }
  function isChanged(id,slot) { return Object.hasOwn(model.changed,pairKey(id,slot)); }
  function isClosed() {return model.closed[model.date] === true;}
  function canEdit(id) {
    // Phase 1 may ONLY simulate edits; no query is ever sent to update production.
    return !isClosed() && (model.role === 'dispatcher' || id === model.userId);
  }
  function fullDate(date) {
    const [y,m,d]=date.split('-').map(Number);
    const weekday='日一二三四五六'[new Date(y,m-1,d,12).getDay()];
    return `${y}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')} · 星期${weekday}`;
  }
  function normalizeSlot(code) {
    const key=String(code||'').trim().replace(/[-_\s]/g,'').toUpperCase();
    for(const group of GROUPS){
      const prefix=group.prefix.toUpperCase();
      if(!key.startsWith(prefix))continue;
      const digits=key.slice(prefix.length);
      if(!/^[1-9]\d*$/.test(digits))continue;
      const index=Number(digits);
      if(!Number.isSafeInteger(index)||index>MAX_PREVIEW_SLOTS)continue;
      return `${group.prefix}${index}`;
    }
    return null;
  }
  function categoryOf(slot){
    for(const group of GROUPS){
      const prefix=group.prefix;
      if(slot.startsWith(prefix) && /^[1-9]\d*$/.test(slot.slice(prefix.length)))
        return {name:group.name,index:Number(slot.slice(prefix.length))};
    }
    return null;
  }
  function currentCounts(){
    const requested=model.dateCounts[model.date]||defaultCounts();
    const detected=model.detectedCounts||{};
    return Object.fromEntries(GROUPS.map(g=>[g.name,Math.max(requested[g.name]??g.initial,detected[g.name]||0)]));
  }
  function slotsInUse(){
    const used=new Set();
    for(const rows of Object.values(model.assignments||{}))
      for(const [slot,pair] of Object.entries(rows))if(pair?.some(v=>String(v||'').trim()))used.add(slot);
    for(const [key,pair] of Object.entries(model.changed)){
      if(!key.startsWith(`${model.date}|`))continue;
      const slot=key.substring(key.lastIndexOf('|')+1);
      if(pair?.some(v=>String(v||'').trim()))used.add(slot);
    }
    return used;
  }
  function renderHeader() {
    const allGroups=groupsFromCounts(currentCounts());
    const extraCount=model.extraSlotCount||0;
    if(extraCount)allGroups.push(['其他路線',Array.from({length:extraCount},(_,i)=>`其他${i+1}`)]);
    model.currentGroups=allGroups;
    let html='<tr><th class="first-col" rowspan="2" scope="col">司機</th><th class="leave-head" rowspan="2" scope="col">休假</th>';
    allGroups.forEach(([name,slots])=> { html+=`<th colspan="${slots.length*2}" scope="colgroup">${safe(name)}</th>`; });
    html+='</tr><tr>';
    allGroups.forEach(([,slots])=>slots.forEach((slot,i)=> {html+=`<th class="${i===0?'group-edge':''}" scope="col">${safe(slot)}</th><th scope="col">車號</th>`;}));
    html+='</tr>';
    $('grid-head').innerHTML=html;
    return allGroups.flatMap(g=>g[1]);
  }
  function renderBody(slots) {
    const matched=model.drivers.filter((d)=>{
      if(!model.search)return true;
      const term=model.search.toLocaleLowerCase();
      return d.name.toLocaleLowerCase().includes(term)||slots.some(slot=>
        slot.toLocaleLowerCase().includes(term)||slotValue(d.id,slot).some(x=>String(x||'').toLocaleLowerCase().includes(term)));
    });
    const html=matched.map((driver)=>{
      const own=driver.id===model.userId;
      let tr=`<tr class="${own?'own-row':''}"><th class="person" scope="row">${safe(driver.name)}</th><td class="leave-cell">${safe(driver.leave||'')}</td>`;
      slots.forEach((slot,i)=>{
        const values=slotValue(driver.id,slot), edited=isChanged(driver.id,slot);
        values.forEach((value,index)=>{
          const base=(model.assignments[driver.id]?.[slot]||['',''])[index];
          const fieldChanged=edited && String(value||'')!==String(base||'');
          const cls=`cell ${value?'value':'empty'} ${fieldChanged?'edited':''}`;
          const entry=value? safe(value) : '&nbsp;';
          tr+=`<td class="${(index===0&&isGroupStart(slot))?'group-edge':''}">`;
          if(canEdit(driver.id)) {
            tr+=`<button type="button" class="${cls}" data-edit-driver="${safe(driver.id)}" data-edit-slot="${safe(slot)}" aria-label="編輯 ${safe(driver.name)} ${safe(slot)}">${entry}</button>`;
          } else tr+=`<span class="${cls}">${entry}</span>`;
          tr+='</td>';
        });
      });
      return tr+'</tr>';
    }).join('');
    $('grid-body').innerHTML=html||`<tr><td colspan="${2+slots.length*2}" style="height:100px;color:#b2b2b2">${model.loading?'載入中…':'沒有符合條件的紀錄'}</td></tr>`;
    $('table-count').textContent=`共 ${matched.length} 位司機`;
    $('scroll-hint').textContent='左右滑動查看更多欄位 →';
  }
  function isGroupStart(slot){return model.currentGroups.some((group)=>group[1][0]===slot);}
  function renderExtras() {
    const el=$('extras');
    if(!model.extras.length){el.hidden=true;el.replaceChildren();return;}
    el.hidden=false;
    const details=document.createElement('details');
    const summary=document.createElement('summary');
    summary.textContent=`未列入表格的紀錄（${model.extras.length}）`;
    const list=document.createElement('ul');
    model.extras.forEach(r=>{
      const li=document.createElement('li');li.textContent=r;
      list.appendChild(li);
    });
    details.append(summary,list);el.replaceChildren(details);
  }
  function render() {
    $('attendance-date').value=model.date;
    $('readable-date').textContent=fullDate(model.date);
    $('day-close').hidden=!(demo&&model.role==='dispatcher');
    $('day-close').textContent=isClosed()?'重新開啟':'結案';
    $('prototype-roles').hidden=!demo;
    $('slot-settings').hidden=isClosed()||model.role!=='dispatcher';
    document.querySelectorAll('[data-demo-role]').forEach(el=>el.classList.toggle('active',el.dataset.demoRole===model.role));
    $('source-note').textContent=demo
      ? '介面示範：變更僅保留在此頁面，不會寫入 Supabase。'
      : (model.sourceError||'第一階段為原定派車的唯讀呈現；編輯僅作本地預覽，尚未寫入實際出勤。');
    renderBody(renderHeader());
    renderExtras();
  }
  function showToast(text){
    const el=$('toast');el.textContent=text;el.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2600);
  }
  function showModal(id){
    model.modal=id;
    $('modal-backdrop').hidden=false;
    $(id).hidden=false;
    const first=$(id).querySelector('input,textarea,button');
    if(first)first.focus();
  }
  function dismissModal(){
    for(const id of ['edit-modal','close-modal','slot-modal'])$(id).hidden=true;
    $('modal-backdrop').hidden=true;
    model.modal=null;
  }
  function beginEdit(id,slot){
    if(!canEdit(id))return;
    model.currentCell={id,slot};
    const driver=model.drivers.find(d=>d.id===id);
    const current=slotValue(id,slot);
    const source=model.assignments[id]?.[slot]||['',''];
    $('edit-title').textContent=`${driver?.name||''} · ${slot}`;
    $('edit-detail').textContent='調整本格的路線與車輛。此階段為本地預覽，不會送出變更。';
    $('edit-route').value=current[0];$('edit-vehicle').value=current[1];
    $('original-value').textContent=`原定：${source.filter(Boolean).join(' / ')||'未安排'}`;
    $('edit-error').textContent='';
    showModal('edit-modal');
  }
  function savePreview(e){
    e.preventDefault();
    if(!model.currentCell)return;
    const route=$('edit-route').value.trim(),vehicle=$('edit-vehicle').value.trim();
    if(Boolean(route)!==Boolean(vehicle)){
      $('edit-error').textContent='請同時填寫路線和車號，或全部清空。';return;
    }
    const {id,slot}=model.currentCell;
    if(!canEdit(id)){dismissModal();showToast('此日已鎖定或無編輯權限');return;}
    const original=model.assignments[id]?.[slot]||['',''];
    const key=pairKey(id,slot);
    if(original[0]===route&&original[1]===vehicle)delete model.changed[key];
    else model.changed[key]=[route,vehicle];
    dismissModal();render();showToast('已更新畫面預覽（未儲存至資料庫）');
  }
  function openSlotSettings(){
    if(model.role!=='dispatcher'||isClosed())return;
    renderSlotSettings();
    showModal('slot-modal');
  }
  function renderSlotSettings(){
    const counts=currentCounts();
    const list=$('slot-list');
    list.innerHTML=GROUPS.map(group=>`<div class="slot-row" data-group="${safe(group.name)}">
      <span class="slot-label">${safe(group.name)}</span>
      <div class="slot-counter">
        <button type="button" data-slot-step="-1" data-group="${safe(group.name)}" aria-label="減少${safe(group.name)}趟次" ${counts[group.name]===0?'disabled':''}>−</button>
        <output aria-label="${safe(group.name)}趟數">${counts[group.name]}</output>
        <button type="button" data-slot-step="1" data-group="${safe(group.name)}" aria-label="增加${safe(group.name)}趟次" ${counts[group.name]>=MAX_PREVIEW_SLOTS?'disabled':''}>＋</button>
      </div>
    </div>`).join('');
  }
  function stepSlotCount(groupName,step){
    if(model.role!=='dispatcher'||isClosed())return;
    const group=GROUPS.find(g=>g.name===groupName);if(!group)return;
    const counts={...currentCounts()};
    const previous=counts[groupName],next=previous+step;
    if(next<0||next>MAX_PREVIEW_SLOTS)return;
    if(next<previous){
      const removed=`${group.prefix}${previous}`;
      if(slotsInUse().has(removed)){
        $('slot-error').textContent=`${removed} 已有配送資料，無法移除欄位。請先調整或清除該欄的紀錄。`;
        return;
      }
      // A loaded route with this slot remains visible even if the UI count changes.
      // Editing the board must never silently conceal the corresponding operation.
      if((model.detectedCounts[groupName]||0)>next){
        $('slot-error').textContent=`目前派車資料已使用 ${removed}，不可減少至 ${next} 趟。`;
        return;
      }
    }
    model.dateCounts[model.date]=counts;
    model.dateCounts[model.date][groupName]=next;
    $('slot-error').textContent='';
    render();renderSlotSettings();
  }
  function startClose(){
    if(!demo||model.role!=='dispatcher')return;
    $('close-title').textContent=isClosed()?'重新開啟出勤':'確認當日出勤';
    $('close-detail').textContent=isClosed()?'示範重新開啟，請輸入原因。':'結案後表格將暫時鎖定，僅此頁面有效。';
    $('close-note').value='';$('close-note').placeholder=isClosed()?'重新開啟原因（必填）':'主管備註（選填）';
    $('close-save').textContent=isClosed()?'重新開啟':'確認結案';
    $('close-error').textContent='';showModal('close-modal');
  }
  function completeClose(){
    if(!demo||model.role!=='dispatcher')return;
    const closed=isClosed(),note=$('close-note').value.trim();
    if(closed&&!note){$('close-error').textContent='請輸入重新開啟原因。';return;}
    model.closed[model.date]=!closed;
    model.notes[model.date]=note;
    dismissModal();render();showToast(closed?'已重新開啟（示範）':'已結案（示範）');
  }
  function moveDate(delta){
    const [y,m,d]=model.date.split('-').map(Number);
    const result=new Date(y,m-1,d+delta,12);
    const p=n=>String(n).padStart(2,'0');
    changeDate(`${result.getFullYear()}-${p(result.getMonth()+1)}-${p(result.getDate())}`);
  }
  async function changeDate(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
    model.date=value;
    dismissModal();
    if(demo){loadSample();render();return;}
    await loadLive();
  }
  function loadSample(){
    model.drivers=sampleDrivers.map(([id,name])=>({id,name,leave:id==='f'?'休':''}));
    model.userId='a';
    model.assignments=model.date==='2026-10-15'?structuredClone(sampleAssignments):{};
    model.extraSlotCount=0;model.extras=[];model.detectedCounts={};model.sourceError='';
  }
  async function auth(){
    if(typeof db==='undefined')throw new Error('Supabase 尚未設定，請檢查 js/config.js。');
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user){location.replace('index.html');return false;}
    const {data:profile,error:profileError}=await db.from('profiles')
      .select('id,display_name,role,active').eq('id',user.id).single();
    if(profileError||!profile||!profile.active||!['driver','dispatcher'].includes(profile.role)){
      location.replace('index.html');return false;
    }
    model.role=profile.role;model.userId=user.id;model.profile=profile;
    const page=profile.role==='dispatcher'?'dispatcher.html':'driver.html';
    $('back-nav').href=page;$('mobile-back').href=page;
    $('routes-nav').hidden=profile.role!=='dispatcher';
    return true;
  }
  async function getAllRows(table,select,configure){
    const result=[],pageSize=500;
    for(let i=0;i<30;i++){
      let request=db.from(table).select(select).range(i*pageSize,(i+1)*pageSize-1);
      request=configure(request);
      const {data,error}=await request;
      if(error)throw error;
      result.push(...(data||[]));
      if(!data||data.length<pageSize)return result;
    }
    throw new Error('資料超過 15,000 筆，請聯絡開發人員調整讀取方式。');
  }
  function mapActualRows(drivers,runs){
    const byId=new Map();
    for(const p of drivers){if(p?.id)byId.set(p.id,{id:p.id,name:p.display_name||'未命名司機',leave:''});}
    const grouped=new Map();
    const extras=[];
    runs.forEach(run=>{
      if(!run.driver_id){extras.push(`趟次 #${run.id}：未設定司機`);return;}
      if(!byId.has(run.driver_id))byId.set(run.driver_id,{id:run.driver_id,name:run.profiles?.display_name||'未命名司機',leave:''});
      if(!grouped.has(run.driver_id))grouped.set(run.driver_id,[]);
      grouped.get(run.driver_id).push(run);
    });
    const results={};let extraCount=0;const detectedCounts={};
    const isCancelled=(r)=>r.status==='cancelled';
    for(const [id,items] of grouped){
      results[id]={};let n=0;
      const sorted=items.slice().sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||'')||String(a.id).localeCompare(String(b.id)));
      for(const run of sorted){
        const route=String(run.route_code_snapshot||run.routes?.route_code||'').trim();
        const vehicle=String(run.vehicles?.plate_number||'').trim();
        if(isCancelled(run)){extras.push(`${byId.get(id)?.name||''} · 已取消趟次 #${run.id} · ${route||'未設定路線'}`);continue;}
        if(!route||!vehicle){extras.push(`${byId.get(id)?.name||''} · 資料不完整 #${run.id}（${route||'無路線'} / ${vehicle||'無車輛'}）`);continue;}
        // Strict matching of spreadsheet column codes only; never infer a group from temperature_zone.
        const candidate=normalizeSlot(route);
        if(candidate){const group=categoryOf(candidate);detectedCounts[group.name]=Math.max(detectedCounts[group.name]||0,group.index);}
        let slot=candidate && !results[id][candidate]?candidate:null;
        if(!slot){slot=`其他${++n}`;extraCount=Math.max(extraCount,n);}
        results[id][slot]=[route,vehicle];
      }
    }
    const ordered=[...byId.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-TW'));
    return {drivers:ordered,assignments:results,extraSlotCount:extraCount,extras,detectedCounts};
  }
  async function loadLive(){
    model.loading=true;model.sourceError='正在讀取派車資料…';render();
    try{
      const [rosterResult,runResult]=await Promise.allSettled([
        getAllRows('profiles','id,display_name,role,active',q=>q.eq('role','driver').eq('active',true).order('display_name')),
        getAllRows('runs','id,service_date,scheduled_time,driver_id,route_code_snapshot,status,profiles(display_name),vehicles(plate_number),routes(route_code,route_name)',q=>q.eq('service_date',model.date).order('scheduled_time',{ascending:true}))
      ]);
      if(runResult.status==='rejected')throw runResult.reason;
      const runs=runResult.value;
      const roster=rosterResult.status==='fulfilled'?rosterResult.value:[];
      const mapped=mapActualRows(roster,runs);
      model.drivers=mapped.drivers;model.assignments=mapped.assignments;
      model.extraSlotCount=mapped.extraSlotCount;model.extras=mapped.extras;model.detectedCounts=mapped.detectedCounts;
      if(!model.drivers.some(d=>d.id===model.userId))model.drivers.unshift({id:model.userId,name:model.profile.display_name,leave:''});
      let msg='';
      if(rosterResult.status==='rejected')msg='無法讀取完整司機名冊。';
      else if(model.role==='driver')msg='司機端目前依既有資料庫權限顯示可讀紀錄；全員共享須於後續 RLS 更新後啟用。';
      if(model.extraSlotCount)msg+=(msg?' ':'')+'無法對應既有 Excel 欄位的路線，暫列於「其他路線」，需後續建立正式對應表。';
      model.sourceError=msg||'此頁目前顯示原定派車；實際出勤修改及結案尚未連線。';
    }catch(err){
      console.error('attendance load:',err);
      model.drivers=[];model.assignments={};model.extraSlotCount=0;model.extras=[];
      model.detectedCounts={};model.sourceError=`派車資料載入失敗：${err.message||'未知錯誤'}`;
    }finally{model.loading=false;render();}
  }
  async function signOut(){
    if(!demo && typeof db!=='undefined')await db.auth.signOut();
    window.location.href='index.html';
  }
  function wire(){
    $('attendance-date').addEventListener('change',e=>changeDate(e.target.value));
    $('date-prev').onclick=()=>moveDate(-1);$('date-next').onclick=()=>moveDate(1);
    $('today').onclick=()=>changeDate(localDate());
    $('attendance-search').oninput=e=>{model.search=e.target.value.trim();render();};
    $('refresh').onclick=()=>{if(demo){loadSample();render();showToast('示範資料已重新載入');}else loadLive();};
    $('grid-body').addEventListener('click',e=>{
      const button=e.target.closest('[data-edit-driver]');
      if(button)beginEdit(button.dataset.editDriver,button.dataset.editSlot);
    });
    $('edit-form').addEventListener('submit',savePreview);
    $('edit-cancel').onclick=dismissModal;$('modal-x').onclick=dismissModal;
    $('close-x').onclick=dismissModal;$('close-cancel').onclick=dismissModal;
    $('modal-backdrop').onclick=dismissModal;$('close-save').onclick=completeClose;
    $('day-close').onclick=startClose;
    $('slot-settings').onclick=openSlotSettings;
    $('slot-x').onclick=dismissModal;
    $('slot-done').onclick=dismissModal;
    $('slot-list').addEventListener('click',e=>{
      const button=e.target.closest('[data-slot-step]');
      if(button)stepSlotCount(button.dataset.group,Number(button.dataset.slotStep));
    });
    $('side-logout').onclick=signOut;$('mobile-logout').onclick=signOut;
    $('mobile-menu').onclick=()=>{
      $('mobile-links').hidden=!$('mobile-links').hidden;
      $('mobile-menu').setAttribute('aria-expanded',String(!$('mobile-links').hidden));
    };
    document.querySelectorAll('[data-demo-role]').forEach(b=>b.addEventListener('click',()=>{
      if(!demo)return;model.role=b.dataset.demoRole;dismissModal();render();
    }));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')dismissModal();});
  }
  async function init(){
    wire();
    if(demo){loadSample();render();return;}
    if(await auth())await loadLive();
  }
  init().catch(e=>{
    console.error(e);
    $('source-note').textContent=`無法初始化：${e.message}`;
  });
})();
