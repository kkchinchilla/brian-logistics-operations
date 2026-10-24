let month=today().slice(0,7),drivers=[],runs=[],routes=[],adjustments=[],supplements=[],standby=[],monthlyDuties=[],reconciliation=null,sortMode="name";
async function loadPage(){if(!finance()){$('#page').innerHTML='<p class="empty">目前帳號未被授權查看薪資資料。</p>';return}drivers=await rows('profiles','id,display_name,role,active',q=>q.eq('role','driver'));routes=await rows('routes','id,route_name,temperature_zone,delivery_region_id,active');$('#head-actions').insertAdjacentHTML('afterbegin',`<div class="date-navigation"><button class="btn icon-nav" id="month-prev" aria-label="上個月">‹</button><input class="field" type="month" id="month" value="${month}" aria-label="報表月份"><button class="btn icon-nav" id="month-next" aria-label="下個月">›</button></div><button class="btn" id="supplement-settings">租車費用設定</button><button class="btn" id="export">匯出 CSV</button><button class="btn" id="export-reconciliation">匯出對帳 CSV</button>`);
$('#page').innerHTML=`<div id="month-panel"><section class="panel report-panel"><div class="panel-heading"><div><h2>司機月度統計</h2><p>由每日出勤彙整趟數、勤務及租車；加給與獎懲在本月報編輯</p></div><div class="report-filters"><label for="sort">姓名順序</label><select class="field" id="sort"><option value="name">姓名順序</option><option value="trips">趟次由高至低</option><option value="adjust">加給由高至低</option></select><input class="field search" id="filter" placeholder="搜尋司機" aria-label="搜尋司機"></div></div><div id="monthly-body"></div></section></div>`;
$('#month').onchange=e=>{month=e.target.value;loadMonth()};
const shiftMonth=dir=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+dir,1);month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');$('#month').value=month;loadMonth()};
$('#month-prev').onclick=()=>shiftMonth(-1);$('#month-next').onclick=()=>shiftMonth(1);
$('#filter').oninput=drawMonth;$('#sort').onchange=e=>{sortMode=e.target.value;drawMonth()};
$('#export').onclick=exportCSV;
$('#export-reconciliation').onclick=()=>PayrollSettings1491.exportCSV();
$('#supplement-settings').onclick=()=>PayrollSettings1491.open();
await loadMonth()}
const first=()=>month+'-01',last=()=>{let d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()+1);d.setDate(0);return d.toLocaleDateString('en-CA')};
let monthRequest=0,monthlyReady=false,closedDates=[];
async function loadMonth(){
 const request=++monthRequest,selectedMonth=month;
 monthlyReady=false;$('#export').disabled=true;$('#export-reconciliation').disabled=true;PayrollSettings1491.setState(null);
 $('#supplement-settings').disabled=true;
 document.querySelectorAll('#monthly-detail,#monthly-overlay').forEach(el=>el.remove());
 $('#monthly-body').innerHTML='<p class="note">讀取結案紀錄中…</p>';$('#stats').innerHTML='';
 try{
 PayrollReconciliation1491.dates(selectedMonth);
 const {data:bundle,error}=await db.rpc('dashboard_get_calculated_payroll',{p_month:selectedMonth+'-01'});
 if(error)throw error;
 if(!bundle||bundle.version!==1491||bundle.month!==selectedMonth+'-01'||!['route_rates','supplements','adjustments','expenses'].every(k=>Array.isArray(bundle[k])))throw Error('計薪對帳資料不完整，請確認 1.4.9.1 資料庫版本');
 const nextReport=PayrollServer1412.read(bundle,selectedMonth);
 if(request!==monthRequest||selectedMonth!==month)return false;
 runs=bundle.finalized.deliveries;standby=bundle.finalized.standby;monthlyDuties=bundle.finalized.special_work.filter(x=>['follow_along','learning'].includes(x.kind));closedDates=bundle.finalized.dates;
 adjustments=bundle.adjustments;supplements=bundle.supplements;reconciliation=nextReport;
 const known=new Set(drivers.map(d=>d.id));for(const row of nextReport.summaries)if(!known.has(row.driverId))drivers.push({id:row.driverId,display_name:row.name,active:false});
 PayrollSettings1491.setState({month:selectedMonth,drivers,routes,supplements,report:nextReport});monthlyReady=true;
 drawMonth();return true;
 }catch(error){if(request!==monthRequest)return false;monthlyReady=false;runs=[];standby=[];monthlyDuties=[];adjustments=[];supplements=[];displayed=[];closedDates=[];reconciliation=null;PayrollSettings1491.setState(null);
 console.error(error);$('#monthly-body').innerHTML='<p class="empty">無法讀取結案月報，請重新載入。未匯出任何資料。</p>';notify('無法讀取完整月報：'+(error.message||error));return false;
 }finally{if(request===monthRequest){$('#export').disabled=!monthlyReady;$('#export-reconciliation').disabled=!monthlyReady;$('#supplement-settings').disabled=!monthlyReady;}}
}

function report(d){
 const rr=runs.filter(r=>r.driver_id===d.id&&r.finalized===true),adj=adjustments.filter(a=>a.driver_id===d.id);
 const z={};rr.forEach(r=>{const zone=r.route_temperature_zone||'未設定';z[zone]=(z[zone]||0)+1});
 // Use the rental value frozen at closing; historical unknown stays unknown.
 const rental=rr.filter(r=>r.is_rental===true).length;
 const unknownRental=rr.filter(r=>r.is_rental===null||r.is_rental===undefined).length;
 const calculated=reconciliation.summaries.find(x=>x.driverId===d.id);
 const adjustment=calculated?.adjustment??0;
 return {d,rr,adj,z,rental,unknownRental,adjustment,calculated,standby:calculated?.standbyCount??0,followAlong:calculated?.followAlongCount??0,learning:calculated?.learningCount??0};
}
let displayed=[];
function drawMonth(){if(!monthlyReady)return;const term=($('#filter').value||'').toLowerCase();displayed=drivers.filter(d=>d.display_name.toLowerCase().includes(term)).map(report);if(sortMode==='trips')displayed.sort((a,b)=>b.rr.length-a.rr.length||a.d.display_name.localeCompare(b.d.display_name,'zh-Hant'));else if(sortMode==='adjust')displayed.sort((a,b)=>b.adj.filter(x=>x.category==='allowance').reduce((n,x)=>n+Number(x.amount),0)-a.adj.filter(x=>x.category==='allowance').reduce((n,x)=>n+Number(x.amount),0));else displayed.sort((a,b)=>a.d.display_name.localeCompare(b.d.display_name,'zh-Hant'));const all=displayed.reduce((n,x)=>({trips:n.trips+x.rr.length,standby:n.standby+x.standby,rental:n.rental+x.rental,unknown:n.unknown+x.unknownRental,adjust:n.adjust+x.adjustment}),{trips:0,standby:0,rental:0,unknown:0,adjust:0});
$('#stats').innerHTML=`<div class="kpi"><small>已結案配送總趟次</small><strong>${fmt(all.trips)}</strong></div><div class="kpi"><small>值班筆數</small><strong>${fmt(all.standby)}</strong></div><div class="kpi"><small>租車趟次</small><strong>${fmt(all.rental)}</strong>${all.unknown?`<small>${all.unknown} 趟租車狀態未確認</small>`:''}</div><div class="kpi"><small>薪資調整淨額</small><strong>${fmt(all.adjust)}</strong></div>`;
const pendingDates=closedDates.filter(d=>d.pending_reclose===true);
const pendingNote=pendingDates.length?`<p class="note" role="status"><strong>${pendingDates.length} 個日期重新開啟待結案：</strong>${pendingDates.map(d=>esc(d.service_date)).join('、')}。目前保留上次結案資料；再次「確認結案」後才會更新。</p>`:'';
const header=['司機','總趟數','值班','跟車','學習','租車','加給／獎勵','懲處','應計薪資'];const body=displayed.map(x=>`<tr><td class="sticky"><button class="rowlink" data-person="${x.d.id}">${esc(x.d.display_name)}</button></td><td>${x.rr.length}</td><td>${x.standby}</td><td>${x.followAlong}</td><td>${x.learning}</td><td>${x.rental}</td><td>${fmt(x.adj.filter(a=>a.category==='allowance').reduce((n,a)=>n+Number(a.amount),0))}</td><td>${fmt(x.adj.filter(a=>a.category!=='allowance').reduce((n,a)=>n+Number(a.amount),0))}</td><td${x.calculated?.salary==null?' class="muted"':''}>${x.calculated?.salary==null?(x.calculated?.knownItemsReady?'待確認':'待設定'):fmt(x.calculated.salary)}</td></tr>`).join('');$('#monthly-body').innerHTML=pendingNote+wrapTable(header,body)+`<p class="note">僅計入「結案」保存的配送紀錄（含有效加趟）；重新開啟後保留上次結案資料，再次「確認結案」後以最新資料取代，不重複計入。租車依結案快照，未知值不算租車。本月已納入 ${closedDates.filter(d=>d.status==='finalized').length} 個結案日期；${closedDates.filter(d=>d.attendance_status==='reopened'||d.status==='reopened').length} 個日期已重新開啟。路線計酬取自「路線管理」目前費率；值班、跟車及學習欄顯示已結案筆數，每筆依「費率表」的共用勤務費率計酬；租車費用扣款。點選司機查看各項金額及待確認事項。應計薪資＝配送計酬＋值班費用＋跟車費用＋學習費用－租車費用＋加給／獎懲。缺少配送、勤務或租車費率，或仍有待確認紀錄時，請點選司機查看原因。</p>`;
 document.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>detail(b.dataset.person))}
function detail(id){
 globalThis.DashboardTabs?.reset('monthly-detail');
 const x=displayed.find(x=>x.d.id===id);if(!x)return;
 const overlay=document.createElement('div');overlay.className='monthly-detail-overlay open';overlay.id='monthly-overlay';overlay.setAttribute('aria-hidden','true');
 const detail=document.createElement('aside');detail.className='monthly-detail open';detail.id='monthly-detail';detail.setAttribute('role','dialog');detail.setAttribute('aria-modal','true');detail.setAttribute('aria-label',x.d.display_name+' 月度薪資明細');
 const adjustments=x.adj.map(a=>`<tr><td>${esc(a.service_date)}</td><td>${a.category==='deduction'?'懲處':a.category==='allowance'?'加給／獎勵':'調整'}</td><td>${esc(a.reason)}</td><td>${fmt(a.amount)}</td><td><button class="rowlink" data-adj="${a.id}">編輯</button></td></tr>`).join('');
 const dutyRows=monthlyDuties.filter(w=>w.driver_id===id).slice().sort((a,b)=>a.service_date.localeCompare(b.service_date)).map(w=>`<tr><td>${esc(w.service_date)}</td><td>${w.kind==='follow_along'?'跟車':'學習'}</td><td>${esc(w.note||'—')}</td><td>${esc(w.id)}</td></tr>`).join('');
 const dayRows=x.rr.slice().sort((a,b)=>a.service_date.localeCompare(b.service_date)).map(r=>{
 return `<tr><td>${esc(r.service_date)}</td><td>${esc(r.route_name_snapshot||'未保存路線名稱')}</td><td>${r.is_rental===true?'租車':r.is_rental===false?'非租車':'未確認'}</td></tr>`;
}).join('');
detail.innerHTML=`<div class="monthly-detail-header"><div><div class="eyebrow">${esc(month)} / 月度出勤</div><h2>${esc(x.d.display_name)}</h2></div><button class="icon-close" type="button" id="close-detail" aria-label="關閉明細">×</button></div><div class="monthly-detail-body"><div class="drawer-stat-grid"><div class="kpi"><small>配送總趟次</small><strong>${x.rr.length}</strong></div><div class="kpi"><small>值班筆數</small><strong>${x.standby}</strong></div><div class="kpi"><small>租車趟次</small><strong>${x.rental}</strong>${x.unknownRental?`<small>${x.unknownRental} 趟未確認</small>`:''}</div><div class="kpi"><small>薪資調整淨額</small><strong>${fmt(x.adjustment)}</strong></div></div><div class="subtabs drawer-tabs"><button type="button" class="on" id="detail-salary">薪資明細</button><button type="button" id="detail-daily">每日出勤</button></div><section id="detail-salary-panel">${PayrollSettings1491.detailHTML(x.d.id)}<div class="panel-title" style="padding:12px 0">薪資加給與獎懲</div><div class="tools"><button class="btn primary" id="newAdj">＋ 新增加給／獎懲</button></div>${wrapTable(['日期','類型','事由','金額','操作'],adjustments)}<p class="note">懲處以負數入帳。地區或職務相關加給可登記於此；值班、跟車及學習依已結案筆數計酬。</p></section><section id="detail-daily-panel" hidden><div class="panel-title" style="padding:12px 0">本月已結案配送</div>${wrapTable(['日期','路線名稱','租車'],dayRows)}<div class="panel-title" style="padding:12px 0">本月已結案跟車／學習（每筆各計一次）</div>${wrapTable(['日期','勤務','備註','來源'],dutyRows)}<p class="note">僅顯示最近一次確認結案的資料。重新開啟後仍保留此版本；修改後再次確認結案，才會取代報表中的舊資料。</p></section></div>`;
const salary=detail.querySelector('#detail-salary'),daily=detail.querySelector('#detail-daily');
let detailTab='salary';
const selectDetailTab=next=>{
 globalThis.DashboardTabs?.record('monthly-detail',detailTab,next,selectDetailTab);detailTab=next;
 salary.classList.toggle('on',next==='salary');daily.classList.toggle('on',next==='daily');
 detail.querySelector('#detail-salary-panel').hidden=next!=='salary';detail.querySelector('#detail-daily-panel').hidden=next!=='daily';return true;
};
salary.onclick=()=>selectDetailTab('salary');daily.onclick=()=>selectDetailTab('daily');

 document.querySelectorAll('#monthly-detail,#monthly-overlay').forEach(el=>el.remove());
 document.body.append(overlay,detail);
 const close=()=>{overlay.remove();detail.remove()};
 overlay.onclick=close;detail.querySelector('#close-detail').onclick=close;
 detail.querySelector('#newAdj').onclick=()=>editAdj(x);
 detail.querySelectorAll('[data-adj]').forEach(b=>b.onclick=()=>editAdj(x,x.adj.find(a=>a.id==b.dataset.adj)));
}

function editAdj(x,a){const amount=Math.abs(Number(a?.amount||0));const category=a?.category==='deduction'?'deduction':'allowance';modal(a?'編輯薪資調整':'新增薪資加給或獎懲',`<label>類型</label><select class="field" id="adjcat">${option('allowance','薪資加給／獎勵',category)}${option('deduction','懲處（自動扣薪）',category)}</select>${field('日期','adjdate',a?.service_date||last(),'date')}${field('金額（NT$，請輸入正數）','adjamount',amount||'','number')}<div class="note" id="adj-help">選擇懲處時由系統自動扣除，不需要負號。</div>${field('事由','adjreason',a?.reason||'')}`,async()=>{const n=Number(chosen('adjamount'));if(!Number.isSafeInteger(n)||n<=0||n>10000000)throw Error('金額請輸入 1 至 10,000,000 的正整數');if(!chosen('adjreason').trim())throw Error('請填寫原因');if(!chosen('adjdate').startsWith(month))throw Error('請選擇目前報表月份內的日期');const c=chosen('adjcat');const payload={driver_id:x.d.id,service_date:chosen('adjdate'),category:c,amount:c==='deduction'?-n:n,reason:chosen('adjreason').trim(),recorded_by:currentUser.id};await save('payroll_adjustments',payload,a?{id:a.id}:null);await loadMonth();detail(x.d.id)})}
async function exportCSV(){
 const exportMonth=month;if(!await loadMonth()||month!==exportMonth||!monthlyReady)return;
 const zoneColumns=[...new Set(displayed.flatMap(x=>Object.keys(x.z)))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
 const header=['月份','司機','已結案總趟次',...zoneColumns.map(z=>`${z}趟次`),'值班筆數','跟車筆數','學習筆數','租車趟次','租車未確認趟次','薪資加給／獎勵','懲處','加給／獎懲淨額','配送計酬','值班費用','跟車費用','學習費用','租車費用（扣款）','應計薪資','待確認事項'];
 const body=displayed.map(x=>[month,x.d.display_name,x.rr.length,...zoneColumns.map(z=>x.z[z]||0),x.standby,x.followAlong,x.learning,x.rental,x.unknownRental,
  x.adj.filter(a=>a.category==='allowance').reduce((n,a)=>n+Number(a.amount),0),
  x.adj.filter(a=>a.category==='deduction').reduce((n,a)=>n+Number(a.amount),0),x.adjustment,x.calculated.variable??'待設定',x.calculated.standbyPay??'待設定',x.calculated.followAlongPay??'待設定',x.calculated.learningPay??'待設定',x.calculated.rentalDeduction??'待設定',x.calculated.salary??(x.calculated.knownItemsReady?'待確認':'待設定'),x.calculated.issues.map(i=>i.message).join('；')]);
 const quote=value=>{const raw=String(value??'');const safe=typeof value==='string'&&/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"'};
 const csv=[header,...body].map(row=>row.map(quote).join(',')).join('\r\n');
 try{await ReportExport.csv('月度出勤_'+month+'.csv','\ufeff'+csv)}catch(e){notify('匯出失敗：'+(e.message||String(e)))}
}
