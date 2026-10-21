
(()=>{'use strict';
 const $=id=>document.getElementById(id),baseRegions=window.ROUTE_SHOWCASE?.regions||['台北市','新北市','桃園市','台中市','高雄市'],baseZones=window.ROUTE_SHOWCASE?.zones||['常溫','冷藏','冷凍'];
 const defaults=window.ROUTE_SHOWCASE?.rates||{台北市:{常溫:880,冷藏:1050,冷凍:1220},新北市:{常溫:950,冷藏:1130,冷凍:1320},桃園市:{常溫:1020,冷藏:1220,冷凍:1440},台中市:{常溫:1180,冷藏:1400,冷凍:1650},高雄市:{常溫:1320,冷藏:1560,冷凍:1840}};
 const seed=window.ROUTE_SHOWCASE?.routes||[
 {code:'FM-101',name:'台北早班 A 線',region:'台北市',zone:'常溫',time:'06:30–10:30',active:true},
 {code:'FM-102',name:'台北鮮配 B 線',region:'台北市',zone:'冷藏',time:'07:00–11:00',active:true},
 {code:'FM-103',name:'新北常溫 C 線',region:'新北市',zone:'常溫',time:'08:00–12:00',active:true},
 {code:'FM-104',name:'桃園冷凍 A 線',region:'桃園市',zone:'冷凍',time:'06:00–10:00',active:true},
 {code:'FM-105',name:'新北冷藏 B 線',region:'新北市',zone:'冷藏',time:'11:00–15:00',active:true},
 {code:'FM-106',name:'台中日配 A 線',region:'台中市',zone:'常溫',time:'05:30–09:30',active:true},
 {code:'FM-107',name:'高雄冷凍 B 線',region:'高雄市',zone:'冷凍',time:'10:00–14:00',active:true},
 {code:'FM-108',name:'桃園鮮配 C 線',region:'桃園市',zone:'冷藏',time:'12:00–16:00',active:true},
 {code:'FM-109',name:'新北冷凍 D 線',region:'新北市',zone:'冷凍',time:'15:00–19:00',active:true},
 {code:'FM-110',name:'台北常溫 D 線',region:'台北市',zone:'常溫',time:'14:00–18:00',active:true},
 {code:'FM-111',name:'高雄日配 E 線',region:'高雄市',zone:'常溫',time:'06:00–10:00',active:true},
 {code:'FM-112',name:'台中低溫 C 線',region:'台中市',zone:'冷藏',time:'12:00–16:00',active:true}];
 const copy=x=>JSON.parse(JSON.stringify(x)); const STORAGE='route-management-showcase-131-v1',OLD_STORAGE='route-management-showcase-131-v0';
 let regions=[...baseRegions],zones=[...baseZones],data=copy(seed),rates=copy(defaults),tab='routes',editing=null,rateEditing=null,entityEditing=null,device='desktop',savedFilter={search:'',region:'',zone:''},notifyTimer;
 try{const state=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem(OLD_STORAGE));if(state&&Array.isArray(state.data)&&state.rates){data=state.data;rates=state.rates;if(Array.isArray(state.regions)&&state.regions.length)regions=state.regions;if(Array.isArray(state.zones)&&state.zones.length)zones=state.zones;}}catch{}
 const money=v=>'NT$ '+Number(v||0).toLocaleString('en-US'); const htmlEsc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fee=r=>rates[r.region]?.[r.zone]??null;
 function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({data,rates,regions,zones}))}catch{}}
 function notice(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(notifyTimer);notifyTimer=setTimeout(()=>$('toast').classList.remove('show'),2100)}
 function setupSelects(){
    const oldFilterRegion=$('filter-region').value||savedFilter.region,oldFilterZone=$('filter-zone').value||savedFilter.zone,oldRegion=$('f-region').value,oldZone=$('f-zone').value;
    const opt=(value,label)=>`<option value="${htmlEsc(value)}">${htmlEsc(label)}</option>`;
    $('filter-region').innerHTML=opt('','全部地區')+regions.map(r=>opt(r,r)).join('');
    $('filter-zone').innerHTML=opt('','全部溫層')+zones.map(z=>opt(z,z)).join('');
    $('f-region').innerHTML=regions.map(r=>opt(r,r)).join('');$('f-zone').innerHTML=zones.map(z=>opt(z,z)).join('');
    $('filter-region').value=regions.includes(oldFilterRegion)?oldFilterRegion:'';$('filter-zone').value=zones.includes(oldFilterZone)?oldFilterZone:'';
    savedFilter.region=$('filter-region').value;savedFilter.zone=$('filter-zone').value;
    $('f-region').value=regions.includes(oldRegion)?oldRegion:regions[0];$('f-zone').value=zones.includes(oldZone)?oldZone:zones[0];
  }
 function stats(){const active=data.filter(r=>r.active);$('stat-routes').textContent=active.length;$('stat-regions').textContent=regions.length;$('stat-zones').textContent=zones.length;let vals=active.map(fee).filter(x=>x!==null);$('stat-avg').textContent=vals.length?money(Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)):'—'}
 function filterData(){const q=savedFilter.search.toLowerCase();return data.filter(r=>[r.code,r.name,r.region,r.zone].some(v=>v.toLowerCase().includes(q))&&(!savedFilter.region||r.region===savedFilter.region)&&(!savedFilter.zone||r.zone===savedFilter.zone))}
 function renderRoutes(){const rows=filterData(),body=$('routes-body');body.innerHTML=rows.map(r=>`<tr tabindex="0" role="button" data-code="${htmlEsc(r.code)}" aria-label="編輯 ${htmlEsc(r.name)}" class="${editing?.code===r.code?'selected':''}"><td>${htmlEsc(r.name)}<span class="route-code">${htmlEsc(r.code)}${r.active?'':' · 已停用'}</span></td><td><span class="region">${htmlEsc(r.region)}</span></td><td><span class="zone">${htmlEsc(r.zone)}</span></td><td class="cost">${fee(r)===null?'待設定':money(fee(r))}</td><td class="dim">${htmlEsc(r.time||'—')}</td><td class="row-arrow">›</td></tr>`).join('')||'<tr><td colspan="6" style="position:static;text-align:center;height:110px;color:#999">找不到符合條件的路線</td></tr>';$('result-count').textContent=`顯示 ${rows.length} / ${data.length} 條路線`;}
 function renderRates(){
    $('rates-head').innerHTML=`<tr><th>配送地區</th>${zones.map(zone=>`<th>${htmlEsc(zone)}</th>`).join('')}</tr>`;
    $('rates-head').parentElement.style.minWidth=Math.max(510,(zones.length+1)*137)+'px';
    $('rates-body').innerHTML=regions.map(region=>`<tr><td>${htmlEsc(region)}</td>${zones.map(zone=>{const value=rates[region]?.[zone];const unset=value==null;return `<td><button class="${unset?'unset':''}" type="button" data-region="${htmlEsc(region)}" data-zone="${htmlEsc(zone)}" aria-label="設定 ${htmlEsc(region)} ${htmlEsc(zone)} 費率">${unset?'＋ 設定費率':money(value)}</button></td>`}).join('')}</tr>`).join('');
  }
  function renderCatalog(){
    const mk=(kind,items,target)=>{
      $(target).innerHTML=items.map(name=>{
        const used=data.filter(row=>(kind==='region'?row.region:row.zone)===name).length;
        return `<div class="catalog-item"><span class="catalog-name" title="${htmlEsc(name)}">${htmlEsc(name)}</span><span class="catalog-meta">${used} 條路線</span><button class="catalog-control" type="button" data-action="rename" data-kind="${kind}" data-name="${htmlEsc(name)}">編輯</button><button class="catalog-control delete" type="button" data-action="delete" data-kind="${kind}" data-name="${htmlEsc(name)}" aria-label="刪除 ${htmlEsc(name)}">移除</button></div>`;
      }).join('');
    };
    mk('region',regions,'region-list');mk('zone',zones,'zone-list');
    $('region-hint').textContent=`共 ${regions.length} 個地區`;$('zone-hint').textContent=`共 ${zones.length} 個溫層`;
  }
 function render(){stats();renderRoutes();renderRates();renderCatalog();for(const t of ['routes','rates','manage']){$('tab-'+t).classList.toggle('active',tab===t)}$('route-view').classList.toggle('hide',tab!=='routes');$('rate-view').classList.toggle('hide',tab!=='rates');$('manage-view').classList.toggle('hide',tab!=='manage');$('section-title').textContent=tab==='routes'?'路線列表':tab==='rates'?'地區 × 溫層費率表':'地區與溫層管理';$('section-sub').textContent=tab==='routes'?'所有路線的地區、溫層與費用一目了然':tab==='rates'?'點選價格設定每一種組合的費率':'新增或調整配送分類，相關路線即時同步';}
 function openDrawer(code){const row=data.find(r=>r.code===code);editing=code===null?'new':row;if(!editing)return;
 $('drawer-kicker').textContent=row?'編輯配送路線':'建立新路線';$('drawer-title').textContent=row?'編輯路線':'新增路線';$('f-code').value=row?row.code:`FM-${String(Math.max(112,...data.map(r=>Number(r.code.replace(/\D/g,''))||112))+1)}`;
 $('f-name').value=row?row.name:'';$('f-region').value=row?row.region:regions[0];$('f-zone').value=row?row.zone:zones[0];$('f-start').value=row&&/^\d\d:\d\d/.test(row.time||'')?row.time.slice(0,5):'';$('f-end').value=row&&/–\d\d:\d\d/.test(row.time||'')?row.time.split('–')[1]:'';$('toggle-active').classList.toggle('hide',!row);$('toggle-active').textContent=row&&row.active?'停用此路線':'啟用此路線';$('save-form').textContent=row?'儲存變更':'建立路線';$('form-error').textContent='';updateFee();$('overlay').classList.add('open');$('drawer').classList.add('open');$('drawer').setAttribute('aria-hidden','false');renderRoutes();setTimeout(()=>$('f-name').focus(),100)}
 function dismiss(){editing=null;rateEditing=null;entityEditing=null;$('overlay').classList.remove('open');$('drawer').classList.remove('open');$('drawer').setAttribute('aria-hidden','true');$('rate-modal').classList.remove('open');$('rate-modal').setAttribute('aria-hidden','true');$('entity-modal').classList.remove('open');$('entity-modal').setAttribute('aria-hidden','true');renderRoutes();}
  function closeEntity(){entityEditing=null;$('entity-modal').classList.remove('open');$('entity-modal').setAttribute('aria-hidden','true');if(!$('drawer').classList.contains('open'))$('overlay').classList.remove('open')}
  function openEntity(kind,oldName=null,origin='catalog'){
    entityEditing={kind,oldName,origin};const word=kind==='region'?'配送地區':'配送溫層';
    $('entity-modal-title').textContent=(oldName?'編輯':'新增')+word;
    $('entity-modal-desc').textContent=oldName?'修改後，使用這項分類的路線與費率表會同步更新。':'新增後可選用，請再到費率表設定新的計價組合。';
    $('entity-label').textContent=word+'名稱';$('entity-name').value=oldName||'';
    $('entity-submit').textContent=oldName?'儲存變更':'新增';$('entity-error').textContent='';
    $('overlay').classList.add('open');$('entity-modal').classList.add('open');$('entity-modal').setAttribute('aria-hidden','false');
    setTimeout(()=>$('entity-name').focus(),40);
  }
  function saveEntity(e){
    e.preventDefault();if(!entityEditing)return;
    const {kind,oldName,origin}=entityEditing,items=kind==='region'?regions:zones;
    const name=$('entity-name').value.normalize('NFKC').trim().replace(/\s+/g,' ');
    if(!name||name.length>30){$('entity-error').textContent='請輸入 1 至 30 個字的名稱。';return}
    if(items.some(item=>item.toLocaleLowerCase()===name.toLocaleLowerCase()&&item!==oldName)){$('entity-error').textContent='此名稱已存在，請輸入其他名稱。';return}
    if(oldName&&name===oldName){closeEntity();return}
    if(oldName){
      items[items.indexOf(oldName)]=name;
      data.forEach(route=>{if(route[kind==='region'?'region':'zone']===oldName)route[kind==='region'?'region':'zone']=name});
      if(kind==='region'){rates[name]=rates[oldName];delete rates[oldName];if(savedFilter.region===oldName)savedFilter.region=name;}
      else {regions.forEach(region=>{rates[region]??={};if(Object.prototype.hasOwnProperty.call(rates[region],oldName)){rates[region][name]=rates[region][oldName];delete rates[region][oldName];}});if(savedFilter.zone===oldName)savedFilter.zone=name;}
    }else{
      items.push(name);if(kind==='region')rates[name]={};
    }
    setupSelects();$('filter-region').value=regions.includes(savedFilter.region)?savedFilter.region:'';$('filter-zone').value=zones.includes(savedFilter.zone)?savedFilter.zone:'';if(origin==='route'&&!oldName){$(kind==='region'?'f-region':'f-zone').value=name;updateFee()}
    persist();closeEntity();render();notice(oldName?'分類名稱已更新':'已新增'+(kind==='region'?'配送地區':'配送溫層'));
  }
  function removeEntity(kind,name){
    const items=kind==='region'?regions:zones;
    const used=data.filter(row=>(kind==='region'?row.region:row.zone)===name).length;
    if(used){notice(`已有 ${used} 條路線使用「${name}」，無法移除`);return}
    if(items.length<=1){notice('至少需要保留一項分類');return}
    if(!confirm(`確定移除「${name}」？相關費率組合也會一併移除。`))return;
    items.splice(items.indexOf(name),1);
    if(kind==='region')delete rates[name];else regions.forEach(region=>{if(rates[region])delete rates[region][name]});
    setupSelects();persist();render();notice('分類已移除');
  }
 function updateFee(){const area=$('f-region').value,zone=$('f-zone').value,v=rates[area]?.[zone];$('fee-preview').textContent=v===undefined?'待設定':money(v);$('fee-caption').innerHTML=`${htmlEsc(area)}<br>${htmlEsc(zone)} · 示範費率`}
 function changeRate(region,zone){dismiss();rateEditing={region,zone};$('rate-modal-desc').textContent=`${region} · ${zone}：新費率會套用到此組合的所有路線。`;$('rate-amount').value=rates[region]?.[zone]??'';$('rate-error').textContent='';$('overlay').classList.add('open');$('rate-modal').classList.add('open');$('rate-modal').setAttribute('aria-hidden','false');setTimeout(()=>$('rate-amount').focus(),30)}

 function deviceChange(next){device=next;$('stage').classList.toggle('mobile',device==='mobile');$('stage').classList.toggle('desktop',device==='desktop');$('device-desktop').classList.toggle('active',device==='desktop');$('device-mobile').classList.toggle('active',device==='mobile');dismiss()}
 $('device-desktop').onclick=()=>deviceChange('desktop');$('device-mobile').onclick=()=>deviceChange('mobile');$('tab-routes').onclick=()=>{tab='routes';render()};$('tab-rates').onclick=()=>{tab='rates';render()};$('tab-manage').onclick=()=>{tab='manage';render()};$('route-search').oninput=e=>{savedFilter.search=e.target.value.trim();renderRoutes()};$('filter-region').onchange=e=>{savedFilter.region=e.target.value;renderRoutes()};$('filter-zone').onchange=e=>{savedFilter.zone=e.target.value;renderRoutes()};$('add-route').onclick=()=>openDrawer(null);$('dismiss').onclick=dismiss;$('overlay').onclick=dismiss;$('cancel-form').onclick=dismiss;$('rate-cancel').onclick=dismiss;$('entity-cancel').onclick=closeEntity;$('entity-form').addEventListener('submit',saveEntity);$('f-region').onchange=updateFee;$('f-zone').onchange=updateFee;
 $('routes-body').addEventListener('click',e=>{const row=e.target.closest('tr[data-code]');if(row)openDrawer(row.dataset.code)});
 $('routes-body').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const row=e.target.closest('tr[data-code]');if(row){e.preventDefault();openDrawer(row.dataset.code)}}});
 $('rates-body').addEventListener('click',e=>{const b=e.target.closest('button[data-region]');if(b)changeRate(b.dataset.region,b.dataset.zone)});
  document.querySelectorAll('[data-create-kind]').forEach(btn=>btn.addEventListener('click',()=>openEntity(btn.dataset.createKind,null,btn.dataset.origin||'catalog')));
  for(const list of ['region-list','zone-list'])$(list).addEventListener('click',e=>{
    const b=e.target.closest('button[data-action]');if(!b)return;
    if(b.dataset.action==='rename')openEntity(b.dataset.kind,b.dataset.name);
    else if(b.dataset.action==='delete')removeEntity(b.dataset.kind,b.dataset.name);
  });
 $('route-form').addEventListener('submit',e=>{e.preventDefault();const name=$('f-name').value.trim(),region=$('f-region').value,zone=$('f-zone').value;if(!name||!region||!zone){$('form-error').textContent='請填寫路線名稱、地區與溫層。';return}const start=$('f-start').value,end=$('f-end').value;const time=start&&end?start+'–'+end:'—';if(editing==='new'){const route={code:$('f-code').value,name,region,zone,time,active:true};data.unshift(route)}else if(editing){const row=data.find(r=>r.code===editing.code);if(row)Object.assign(row,{name,region,zone,time})}else return;persist();dismiss();render();notice('路線資料已儲存')});
 $('rate-form').addEventListener('submit',e=>{e.preventDefault();if(!rateEditing)return;const {region,zone}=rateEditing;const value=$('rate-amount').value.trim(),amount=Number(value);if(!value||!Number.isSafeInteger(amount)||amount<0||amount>10000000){$('rate-error').textContent='請輸入有效的非負整數金額。';return}rates[region]??={};rates[region][zone]=amount;persist();dismiss();render();notice('費率已更新，相關路線同步重新計算')});
 $('toggle-active').onclick=()=>{if(!editing||editing==='new')return;const row=data.find(r=>r.code===editing.code);if(!row)return;row.active=!row.active;persist();dismiss();render();notice(row.active?'路線已啟用':'路線已停用')};
 $('reset-btn').onclick=()=>{if(!confirm('要恢復原型的示範路線與費率嗎？'))return;data=copy(seed);rates=copy(defaults);regions=[...baseRegions];zones=[...baseZones];setupSelects();savedFilter={search:'',region:'',zone:''};$('route-search').value='';persist();dismiss();render();notice('已恢復示範資料')};
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(entityEditing)closeEntity();else if(editing||rateEditing)dismiss()}});
 setupSelects();render();
})();
