
(() => {
  'use strict';
  const root=document.getElementById('prototype');
  const $=id=>document.getElementById(id);
  const GROUPS=[
    {label:'日配',prefix:'日',base:2},
    {label:'OC',prefix:'OC',base:3},
    {label:'鮮二',prefix:'鮮二',base:3},
    {label:'冷凍',prefix:'冷凍',base:4},
    {label:'低鮮',prefix:'低鮮',base:4}
  ];
  const MAX=30;
  const people=[['d1','林小美'],['d2','王小明'],['d3','陳小華'],['d4','楊子祥'],['d5','趙雅婷'],['d6','張柏翰'],['d7','吳佳穎'],['d8','劉志強'],['d9','黃俊豪'],['d10','鄭宜靜'],['d11','高建民'],['d12','許雅雯']];
  const base={
    d1:{'日1':['01','1001'],'日2':['02','1001']},
    d2:{OC1:['EB','1003'],OC2:['HB','1003']},
    d3:{'鮮二1':['RC','6203'],'鮮二2':['TC','6203']},
    d4:{冷凍1:['RG','0115'],冷凍2:['爆量','0115']},
    d5:{低鮮1:['AT','1277']},d6:{},
    d7:{日1:['03','1608']},d8:{OC3:['ES','1007']},
    d9:{鮮二3:['WS','2118']},d10:{冷凍4:['CT','1199']},
    d11:{低鮮3:['LF','2281']},d12:{日2:['04','2190']}
  };
  const STORAGE='fleet-attendance-standalone-v2';
  const saved=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{return {}}})();
  const state={device:'mobile',role:'driver',day:0,query:'',modal:null,
    changed:saved.changed&&typeof saved.changed==='object'?saved.changed:{},
    counts:saved.counts&&typeof saved.counts==='object'?saved.counts:{},
    closed:saved.closed&&typeof saved.closed==='object'?saved.closed:{},
    notes:saved.notes&&typeof saved.notes==='object'?saved.notes:{},
    audit:saved.audit&&typeof saved.audit==='object'?saved.audit:{}};
  const start=new Date(2026,9,15,12);
  function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({changed:state.changed,counts:state.counts,closed:state.closed,notes:state.notes,audit:state.audit}))}catch{}}
  const safe=str=>String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function iso(){const d=new Date(start);d.setDate(d.getDate()+state.day);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function dailyChanges(){return state.changed[iso()]||(state.changed[iso()]={})}
  function counts(){return state.counts[iso()]||Object.fromEntries(GROUPS.map(g=>[g.label,g.base]))}
  function basePair(id,slot){if(state.day===0)return base[id]?.[slot]||['',''];if(state.day===-1&&id==='d1'&&slot==='日1')return ['03','1001'];if(state.day===-1&&id==='d2'&&slot==='OC1')return ['EB','1003'];return ['','']}
  function pair(id,slot){return dailyChanges()[id]?.[slot]||basePair(id,slot)}
  function editable(id){return !state.closed[iso()]&&(state.role==='dispatcher'||id==='d1')}
  function driverName(id){return people.find(p=>p[0]===id)?.[1]||id}
  function groupSlots(){return GROUPS.map(g=>({...g,slots:Array.from({length:counts()[g.label]??g.base},(_,i)=>g.prefix+(i+1))})).filter(g=>g.slots.length)}
  function slotsInUse(slot){return people.some(([id])=>pair(id,slot).some(v=>String(v||'').trim()))}
  function render(keepScroll=true){
    const scroll=$('table-scroll'),oldX=keepScroll?scroll.scrollLeft:0,oldY=keepScroll?scroll.scrollTop:0;
    const d=new Date(start);d.setDate(d.getDate()+state.day);
    $('date-caption').textContent=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} · 星期${'日一二三四五六'[d.getDay()]}`;
    $('date-short').textContent=`${d.getMonth()+1} / ${d.getDate()}`;
    $('day-action').hidden=state.role!=='dispatcher';
    $('day-action').textContent=state.closed[iso()]?'重新開啟':'結案';
    $('slot-adjust').hidden=state.role!=='dispatcher'||!!state.closed[iso()];
    root.querySelectorAll('[data-device]').forEach(b=>b.classList.toggle('is-on',b.dataset.device===state.device));
    root.querySelectorAll('[data-role]').forEach(b=>b.classList.toggle('is-on',b.dataset.role===state.role));
    $('stage').classList.toggle('is-mobile',state.device==='mobile');
    const groups=groupSlots(),all=groups.flatMap(g=>g.slots);
    let header='<tr class="category"><th rowspan="2" class="name-header">司機</th><th rowspan="2" class="leave-col">休假</th>';
    for(const g of groups)header+=`<th colspan="${g.slots.length*2}">${safe(g.label)}</th>`;
    header+='</tr><tr class="subheading">';
    for(const g of groups)for(let i=0;i<g.slots.length;i++)header+=`<th class="${i===0?'separator':''}">${safe(g.slots[i])}</th><th>車號</th>`;
    $('thead').innerHTML=header+'</tr>';
    const q=state.query.trim().toLocaleLowerCase();let rows='',shown=0;
    for(const [id,name] of people){
      let found=!q||name.toLocaleLowerCase().includes(q)||all.some(slot=>slot.toLocaleLowerCase().includes(q)&&pair(id,slot).some(Boolean)||pair(id,slot).some(v=>String(v||'').toLocaleLowerCase().includes(q)));
      if(!found)continue;shown++;
      rows+=`<tr class="${id==='d1'?'mine':''}"><th class="name">${safe(name)}</th><td class="leave-col">${id==='d6'?'休':''}</td>`;
      for(const g of groups)for(let i=0;i<g.slots.length;i++){
        const slot=g.slots[i],p=pair(id,slot),original=basePair(id,slot),begin=i===0?'separator':'';
        for(let j=0;j<2;j++){
          const val=String(p[j]||''),modified=val!==String(original[j]||'');
          const klass=`cell ${modified?'edited':''} ${val?'':'empty'}`;
          const cell=editable(id)?`<button class="${klass}" data-edit="${id}|${slot}" type="button" aria-label="編輯${safe(name)}的${safe(slot)}">${val?safe(val):'&nbsp;'}</button>`:`<span class="${klass}">${val?safe(val):'&nbsp;'}</span>`;
          rows+=`<td class="${j===0?begin:''}">${cell}</td>`;
        }
      }
      rows+='</tr>';
    }
    $('tbody').innerHTML=rows||`<tr><td colspan="${all.length*2+2}" style="height:85px">找不到符合條件的紀錄</td></tr>`;
    $('row-count').textContent=`共 ${shown} 位司機`;
    $('footer-right').textContent=state.closed[iso()]?'本日已結案':'左右滑動查看更多欄位 →';
    scroll.scrollLeft=oldX;scroll.scrollTop=oldY;
  }
  let to;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(to);to=setTimeout(()=>$('toast').classList.remove('show'),2100)}
  function openModal(type,detail){
    state.modal={type,detail};$('form-error').textContent='';let title='',description='',fields='',save='儲存';
    if(type==='edit'){
      const [id,slot]=detail,[route,vehicle]=pair(id,slot),origin=basePair(id,slot);
      title=`${driverName(id)} · ${slot}`;description='編輯實際路線與車號。';
      fields=`<label for="route">路線</label><input id="route" maxlength="40" value="${safe(route)}" placeholder="路線代碼"><label for="vehicle">車號</label><input id="vehicle" maxlength="32" value="${safe(vehicle)}" placeholder="車號"><div class="original">原定：${safe(origin.filter(Boolean).join(' / ')||'未指派')}</div>`;
    }else if(type==='slots'){
      title='調整每日趟數';description='調整各配送類別的欄位數量。新增趟次會一起增加「路線＋車號」兩欄。';
      fields='<div id="slot-controls" class="slot-stack"></div><p class="slot-footnote">每一天可有不同趟數；有資料的最後一趟無法直接移除。</p>';
      save='完成';
    }else if(type==='close'){
      title='確認當日出勤';description='結案後整張表將鎖定，司機不能繼續修改。';
      fields=`<label for="note">主管備註（選填）</label><textarea id="note" placeholder="當日異常或補充說明">${safe(state.notes[iso()]||'')}</textarea>`;save='確認結案';
    }else{
      title='重新開啟當日出勤';description='請填寫重新開啟原因。';fields='<label for="reason">重新開啟原因</label><textarea id="reason" placeholder="請說明原因"></textarea>';save='重新開啟';
    }
    $('dialog-title').textContent=title;$('dialog-desc').textContent=description;$('dialog-fields').innerHTML=fields;$('save').textContent=save;
    $('dialog').classList.add('show');$('scrim').classList.add('show');
    if(type==='slots')renderSlotControls();
    else $('dialog-fields').querySelector('input,textarea')?.focus();
  }
  function closeModal(){state.modal=null;$('dialog').classList.remove('show');$('scrim').classList.remove('show')}
  function renderSlotControls(){
    const el=$('slot-controls');if(!el)return;
    const c=counts();
    el.innerHTML=GROUPS.map(g=>`<div class="slot-item"><div><div class="slot-title">${safe(g.label)}</div><div class="slot-desc">${safe(g.prefix)}1 – ${safe(g.prefix)}${c[g.label]}</div></div><div class="slot-steps"><button data-step="-1" data-group="${g.label}" aria-label="減少${g.label}趟數" ${c[g.label]<=1?'disabled':''}>−</button><output>${c[g.label]}</output><button class="add" data-step="1" data-group="${g.label}" aria-label="增加${g.label}趟數" ${c[g.label]>=MAX?'disabled':''}>＋</button></div></div>`).join('');
  }
  function stepCount(group,step){
    if(state.role!=='dispatcher'||state.closed[iso()])return;
    const g=GROUPS.find(x=>x.label===group);if(!g)return;
    const prev=counts()[group],next=prev+step;if(next<1||next>MAX)return;
    if(step<0){const removed=g.prefix+prev;if(slotsInUse(removed)){$('form-error').textContent=`${removed} 已有資料，請先移除該欄位的配送紀錄。`;return}}
    state.counts[iso()]={...counts(),[group]:next};
    $('form-error').textContent='';persist();render();renderSlotControls();
  }
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.device){state.device=b.dataset.device;closeModal();render();return}
    if(b.dataset.role){state.role=b.dataset.role;closeModal();render();return}
    if(b.dataset.edit){const [id,slot]=b.dataset.edit.split('|');if(editable(id))openModal('edit',[id,slot]);return}
    if(b.dataset.step){stepCount(b.dataset.group,Number(b.dataset.step));return}
  });
  $('prev').onclick=()=>{state.day--;closeModal();render(false)};
  $('next').onclick=()=>{state.day++;closeModal();render(false)};
  $('search').oninput=e=>{state.query=e.target.value.trim();render(false)};
  $('slot-adjust').onclick=()=>openModal('slots',null);
  $('day-action').onclick=()=>openModal(state.closed[iso()]?'reopen':'close',null);
  $('cancel').onclick=closeModal;$('scrim').onclick=closeModal;
  $('save').onclick=()=>{
    if(!state.modal)return;
    const {type,detail}=state.modal;
    if(type==='slots'){closeModal();toast('趟數已更新');return}
    if(type==='edit'){
      const route=$('route').value.trim(),vehicle=$('vehicle').value.trim();
      if(Boolean(route)!==Boolean(vehicle)){$('form-error').textContent='請同時填寫路線與車號，或兩欄一起清空。';return}
      const [id,slot]=detail;if(!editable(id)){closeModal();toast('沒有編輯權限');return}
      const dc=dailyChanges();if(!dc[id])dc[id]={};
      const baseValues=basePair(id,slot);
      if(route===baseValues[0]&&vehicle===baseValues[1])delete dc[id][slot];else dc[id][slot]=[route,vehicle];
      persist();closeModal();render();toast('已更新出勤紀錄');
    }else if(type==='close'){
      state.notes[iso()]=$('note').value.trim();state.closed[iso()]=true;persist();closeModal();render();toast('當日已結案');
    }else{
      const reason=$('reason').value.trim();if(!reason){$('form-error').textContent='請填寫重新開啟原因。';return}
      state.audit[iso()]=[...(state.audit[iso()]||[]),{reason,at:new Date().toISOString()}];
      state.closed[iso()]=false;persist();closeModal();render();toast('已重新開啟');
    }
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
  render();
})();
