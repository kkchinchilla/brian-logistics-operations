/* 月出勤報表 v0.3 — draft reconciliation only.
 * Financial authority is enforced with Supabase RLS, not the HTML UI.
 * No attendance-code conversion or undocumented payroll rule is assumed.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {
    drivers: [], routes: [], vehicles: [], configs: [], rates: [],
    attendance: [], adjustments: [], expenses: [], executions: [],
    runs: [], specialWork: [], specialShifts: [], specialSummary: null, zoneSummary: [], zoneWarnings: [],
    preview: [], issues: [], month: '', settlement: null
  };
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const monthRange = value => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw Error('月份格式不正確');
    const [y,m] = value.split('-').map(Number);
    const n = new Date(Date.UTC(y,m,1));
    return {first: `${value}-01`, next: `${n.getUTCFullYear()}-${String(n.getUTCMonth()+1).padStart(2,'0')}-01`,
      last: `${value}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`};
  };
  const money = v => Number(v).toLocaleString('zh-TW', {minimumFractionDigits:0,maximumFractionDigits:2});
  const n = v => Number(v || 0);
  const safeText = v => String(v ?? '').replace(/^[\s]*[=+@\-]/, m => `'${m}`);
  const labels = {
    leave:'請假／休假', absence:'未出勤', substitution:'臨時代班', extra_work:'額外工作', other:'其他',
    pending:'待審核', confirmed:'已確認', rejected:'已退回',
    parking:'停車費', transportation:'交通費', petty_cash:'零用金',
    allowance:'補貼／加給', deduction:'扣款', manual_correction:'人工更正',
    fixed_monthly:'固定月薪', per_run:'路線每趟',
    fixed_only:'固定月薪', per_run_only:'按趟計酬', fixed_plus_run:'固定＋按趟', manual:'人工計算'
  };
  const lookup = (list, id, label, unknown='—') => list.find(v => String(v.id) === String(id))?.[label] || unknown;
  const driverName = id => lookup(state.drivers,id,'display_name','未知司機');
  const routeCode = id => lookup(state.routes,id,'route_code','未知路線');
  const plate = id => lookup(state.vehicles,id,'plate_number','—');
  function td(tr, value) { const cell = document.createElement('td'); cell.textContent = String(value ?? '—'); tr.appendChild(cell); return cell; }
  function renderRows(bodyId, values) {
    const body = $(bodyId); body.replaceChildren();
    for (const row of values) {
      const tr=document.createElement('tr'); row.forEach(value => td(tr,value)); body.appendChild(tr);
    }
    if (!values.length) {const tr=document.createElement('tr');const cell=td(tr,'目前沒有資料');cell.colSpan=body.closest('table').querySelectorAll('thead th').length;body.appendChild(tr);}
  }
  function feedback(message, error=false) {
    const el=$('finance-feedback');el.textContent=message;el.style.color=error?'#a33838':'#176b66';
  }
  function populate(id, list, key, label, blank='請選擇') {
    const select=$(id);select.replaceChildren();
    const first=new Option(blank,'');select.add(first);
    list.forEach(item => select.add(new Option(item[label],item[key])));
  }
  async function allRows(table, configure) {
    const rows=[], page=500;
    for(let from=0;from<15000;from+=page) {
      let query=db.from(table).select('*');
      if (configure) query=configure(query);
      const {data,error}=await query.order('id',{ascending:true}).range(from,from+page-1);
      if(error) throw error;
      rows.push(...(data||[]));
      if (!data || data.length<page) return rows;
    }
    throw Error(`資料量過大：${table} 超過分頁限制，請改用後端彙總。`);
  }
  async function master() {
    const [profiles,routes,vehicles] = await Promise.all([
      db.from('profiles').select('id,display_name,role,active').order('display_name'),
      db.from('routes').select('id,route_code,route_name,temperature_zone').order('route_code'),
      db.from('vehicles').select('id,plate_number,label').order('plate_number')
    ]);
    for(const item of [profiles,routes,vehicles]) if(item.error) throw item.error;
    state.drivers=profiles.data.filter(p=>p.role==='driver');state.routes=routes.data;state.vehicles=vehicles.data;
    const people=state.drivers.map(p=>({...p,label:p.display_name}));
    for(const id of ['attendance-driver','adjust-driver']) populate(id,people,'id','label');
    populate('expense-driver',people,'id','label','未指定');
    populate('expense-vehicle',state.vehicles.map(v=>({...v,label:v.plate_number})),'id','label','未指定');

  }
  async function verifyFinancePermission() {
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user) {location.href='index.html';return false;}
    const {data:profile,error:profileError}=await db.from('profiles')
      .select('display_name,role,active,can_manage_finance').eq('id',user.id).single();
    await DashboardAccess146.load();
    if(!DashboardAccess146.finance() || profileError || !profile || !profile.active || profile.role !== 'dispatcher' || !profile.can_manage_finance) {
      $('finance-blocked').hidden=false;return false;
    }
    $('finance-user').textContent=profile.display_name;
    $('finance-main').hidden=false;
    return true;
  }
  let monthlyRequest=0;
  async function refresh() {
    const request=++monthlyRequest;
    const month=$('finance-month').value;
    const {first,next}=monthRange(month);
    Object.assign(state,{month,executions:[],attendance:[],runs:[],specialWork:[],specialShifts:[],adjustments:[],expenses:[],rates:[],configs:[],preview:[],issues:[],zoneSummary:[],zoneWarnings:[],specialSummary:null,closingDates:[],payrollBundle:null});
    render();feedback('結案資料載入中...');
    const [response,settlement] = await Promise.all([
      db.rpc('dashboard_get_calculated_payroll',{p_month:first}),
      db.from('monthly_settlements').select('month_start,status,note').eq('month_start',first).maybeSingle()
    ]);
    if(response.error)throw response.error;
    const bundle=response.data;
    if(!bundle||bundle.version!==1491||bundle.month!==first||!['route_rates','supplements','adjustments','expenses'].every(k=>Array.isArray(bundle[k])))throw Error('計薪資料不完整');
    const {finalized,adjustments,expenses}=bundle;
    window.PayrollServer1412.read(bundle,month);
    if(settlement.error) throw settlement.error;
    const {deliveries:executions,attendance_records:attendance,original_runs:runs,special_work:specialWork,standby:specialShifts}=finalized;
    if(request!==monthlyRequest||month!==$('finance-month').value)throw Error('月份已變更，請重新載入');
    Object.assign(state,{month,executions,attendance,adjustments,expenses,payrollBundle:bundle,runs,settlement:settlement.data,specialWork,specialShifts,closingDates:finalized.dates});
    state.specialSummary=window.DispatchSpecialSummary.build({work:specialWork,shifts:specialShifts,runs,executions,drivers:state.drivers});
    const zones=window.DispatchZoneReport.buildSummary({runs,executions,routes:state.routes,drivers:state.drivers});
    state.zoneSummary=zones.rows;state.zoneWarnings=zones.warnings;
    $('finance-status').value=state.settlement?.status || 'draft';
    render(); feedback('資料已更新。');
  }
  function calculate() {
    const confirmed=state.executions.filter(e=>e.finalized===true);
    const result=state.payrollBundle?window.PayrollServer1412.read(state.payrollBundle,state.month):{summaries:[],issues:[]};
    const payroll=result.summaries.map(x=>({...x,driver:x.name,total:x.salary,messages:x.issues.map(i=>i.message)}));
    const issues=result.issues.map(i=>[i.driverId?driverName(i.driverId):'',i.date,i.message].filter(Boolean).join('：'));
    state.preview=payroll;state.issues=issues;
    return {confirmed,pending:(state.closingDates||[]).filter(d=>d.status==='reopened').length,issues,payroll};
  }
  function render() {
    const {confirmed,pending,issues,payroll}=calculate();
    $('finance-confirmed').textContent=confirmed.length;
    $('finance-pending').textContent=pending;
    $('finance-issues-count').textContent=issues.length;
    $('finance-expense-total').textContent=money(state.expenses.reduce((sum,e)=>sum+n(e.amount),0));
    const list=$('finance-issues');list.replaceChildren();
    if(!issues.length) { const li=document.createElement('li');li.textContent='目前沒有自動檢測到的缺漏（仍須核對來源 Excel 與人工規則）。';list.appendChild(li); }
    for(const issue of issues) {const li=document.createElement('li');li.textContent=issue;list.appendChild(li);}
    const value=v=>v===null?'待設定':money(v);
    renderRows('payroll-preview-body',payroll.map(p=>[p.driver,p.count,value(p.variable),value(p.rentalDeduction),value(p.adjustment),p.salary===null?(p.knownItemsReady?'待確認':'待設定'):value(p.salary),p.messages.join('；')]));
    renderRows('adjustments-body',state.adjustments.map(a=>[a.service_date,driverName(a.driver_id),labels[a.category],money(a.amount),a.reason]));
    renderRows('expenses-body',state.expenses.map(e=>[e.service_date,labels[e.category],e.driver_id?driverName(e.driver_id):'—',
      e.vehicle_id?plate(e.vehicle_id):'—',money(e.amount),e.description,e.reference||'—']));
    renderAttendance();
    $('finance-trainee-days').textContent=String(state.specialSummary?.traineeDays??0);
    renderRows('finance-special-body',(state.specialSummary?.entries||[]).map(x=>[
      x.date,x.driver,x.kind,x.description,x.status,x.payUnit]));
    renderRows('zone-summary-body',state.zoneSummary.map(z=>[
      z.driver,z.zone,z.assigned,z.confirmed,z.rental,z.nonRental,z.unknownRental]));
  }
  function renderAttendance() {
    const body=$('attendance-body');body.replaceChildren();
    for(const a of state.attendance) {
      const tr=document.createElement('tr');
      [a.service_date,driverName(a.driver_id),labels[a.entry_type],a.original_work_code||'—',a.note,a.finalized?'已結案':labels[a.review_status]]
        .forEach(x=>td(tr,x));
      const actions=document.createElement('td');tr.appendChild(actions);
      if(!a.finalized&&a.review_status==='pending') {
        for(const status of ['confirmed','rejected']) {
          const btn=document.createElement('button');btn.type='button';btn.className='finance-small-btn';
          btn.textContent=status==='confirmed'?'確認':'退回';
          btn.addEventListener('click',async()=>{
            let reason=null;
            if(status==='rejected'){
              reason=prompt('請輸入退回原因：');if(reason===null)return;
              reason=reason.trim();if(!reason){alert('請填寫原因');return;}
            }else if(!confirm('確認這筆出勤例外紀錄嗎？'))return;
            try{
              const {data,error}=await db.from('attendance_records')
                .update({review_status:status,review_note:reason})
                .eq('id',a.id).eq('review_status','pending').select('id');
              if(error)throw error;
              if(data.length!==1)throw Error('此紀錄已被異動，請重新整理。');
              await refresh();
            }catch(e){feedback(`審核失敗：${e.message}`,true);}
          });actions.appendChild(btn);
        }
      }else actions.textContent='—';
      body.appendChild(tr);
    }
    if(!state.attendance.length) {const tr=document.createElement('tr');const c=td(tr,'本月尚無出勤例外紀錄');c.colSpan=7;body.appendChild(tr);}
  }
  async function saveChange(table,values,mode='insert',id=null) {
    const {error}=mode==='update'?
      await db.from(table).update(values).eq('id',id):
      await db.from(table).insert(values);
    if(error)throw error;
    await refresh();
  }
  function installForm(id, table, build) {
    $(id).addEventListener('submit',async ev=>{
      ev.preventDefault();
      // Capture the form before awaiting: Event.currentTarget is cleared
      // when the browser finishes dispatching the synchronous event.
      const form=ev.currentTarget;
      const button=form.querySelector('button[type="submit"]');button.disabled=true;
      try{
        const values=build();await saveChange(table,values);form.reset();
        feedback('紀錄已成功儲存。');
      }catch(e){console.error(e);feedback(`儲存失敗：${e.message}`,true);}
      finally{button.disabled=false;}
    });
  }
  function dateValue(id){return $(id).value;}
  const selectedId = id => $(id).value || null;
  function bindForms() {
    installForm('attendance-form','attendance_records',()=>({
      service_date:dateValue('attendance-date'),driver_id:selectedId('attendance-driver'),
      entry_type:dateValue('attendance-type'),original_work_code:dateValue('attendance-code').trim()||null,
      note:dateValue('attendance-note').trim(),review_status:'pending'
    }));
    installForm('adjustment-form','payroll_adjustments',()=>{
      const amount=Number(dateValue('adjust-amount'));
      if(!Number.isFinite(amount)||amount===0)throw Error('調整金額不得為 0');
      const category=dateValue('adjust-type');
      if(category==='deduction' && amount>=0)throw Error('扣款必須使用負數');
      if(category==='allowance' && amount<=0)throw Error('補貼必須使用正數');
      return {service_date:dateValue('adjust-date'),driver_id:selectedId('adjust-driver'),category,
        amount,reason:dateValue('adjust-reason').trim()};
    });
    installForm('expense-form','expense_records',()=>{
      const amount=Number(dateValue('expense-amount'));
      if(!Number.isFinite(amount)||amount<0)throw Error('費用金額必須為非負數');
      return {service_date:dateValue('expense-date'),category:dateValue('expense-category'),
        driver_id:selectedId('expense-driver'),vehicle_id:selectedId('expense-vehicle')?Number(selectedId('expense-vehicle')):null,
        amount,description:dateValue('expense-description').trim(),reference:dateValue('expense-reference').trim()||null};
    });
  }
  async function saveReportStatus(){
    const {first}=monthRange($('finance-month').value);
    const requested=$('finance-status').value;
    if(requested==='review'&&state.issues.length) {
      alert('目前仍有待確認資料。請先處理「資料檢核」再送審。');
      $('finance-status').value=state.settlement?.status||'draft';return;
    }
    const {error}=await db.from('monthly_settlements').upsert({month_start:first,status:requested},{onConflict:'month_start'});
    if(error) {feedback(`狀態更新失敗：${error.message}`,true);return;}
    await refresh();feedback('報表狀態已更新；本版本不開放正式月結鎖定。');
  }
  function asXlsxText(value) {return typeof value==='string'?safeText(value):(value??'');}
  function styleSheet(ws,widths) {
    ws.views=[{state:'frozen',ySplit:4}];
    const last=widths.length;
    ws.mergeCells(1,1,1,last);
    ws.getCell(1,1).value='配送趟次管理系統｜月出勤報表（試算／未結算）';
    ws.getCell(1,1).font={bold:true,color:{argb:'FFFFFFFF'},size:14};
    ws.getCell(1,1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF176B66'}};
    ws.getRow(1).height=30;
    ws.mergeCells(2,1,2,last);ws.getCell(2,1).value=`月份：${state.month}　｜　此報表不等同人工完成範本，薪資／出勤代碼未確認處不得視為已結算`;
    ws.getCell(2,1).font={color:{argb:'FF9B6510'},bold:true};
    ws.getRow(4).height=23;
    ws.getRow(4).eachCell(cell=>{
      cell.font={bold:true,color:{argb:'FF1A2F3C'}};
      cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE8F4F3'}};
    });
    widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
    ws.autoFilter={from:{row:4,column:1},to:{row:4,column:last}};
  }
  function exportSheet(wb,title,headers,rows,widths) {
    const ws=wb.addWorksheet(title);
    ws.getRow(4).values=headers;
    for(const row of rows){ const next=ws.addRow(row.map(asXlsxText));next.alignment={vertical:'top',wrapText:true};}
    styleSheet(ws,widths);return ws;
  }
  async function exportOriginalTemplate() {
    const button=$('finance-template-export');button.disabled=true;button.textContent='產生動態月報中...';
    try {
      if(!window.ReportTemplateExport) throw Error('未載入原版型匯出程式');
      await refresh();
      const result=await window.ReportTemplateExport.exportTemplate({ExcelJS:window.ExcelJS,month:state.month,
        data:{runs:state.runs,executions:state.executions,attendance:state.attendance,
          expenses:state.expenses,preview:state.preview,routes:state.routes,drivers:state.drivers,
          specialWork:state.specialWork,specialShifts:state.specialShifts},
        display:{driver:driverName,route:routeCode,plate}});
      const blob=new Blob([result.buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=result.filename;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      feedback(`動態溫層月報已匯出：填入 ${result.mapped} 筆已結案趟次；另有 ${result.unresolved} 筆待檢核（請見「未對應資料」）。未正式月結。`);
    }catch(e){console.error(e);feedback(`動態月報匯出失敗：${e.message}`,true);}
    finally{button.disabled=false;button.textContent='匯出動態溫層月報 Excel';}
  }
  async function exportDraft() {
    const button=$('finance-export');button.disabled=true;button.textContent='產生檔案中...';
    try {
      if(!window.ExcelJS) throw Error('ExcelJS 套件未載入，請確認網路連線。');
      await refresh(); // no export from stale browser cache
      const exportMonth=state.month;
      const wb=new ExcelJS.Workbook();wb.creator='配送趟次管理系統';wb.created=new Date();
      const daily=[
        ...state.executions.map(x=>[x.service_date,driverName(x.driver_id),x.route_code_snapshot||'未保存',x.plate_snapshot||'未保存',
          x.route_temperature_zone||'', window.DispatchZoneReport.rentalLabel(x.is_rental), '結案配送','已結案',x.id,x.driver_notes||'']),
        ...state.attendance.map(x=>[x.service_date,driverName(x.driver_id),x.original_work_code||'',
          x.vehicle_id?plate(x.vehicle_id):'', '', '—',labels[x.entry_type],x.finalized?'已結案':labels[x.review_status], '',x.note||''])
      ].sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
      exportSheet(wb,'出勤明細',
        ['日期','司機','路線／原始代碼','車輛','溫層','是否租車','紀錄類型','審核狀態','來源紀錄 ID','備註'],
        daily,[16,20,22,19,13,13,18,14,17,48]);
      exportSheet(wb,'特殊勤務待對帳',
        ['日期','司機','類型','內容','狀態','計酬分類'],(state.specialSummary?.entries||[]).map(x=>[
          x.date,x.driver,x.kind,x.description,x.status,x.payUnit]),[16,20,20,70,24,42]);
      exportSheet(wb,'薪資統計',
        ['司機','已結案趟次','配送計酬','租車費用（扣款）','加給／獎懲','應計薪資','待確認事項'],
        state.preview.map(p=>[p.driver,p.count,p.variable??'待設定',p.rentalDeduction??'待設定',p.adjustment??'待設定',p.salary??(p.knownItemsReady?'待確認':'待設定'),p.messages.join('；')]),
        [20,16,20,18,18,18,22,20,20,52]);
      exportSheet(wb,'停車交通',
        ['日期','費用類別','司機','車號','金額','說明','單據編號'],
        state.expenses.filter(e=>e.category!=='petty_cash').map(e=>[
          e.service_date,labels[e.category],e.driver_id?driverName(e.driver_id):'',
          e.vehicle_id?plate(e.vehicle_id):'',n(e.amount),e.description,e.reference||''
        ]),[16,16,20,19,16,50,23]);
      exportSheet(wb,'零用金',
        ['日期','司機','車號','金額','用途','單據編號'],
        state.expenses.filter(e=>e.category==='petty_cash').map(e=>[
          e.service_date,e.driver_id?driverName(e.driver_id):'',e.vehicle_id?plate(e.vehicle_id):'',
          n(e.amount),e.description,e.reference||'']),[16,20,19,16,50,23]);
      const buffer=await wb.xlsx.writeBuffer();
      const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');
      a.href=url;a.download=`月出勤報表-試算版-${exportMonth}.xlsx`;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      feedback('已產生四個工作表的試算版 Excel。請注意：尚未套用公司正式代碼／薪資規則，也未複製原報表版型。');
    }catch(e){console.error(e);feedback(`匯出失敗：${e.message}`,true);}
    finally{button.disabled=false;button.textContent='匯出試算 Excel';}
  }
  async function init() {
    $('finance-month').value=today().slice(0,7);
    for(const key of ['attendance-date','adjust-date','expense-date']) $(key).value=today();
    $('finance-logout').addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html';});
    const authorized=await verifyFinancePermission();if(!authorized)return;
    try {await master();await refresh();bindForms();}
    catch(e){console.error(e);feedback(`初始資料載入失敗：${e.message}`,true);return;}
    $('finance-refresh').addEventListener('click',()=>refresh().catch(e=>feedback(`載入失敗：${e.message}`,true)));
    $('finance-month').addEventListener('change',()=>refresh().catch(e=>feedback(`載入失敗：${e.message}`,true)));
    $('finance-status').addEventListener('change',()=>saveReportStatus().catch(e=>feedback(e.message,true)));
    $('finance-export').addEventListener('click',exportDraft);
    $('finance-template-export').addEventListener('click',exportOriginalTemplate);
  }
  // Expose pure computations to our non-browser unit test harness only.
  if(typeof module!=='undefined' && module.exports) module.exports={
    monthRange,safeText,
    calculateForTests: inputs => { Object.assign(state, inputs); return calculate(); }
  };
  if(typeof document!=='undefined') init().catch(e=>{console.error(e);feedback(`系統初始化失敗：${e.message}`,true);});
})();
