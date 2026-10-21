
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const zones=['常溫','冷藏','冷凍','低鮮'];
const regions=['台北','桃園','新竹'];
const names=['林小美','王小明','陳小華','楊子祥','趙雅婷','張柏翰','吳佳穎','劉志強','黃俊豪','鄭宜靜','高建民','許雅雯'];
const rateDefaults={'常溫':{'台北':190,'桃園':230,'新竹':280},'冷藏':{'台北':240,'桃園':300,'新竹':360},'冷凍':{'台北':290,'桃園':350,'新竹':420},'低鮮':{'台北':255,'桃園':315,'新竹':375}};
const state={month:'2026-10',screen:'desktop',tab:'summary',search:'',sort:'trips',selected:null,detail:'pay',subdate:null,dialog:null,monthly:{},rates:structuredClone(rateDefaults),standbyRate:350,rentalAllowance:0,serial:100};
const STORAGE_KEY='fleet-monthly-dashboard-v3-demo';
try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(saved&&saved.monthly){state.monthly=saved.monthly;state.rates=saved.rates||state.rates;state.standbyRate=saved.standbyRate??state.standbyRate;state.rentalAllowance=saved.rentalAllowance??state.rentalAllowance;state.serial=saved.serial||100;}}catch(e){console.warn('Demo state not available',e)}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({monthly:state.monthly,rates:state.rates,standbyRate:state.standbyRate,rentalAllowance:state.rentalAllowance,serial:state.serial}));}catch(e){console.warn('Demo storage unavailable',e)}}
const fmt=n=>Number(n).toLocaleString('zh-TW');
const money=n=>'NT$ '+(n<0?'−':'')+fmt(Math.abs(n));
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
function hash(x){let n=2166136261;for(const c of x)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0}
function rng(seed){let a=seed>>>0;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/2**32}}
const combo=(zone,region)=>`${zone}::${region}`;
function initMonth(month){let r=rng(hash(month)),[y,m]=month.split('-').map(Number),days=new Date(y,m,0).getDate();let drivers=names.map((name,id)=>({id,name,base:0,days:[],adjustments:[],extraAllowances:[],allowances:{}}));
for(let day=1;day<=days;day++){
 const date=`${month}-${pad(day)}`;const weekday=new Date(y,m-1,day).getDay();
 drivers.forEach((dr,id)=>{
  if(weekday===0&&r()<.77)return;if(r()<.18)return;
  const standby=r()<.2?1:0;let n=1+Math.floor(r()*3);if(r()<.08)n=0;
  const runs=[];
  for(let k=0;k<n;k++){let zone=zones[Math.floor(r()*zones.length)],region=regions[Math.floor(r()*regions.length)];runs.push({id:`RUN-${month.replace('-','')}-${pad(day)}-${pad(id)}-${pad(k)}`,zone,region,route:`${zone.slice(0,1)}${pad(Math.floor(r()*18)+1)}`,vehicle:`${1000+Math.floor(r()*2000)}`,rental:r()<.18});}
  if(id===0&&day===15){for(let i=0;i<5;i++)runs.push({id:`RUN-${month.replace('-','')}-15-00-X${i}`,zone:'冷凍',region:'桃園',route:'凍'+(i+1),vehicle:i%2?'KLC-728':'TDJ-662',rental:i%2===1});}
  if(!runs.length&&!standby)return;dr.days.push({date,id:`ATT-${month.replace('-','')}-${pad(day)}-${pad(id)}`,runs,standby});
 });
}
const rewards=['臨時支援表現良好','協助調整配送路線','配送服務品質優良'];const penalties=['交接程序未完成','配送作業疏失','出勤紀錄異常'];
drivers.forEach((dr,id)=>{
 const valid=dr.days.filter(x=>x.runs.length||x.standby);if(!valid.length)return;
 for(let i=0;i<(id===0?3:Math.floor(r()*3));i++){
  let d=valid[Math.floor(r()*valid.length)],type=i===2?'penalty':(r()<.75?'reward':'penalty');dr.adjustments.push({id:`ADJ-${month}-${id}-${i}`,date:d.date,runId:d.runs[0]?.id||'',type,reason:(type==='reward'?rewards:penalties)[Math.floor(r()*3)],amount:100*(1+Math.floor(r()*5))});
 }
});
// Initial example of driver-specific temperature × region allowance and notes.
drivers[0].allowances[combo('冷凍','桃園')]={perTrip:80,note:'冷凍桃園長程配送加給'};
drivers[0].allowances[combo('冷藏','台北')]={perTrip:50,note:'冷藏區域支援'};
drivers[1].allowances[combo('常溫','新竹')]={perTrip:60,note:'跨區勤務加給'};
 const da=drivers[0].days.find(d=>d.runs.length);if(da)drivers[0].extraAllowances.push({id:`EXTRA-${month}-00-01`,amount:450,reason:'本月臨時卸貨協助',date:da.date,runId:da.runs[0].id});
 const db=drivers[1].days.find(d=>d.runs.length);if(db)drivers[1].extraAllowances.push({id:`EXTRA-${month}-01-01`,amount:300,reason:'臨時跨區支援加給',date:db.date,runId:''});
return drivers;
}
function data(){return state.monthly[state.month]||(state.monthly[state.month]=initMonth(state.month));}
function driver(){return data().find(x=>x.id===state.selected)}
function calc(dr){const groups=new Map();let standby=0,rental=0,count=0;
 for(const day of dr.days){standby+=day.standby;for(const run of day.runs){count++;if(run.rental)rental++;const key=combo(run.zone,run.region);let o=groups.get(key);if(!o){o={key,zone:run.zone,region:run.region,count:0,baseRate:state.rates[run.zone][run.region],allowance:dr.allowances[key]?.perTrip||0,note:dr.allowances[key]?.note||'',runs:[]};groups.set(key,o)}o.count++;o.runs.push({...run,date:day.date});}}
 const lines=[...groups.values()].sort((a,b)=>zones.indexOf(a.zone)-zones.indexOf(b.zone)||regions.indexOf(a.region)-regions.indexOf(b.region));
 const baseTrips=lines.reduce((s,x)=>s+x.count*x.baseRate,0),allowances=lines.reduce((s,x)=>s+x.count*x.allowance,0),extraAllowance=(dr.extraAllowances||[]).reduce((s,x)=>s+x.amount,0),standbyPay=standby*state.standbyRate,rentalPay=rental*state.rentalAllowance;
 const reward=dr.adjustments.filter(a=>a.type==='reward').reduce((s,x)=>s+x.amount,0),penalty=dr.adjustments.filter(a=>a.type==='penalty').reduce((s,x)=>s+x.amount,0);
 return {count,standby,rental,lines,baseTrips,allowances,extraAllowance,standbyPay,rentalPay,reward,penalty,base:dr.base,total:dr.base+baseTrips+allowances+extraAllowance+standbyPay+rentalPay+reward-penalty,z:Object.fromEntries(zones.map(zone=>[zone,lines.filter(x=>x.zone===zone).reduce((s,x)=>s+x.count,0)]))};
}
function agg(ds){let a={count:0,standby:0,rental:0,allowances:0,extraAllowance:0,reward:0,penalty:0,total:0,z:Object.fromEntries(zones.map(z=>[z,0]))};for(const d of ds){const s=calc(d);for(const k of ['count','standby','rental','allowances','extraAllowance','reward','penalty','total'])a[k]+=s[k];for(const z of zones)a.z[z]+=s.z[z]}return a}
function monthText(){let [y,m]=state.month.split('-');return `${y} 年 ${Number(m)} 月`}
function renderKpi(){const s=agg(data());const items=[['配送總趟次',fmt(s.count),'依實際配送紀錄累加'],['值班班段',fmt(s.standby),'每一班段獨立計數'],['租車趟次',fmt(s.rental),'按當趟司機與實際車號'],['應計薪資（試算）',money(s.total),'包含月報設定的加給與獎懲']];$('kpis').innerHTML=items.map(x=>`<div class="kpi"><div class="kpi-label">${x[0]}</div><div class="kpi-value">${x[1]}</div><div class="kpi-caption">${x[2]}</div></div>`).join('')}
function visible(){let d=data().filter(x=>x.name.includes(state.search));if(state.sort==='trips')d.sort((a,b)=>calc(b).count-calc(a).count);else if(state.sort==='pay')d.sort((a,b)=>calc(b).total-calc(a).total);else if(state.sort==='allowance')d.sort((a,b)=>calc(b).allowances-calc(a).allowances);return d}
function renderSummary(){const ds=visible();$('rows').innerHTML=ds.map(dr=>{let s=calc(dr);const specials=s.lines.filter(x=>x.note||x.allowance);const label=specials.length?`${specials[0].zone}・${specials[0].region}${specials[0].allowance?` +${fmt(specials[0].allowance)}/趟`:''}${specials.length>1?' · 另 '+(specials.length-1)+' 項':''}`:'—';return `<tr tabindex="0" data-driver="${dr.id}" aria-label="查看${safe(dr.name)}月度薪資明細"><td>${safe(dr.name)}</td><td>${fmt(s.count)}</td>${zones.map(z=>`<td>${s.z[z]||'<span class="dim">—</span>'}</td>`).join('')}<td class="note" title="${safe(specials.map(x=>`${x.zone}${x.region}：${x.note}`).join('；'))}">${safe(label)}</td><td>${s.standby||'—'}</td><td>${s.rental||'—'}</td><td>${s.extraAllowance?money(s.extraAllowance):'—'}</td><td>${money(s.reward-s.penalty)}</td><td class="pay">${money(s.total)}</td></tr>`}).join('');
 const all=agg(ds);$('totals').innerHTML=`<tr class="total-row"><td>合計</td><td>${fmt(all.count)}</td>${zones.map(z=>`<td>${fmt(all.z[z])}</td>`).join('')}<td>—</td><td>${fmt(all.standby)}</td><td>${fmt(all.rental)}</td><td>${money(all.extraAllowance)}</td><td>${money(all.reward-all.penalty)}</td><td class="pay">${money(all.total)}</td></tr>`;$('rowcount').textContent=`顯示 ${ds.length} / ${data().length} 位司機`;
}
function renderRates(){$('rate-rows').innerHTML=zones.map(z=>`<tr><td>${z}</td>${regions.map(r=>`<td><button class="money-link" data-rate="${z}|${r}">${fmt(state.rates[z][r])}</button></td>`).join('')}</tr>`).join('');$('parameters').innerHTML=`<div class="config-item"><div><strong>值班津貼</strong><span>每一個有效值班班段</span></div><button data-param="standbyRate">${money(state.standbyRate)}</button></div><div class="config-item"><div><strong>租車補貼</strong><span>每趟；預設為 0</span></div><button data-param="rentalAllowance">${money(state.rentalAllowance)}</button></div>`}
function render(){ $('month-button').textContent=monthText();$('summary-pane').hidden=state.tab!=='summary';$('rates-pane').hidden=state.tab!=='rates';$('main-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));renderKpi();renderSummary();renderRates();if(state.selected!==null){if(driver())renderDetail();else closeDrawer()}}
function openDrawer(id){state.selected=id;state.detail='pay';state.subdate=null;$('scrim').classList.add('open');$('drawer').classList.add('open');renderDetail()}
function closeDrawer(){state.selected=null;state.subdate=null;$('scrim').classList.remove('open');$('drawer').classList.remove('open')}
function renderDetail(){const dr=driver();if(!dr)return;const s=calc(dr);$('drawer-name').textContent=dr.name;$('drawer-month').textContent=monthText();$('drawer-stats').innerHTML=`<div class="dstat"><div class="small">配送總趟次</div><div class="big">${fmt(s.count)} 趟</div></div><div class="dstat"><div class="small">應計薪資（試算）</div><div class="big yellow">${money(s.total)}</div></div>`;$('drawer-tabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.detail===state.detail));
 if(state.subdate){renderDay(dr,state.subdate);return}
 if(state.detail==='days'){renderDays(dr);return}
 const items=[['固定底薪',s.base,`<button class="tiny-link" data-base="${dr.id}">編輯</button>`],['配送趟次計酬',s.baseTrips,''],['溫層／地區職務加給',s.allowances,''],['其他薪資加給（單筆）',s.extraAllowance,''],[`值班津貼 ${s.standby} 班段 × ${money(state.standbyRate)}`,s.standbyPay,''],[`租車補貼 ${s.rental} 趟 × ${money(state.rentalAllowance)}`,s.rentalPay,''],['獎勵',s.reward,''],['懲處',-s.penalty,'']];
 $('drawer-body').innerHTML=`<div class="section-row"><h3>薪資計算明細</h3><span class="minor">NT$ · 示範單價</span></div><div class="breakdown">${items.map(([l,n,action])=>`<div class="line"><span class="label">${l} ${action}</span><span class="val">${money(n)}</span></div>`).join('')}<div class="line total"><strong>應計薪資合計</strong><strong class="val">${money(s.total)}</strong></div></div>
 <div class="section-row"><h3>溫層 × 地區 · 職務加給</h3><span class="minor">${s.lines.length} 種組合</span></div><p class="allowance-note">按當月各組合的配送趟數計算。選擇「編輯」設定此司機的每趟加給及備註。</p>${s.lines.map(row=>`<div class="detail-row"><div class="detail-row-header"><strong>${row.zone} · ${row.region}</strong><span class="wages">${row.count} 趟</span></div><div class="sub">趟次單價 ${money(row.baseRate)} × ${row.count} · 職務加給 ${money(row.allowance)}/趟</div><div class="detail-bottom"><span class="note-text">${safe(row.note)||'無備註'} · 小計 ${money(row.count*(row.baseRate+row.allowance))}</span><button class="tiny-link" data-allowance="${safe(row.key)}">編輯</button></div></div>`).join('')}${!s.lines.length?'<div class="empty">本月尚無配送紀錄</div>':''}
 <div class="section-row ledger-heading"><div><h3>其他薪資加給</h3><span class="minor">單筆加給，不重複計入每趟職務加給</span></div><button class="btn sm primary" data-new-extra>＋ 新增加給</button></div>
 ${(dr.extraAllowances||[]).map(x=>extraHtml(x)).join('')||'<div class="empty compact">本月沒有額外加給</div>'}
 <div class="section-row ledger-heading"><div><h3>獎勵與懲處</h3><span class="minor">${dr.adjustments.length} 筆 · 在月報維護</span></div><button class="btn sm primary" data-new-adjustment>＋ 新增獎懲</button></div>
 <div class="adj-summary"><span>獎勵 ${money(s.reward)}</span><span>懲處 ${money(-s.penalty)}</span><strong>淨額 ${money(s.reward-s.penalty)}</strong></div>${dr.adjustments.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>entryHtml(x)).join('')||'<div class="empty compact">本月沒有獎懲紀錄</div>'}
 <div class="read-only-hint">配送趟次、值班與租車從「每日出勤」帶入；薪資加給及獎懲僅在這裡編輯。可選擇對應出勤日期與趟次，方便對帳。</div>
 <div class="tip">此為示範費率的薪資試算，並非實領薪資；尚未納入加班、法定扣款及其他未確認的公司薪資規則。</div>`;
}
function renderDays(dr){let days=dr.days.slice().sort((a,b)=>b.date.localeCompare(a.date));$('drawer-body').innerHTML=`<div class="section-row"><h3>每日配送紀錄</h3><span class="minor">${days.length} 天有紀錄</span></div>${days.map(d=>{const mapped=zones.filter(z=>d.runs.some(x=>x.zone===z));return `<button class="day-row" data-day="${d.date}"><span><span class="date">${d.date.slice(5).replace('-',' / ')}</span><span class="minor">${mapped.join('、')||'無配送'}${d.standby?' · 值班 '+d.standby+' 班':''}</span></span><span class="arrow">${d.runs.length} 趟 ›</span></button>`}).join('')}`}
function renderDay(dr,date){const day=dr.days.find(x=>x.date===date);if(!day)return;const adj=dr.adjustments.filter(a=>a.date===date);const extras=(dr.extraAllowances||[]).filter(a=>a.date===date);$('drawer-body').innerHTML=`<button class="back" data-back>‹ 返回</button><div class="section-row"><h3>${date} · 配送明細</h3><span class="minor">${day.runs.length} 趟</span></div>${day.runs.map(run=>`<div class="trip"><div><strong>${safe(run.route)} · ${run.zone} / ${run.region}</strong><small>車號 ${safe(run.vehicle)} · ${safe(run.id)}</small></div>${run.rental?'<span class="pill">租車</span>':''}</div>`).join('')}<div class="section-row" style="margin-top:17px"><h3>值班</h3><span class="minor">${day.standby} 班段</span></div><div class="section-row" style="margin-top:17px"><h3>月報關聯的薪資加給</h3><span class="minor">${extras.length} 筆</span></div>${extras.map(x=>extraHtml(x,true)).join('')||'<div class="empty compact">無關聯加給</div>'}<div class="section-row" style="margin-top:17px"><h3>月報關聯的獎懲</h3><span class="minor">${adj.length} 筆</span></div>${adj.map(x=>entryHtml(x,true)).join('')||'<div class="empty compact">無關聯獎懲</div>'}<div class="read-only-hint">這裡顯示的是月報對該日的關聯資料。新增、編輯與刪除薪資加給／獎懲仍從「薪資明細」進行；不會修改「每日出勤」Dashboard。</div>`}
function sourceHtml(entry,readonly=false){const linked=entry.date?`<span>${safe(entry.date)}${entry.runId?` · ${safe(entry.runId)}`:''}</span>${readonly?'':`<button class="link" data-source="${safe(entry.date)}">查看出勤 ›</button>`}`:'<span>未指定出勤日期（當月項目）</span>';return `<div class="adj-source">${linked}</div>`}
function extraHtml(entry,readonly=false){return `<div class="adj"><div class="row"><strong>${safe(entry.reason)}</strong><span class="value">+ ${money(entry.amount)}</span></div>${sourceHtml(entry,readonly)}${readonly?'':`<div class="adj-tools"><button data-edit-extra="${safe(entry.id)}">編輯</button><button data-delete-extra="${safe(entry.id)}">刪除</button></div>`}</div>`}
function entryHtml(entry,readonly=false){return `<div class="adj"><div class="row"><strong>${entry.type==='reward'?'獎勵':'懲處'} · ${safe(entry.reason)}</strong><span class="value ${entry.type==='penalty'?'minus':''}">${entry.type==='reward'?'+':'−'} ${money(entry.amount)}</span></div>${sourceHtml(entry,readonly)}${readonly?'':`<div class="adj-tools"><button data-edit-adjustment="${safe(entry.id)}">編輯</button><button data-delete-adjustment="${safe(entry.id)}">刪除</button></div>`}</div>`}
function currentEntry(type,id){const dr=driver();return (type==='extra'?dr.extraAllowances:dr.adjustments).find(a=>a.id===id)}
function selectField(id,label,options,selected,help=''){return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(([v,t])=>`<option value="${safe(v)}" ${v===selected?'selected':''}>${safe(t)}</option>`).join('')}</select>${help?`<small>${help}</small>`:''}</div>`}
function linkFields(dr,entry={}){const dayOptions=[['','不指定（當月通用）'],...dr.days.map(d=>[d.date,d.date+' · '+d.runs.length+' 趟'])];return selectField('entry-date','對應出勤日期（選填）',dayOptions,entry.date||'')+`<div id="run-wrapper"></div>`}
function updateRunChoices(selected=''){const date=$('entry-date')?.value;if(!$('run-wrapper'))return;const day=driver().days.find(d=>d.date===date);$('run-wrapper').innerHTML=date&&day&&day.runs.length?selectField('entry-run','關聯趟次（選填）',[['','不指定特定趟次'],...day.runs.map(r=>[r.id,`${r.route} · ${r.zone} / ${r.region} · ${r.vehicle}`])],selected):''}

function openDialog(type,info={}){state.dialog={type,...info};let title='',desc='',fields='';const field=(name,label,value='',type='text',note='')=>`<div class="field"><label for="${name}">${label}</label>${type==='textarea'?`<textarea id="${name}" maxlength="160">${safe(value)}</textarea>`:`<input id="${name}" type="${type}" value="${safe(value)}" ${type==='number'?'min="0" step="1"':''}>`}${note?`<small>${note}</small>`:''}</div>`;
 if(type==='allowance'){const dr=driver();const [zone,region]=info.key.split('::');const val=dr.allowances[info.key]||{perTrip:0,note:''};title='職務加給與地區備註';desc=`${dr.name} · ${zone} / ${region}。金額為每趟計算。`;fields=field('unit','每趟職務加給（NT$）',val.perTrip,'number')+field('note','職務備註',val.note,'textarea');}
 else if(type==='base'){const dr=driver();title='固定底薪';desc=`${dr.name} · ${monthText()}`;fields=field('unit','本月底薪（NT$）',dr.base,'number','若不適用固定底薪，可維持 0。');}
 else if(type==='rate'){title='司機趟次單價';desc=`${info.zone} × ${info.region} 的司機計趟單價（非對客戶收費）。`;fields=field('unit','每趟計酬（NT$）',state.rates[info.zone][info.region],'number');}
 else if(type==='param'){title=info.param==='standbyRate'?'值班班段津貼':'租車補貼';desc='更新後會重新試算每位司機的薪資。';fields=field('unit','金額（NT$）',state[info.param],'number');}
 else if(type==='extra'||type==='adjustment'){const entry=info.id?currentEntry(type,info.id):null;const extra=type==='extra';title=(entry?'編輯':'新增')+(extra?'薪資加給':'獎懲紀錄');desc=`${driver().name} · ${monthText()}。在月度報表管理，不修改每日出勤。`;const kind=entry?.type||'reward';
  const moneyLabel=extra?'薪資加給金額（NT$）':kind==='penalty'?'懲處金額（NT$，請輸入正數）':'獎勵金額（NT$，請輸入正數）';
  const moneyHint=extra?'請輸入正數，金額將加入當月薪資。':kind==='penalty'?'例如輸入 200，系統會自動從薪資扣除 NT$200；不需要輸入負號。':'例如輸入 200，系統會自動增加 NT$200；不需要輸入加號。';
  fields=(extra?'':selectField('entry-type','類型',[['reward','獎勵'],['penalty','懲處']],kind))+field('unit',moneyLabel,entry?.amount??'','number',moneyHint)+field('note',extra?'加給原因／備註':'獎懲原因',entry?.reason||'','textarea')+linkFields(driver(),entry||{});}
 else if(type==='delete-extra'||type==='delete-adjustment'){const entry=currentEntry(type.replace('delete-',''),info.id);title='刪除這筆紀錄？';desc=`${driver().name} · ${safe(entry?.reason||'')} · ${money(entry?.amount||0)}。刪除後會立即重新試算。`;fields='<p class="delete-message">此操作只會刪除月報原型中的這筆金額紀錄，不影響每日出勤資料。</p>';}
 $('dialog-title').textContent=title;$('dialog-desc').textContent=desc;$('dialog-fields').innerHTML=fields;$('dialog-error').textContent='';$('dialog-form').querySelector('[type="submit"]').textContent=type.startsWith('delete-')?'確認刪除':'儲存';$('dialog-overlay').classList.add('show');$('dialog').classList.add('show');
 if(type==='extra'||type==='adjustment')updateRunChoices(info.id?currentEntry(type,info.id)?.runId||'':'');
}
function syncAdjustmentAmountLabel(){
 const select=$('entry-type'),amount=$('unit');if(!select||!amount)return;
 const isPenalty=select.value==='penalty';
 const label=$('dialog-fields').querySelector('label[for="unit"]');
 const hint=amount.closest('.field')?.querySelector('small');
 if(label)label.textContent=isPenalty?'懲處金額（NT$，請輸入正數）':'獎勵金額（NT$，請輸入正數）';
 if(hint)hint.textContent=isPenalty?'例如輸入 200，系統會自動從薪資扣除 NT$200；不需要輸入負號。':'例如輸入 200，系統會自動增加 NT$200；不需要輸入加號。';
}
function closeDialog(){state.dialog=null;$('dialog-overlay').classList.remove('show');$('dialog').classList.remove('show')}
function toAmount(){const raw=$('unit')?.value;if(raw===''||raw===undefined||!/^\d+$/.test(raw))return null;const n=Number(raw);return Number.isSafeInteger(n)&&n>=0&&n<=10000000?n:null}
let toastTimer;function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),1900)}
function saveDialog(e){e.preventDefault();const info=state.dialog;if(!info)return;
 if(info.type.startsWith('delete-')){const type=info.type.replace('delete-','');const dr=driver();const list=type==='extra'?dr.extraAllowances:dr.adjustments;const idx=list.findIndex(x=>x.id===info.id);if(idx>=0)list.splice(idx,1);closeDialog();persist();render();toast('已刪除月報紀錄');return}
 const n=toAmount();if(n===null||((info.type==='extra'||info.type==='adjustment')&&n===0)){$('dialog-error').textContent='請輸入正整數金額（例如 200）；獎勵自動加計，懲處自動扣除。一般費率及底薪可為 0。';return}
 if(info.type==='allowance'){driver().allowances[info.key]={perTrip:n,note:$('note').value.trim()}}
 else if(info.type==='base'){driver().base=n}
 else if(info.type==='rate'){state.rates[info.zone][info.region]=n}
 else if(info.type==='param'){state[info.param]=n}
 else if(info.type==='extra'||info.type==='adjustment'){
  const reason=$('note').value.trim(),date=$('entry-date').value,runId=$('entry-run')?.value||'';
  if(!reason){$('dialog-error').textContent='請輸入加給或獎懲的原因。';return}
  const type=info.type,dr=driver(),list=type==='extra'?dr.extraAllowances:dr.adjustments;
  let entry=info.id?list.find(x=>x.id===info.id):null;
  if(!entry){entry={id:`${type==='extra'?'EXTRA':'ADJ'}-MANUAL-${++state.serial}`};list.push(entry)}
  Object.assign(entry,{amount:n,reason,date,runId,...(type==='adjustment'?{type:$('entry-type').value}:{})});
 }
 closeDialog();persist();render();toast('已儲存，薪資已重新試算');
}
function shiftMonth(n){let [y,m]=state.month.split('-').map(Number);m+=n;if(m>12){y++;m=1}if(m<1){y--;m=12}state.month=`${y}-${pad(m)}`;closeDrawer();render()}
function exportCSV(){const ds=visible(),header=['月份','司機','總趟次',...zones,'地區/職務加給備註','值班班段','租車趟次','其他加給明細','獎懲明細','底薪','配送趟次計酬','職務加給','其他薪資加給','值班津貼','租車補貼','獎勵','懲處','應計薪資(試算)'];let body=ds.map(d=>{const s=calc(d);return [state.month,d.name,s.count,...zones.map(z=>s.z[z]),s.lines.filter(x=>x.allowance||x.note).map(x=>`${x.zone}/${x.region} ${x.note} +${x.allowance}/趟`).join('；'),s.standby,s.rental,(d.extraAllowances||[]).map(x=>`${x.reason}：${x.amount}${x.date?'@'+x.date:''}`).join('；'),d.adjustments.map(x=>`${x.type==='reward'?'獎勵':'懲處'} ${x.reason}：${x.amount}${x.date?'@'+x.date:''}`).join('；'),s.base,s.baseTrips,s.allowances,s.extraAllowance,s.standbyPay,s.rentalPay,s.reward,s.penalty,s.total]});const csv=[header,...body].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const file=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=`monthly-payroll-demo-${state.month}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已匯出 CSV')}
$('device').onclick=e=>{const btn=e.target.closest('[data-screen]');if(!btn)return;state.screen=btn.dataset.screen;$('stage').classList.toggle('mobile',state.screen==='mobile');$('device').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn))};
$('main-tabs').onclick=e=>{const btn=e.target.closest('[data-tab]');if(btn){state.tab=btn.dataset.tab;render()}};
$('prev').onclick=()=>shiftMonth(-1);$('next').onclick=()=>shiftMonth(1);
$('search').oninput=e=>{state.search=e.target.value.trim();renderSummary()};$('sort').onchange=e=>{state.sort=e.target.value;renderSummary()};
$('rows').onclick=e=>{const tr=e.target.closest('[data-driver]');if(tr)openDrawer(Number(tr.dataset.driver))};
$('rows').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){let tr=e.target.closest('[data-driver]');if(tr){e.preventDefault();openDrawer(Number(tr.dataset.driver))}}};
$('rate-rows').onclick=e=>{let btn=e.target.closest('[data-rate]');if(btn){let [zone,region]=btn.dataset.rate.split('|');openDialog('rate',{zone,region})}};
$('parameters').onclick=e=>{let btn=e.target.closest('[data-param]');if(btn)openDialog('param',{param:btn.dataset.param})};
$('drawer-close').onclick=closeDrawer;$('scrim').onclick=closeDrawer;
$('drawer-tabs').onclick=e=>{let btn=e.target.closest('[data-detail]');if(btn){state.detail=btn.dataset.detail;state.subdate=null;renderDetail()}};
$('drawer-body').onclick=e=>{let btn=e.target.closest('button');if(!btn)return;if(btn.hasAttribute('data-allowance')){openDialog('allowance',{key:btn.dataset.allowance})}else if(btn.hasAttribute('data-base')){openDialog('base')}else if(btn.hasAttribute('data-day')){state.subdate=btn.dataset.day;renderDetail()}else if(btn.hasAttribute('data-source')){state.subdate=btn.dataset.source;renderDetail()}else if(btn.hasAttribute('data-back')){state.subdate=null;renderDetail()}else if(btn.hasAttribute('data-new-extra')){openDialog('extra')}else if(btn.hasAttribute('data-new-adjustment')){openDialog('adjustment')}else if(btn.hasAttribute('data-edit-extra')){openDialog('extra',{id:btn.dataset.editExtra})}else if(btn.hasAttribute('data-edit-adjustment')){openDialog('adjustment',{id:btn.dataset.editAdjustment})}else if(btn.hasAttribute('data-delete-extra')){openDialog('delete-extra',{id:btn.dataset.deleteExtra})}else if(btn.hasAttribute('data-delete-adjustment')){openDialog('delete-adjustment',{id:btn.dataset.deleteAdjustment})}};
$('dialog-cancel').onclick=closeDialog;$('dialog-overlay').onclick=closeDialog;$('dialog-form').onsubmit=saveDialog;$('dialog-fields').addEventListener('change',e=>{if(e.target.id==='entry-type')syncAdjustmentAmountLabel();if(e.target.id==='entry-date')updateRunChoices()});$('export').onclick=exportCSV;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.dialog)closeDialog();else if(state.selected!==null)closeDrawer()}});
render();
})();
