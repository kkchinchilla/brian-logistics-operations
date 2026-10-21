/* v0.5 dynamic month-grid Excel export: no manual driver/route/template mapping.
 * Dates are paired (route code / plate); temperature rows expand per driver.
 * Route code is NOT asserted to be an approved payroll/attendance work code.
 * Old 45-slot fixed template is intentionally NOT used by this new exporter.
 */
(function(root,factory){
  const api=factory(root?.DispatchZoneReport);
  if(typeof module!=='undefined'&&module.exports)module.exports=factory(require('./zone_report.js'));
  if(root)root.ReportTemplateExport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(zoneReport){
  'use strict';
  const teal='FF176B66',light='FFE9F4F2',ink='FF24343A',amber='FF916A19';
  const safe=value=>{const s=String(value??'');return /^[\s]*[=+@\-]/.test(s)?"'"+s:s;};
  const days=(year,month)=>new Date(Date.UTC(year,month,0)).getUTCDate();
  const wd=['日','一','二','三','四','五','六'];
  const label=b=>zoneReport.rentalLabel(b);
  function styleTitle(ws,title,month,end){
    ws.mergeCells(1,1,1,end);const c=ws.getCell(1,1);c.value=safe(title);c.font={bold:true,color:{argb:'FFFFFFFF'},size:14};
    c.fill={type:'pattern',pattern:'solid',fgColor:{argb:teal}};ws.getRow(1).height=30;
    ws.mergeCells(2,1,2,end);const info=ws.getCell(2,1);info.value=`${month} · 試算草稿（未月結） · 路線編號不等於正式出勤／計酬代碼`;
    info.font={italic:true,color:{argb:amber},size:11};ws.getRow(2).height=22;
  }
  function header(cell){cell.font={bold:true,color:{argb:ink}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:light}};
    cell.alignment={vertical:'middle',horizontal:'center'};cell.border={bottom:{style:'thin',color:{argb:'FFD6E5E3'}}};}
  function newListSheet(wb,title,month,headers,rows,widths){
    const ws=wb.addWorksheet(title);styleTitle(ws,title,month,headers.length);
    headers.forEach((txt,i)=>{const c=ws.getRow(4).getCell(i+1);c.value=txt;header(c);});
    ws.getRow(4).height=24;
    for(const r of rows){const row=ws.addRow(r.map(x=>typeof x==='string'?safe(x):x));row.eachCell(c=>{c.alignment={vertical:'top',wrapText:true};});}
    widths.forEach((width,i)=>ws.getColumn(i+1).width=width);
    ws.views=[{state:'frozen',ySplit:4}];
    if(rows.length)ws.autoFilter={from:{row:4,column:1},to:{row:4+rows.length,column:headers.length}};
    return ws;
  }
  function makeRows({runs=[],executions=[],routes=[],drivers=[]}){
    const totals=zoneReport.buildSummary({runs,executions,routes,drivers});
    const byRoute=id=>routes.find(r=>String(r.id)===String(id));
    const byDriver=id=>drivers.find(r=>String(r.id)===String(id));
    const warnings=totals.warnings.map(reason=>({kind:'資料缺漏',reason}));
    const groups=new Map();
    const ensure=(id,zone,rental)=>{
      const k=`${id}\u0000${zone}\u0000${label(rental)}`;
      if(!groups.has(k))groups.set(k,{driverId:id,driver:byDriver(id)?.display_name||'未知司機',zone,rental,
        dateMap:new Map(),confirmedCount:0});
      return groups.get(k);
    };
    // Scheduled routes determine which temperature-zone rows exist, even if 0 confirmed.
    for(const r of runs){if(r.status==='cancelled')continue;
      const zone=r.temperature_zone_snapshot||(!r.finalized&&byRoute(r.route_id)?.temperature_zone)||'溫層待設定';
      ensure(r.driver_id,zone,r.is_rental);
    }
    for(const e of executions){
      if(e.finalized!==true&&e.review_status!=='confirmed'){
        warnings.push({kind:'趟次未確認',date:e.service_date,id:e.id,
          reason:`實際趟次 #${e.id} 狀態：${e.review_status}，未列入月出勤`});continue;
      }
      const zone=e.route_temperature_zone||(!e.finalized&&byRoute(e.route_id)?.temperature_zone)||'溫層待設定';
      const group=ensure(e.driver_id,zone,e.is_rental);group.confirmedCount++;
      const date=e.service_date;if(!group.dateMap.has(date))group.dateMap.set(date,[]);
      group.dateMap.get(date).push(e);
      if(zone==='溫層待設定')warnings.push({kind:'溫層未確認',date,id:e.id,reason:'結案趟次的溫層無法確定'});
      if(e.is_rental===null||e.is_rental===undefined)warnings.push({kind:'租車未確認',date,id:e.id,reason:'結案趟次沒有租車判定'});
    }
    return {groups:[...groups.values()].sort((a,b)=>a.driver.localeCompare(b.driver,'zh-TW')||a.zone.localeCompare(b.zone,'zh-TW')||label(a.rental).localeCompare(label(b.rental),'zh-TW')),
      summary:totals.rows,warnings};
  }
  async function exportTemplate({ExcelJS,month,data,display}){
    if(!ExcelJS||!zoneReport)throw Error('ExcelJS 或溫層報表模組尚未載入');
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('月份格式不正確');
    const [year,mo]=month.split('-').map(Number),numDays=days(year,mo);
    const wb=new ExcelJS.Workbook();wb.creator='配送趟次管理系統';wb.created=new Date();
    const {groups,warnings,summary}=makeRows(data);
    const d=wb.addWorksheet('出勤明細'),end=66;
    styleTitle(d,'月出勤明細｜依路線溫層自動分類',month,end);
    d.mergeCells(3,1,4,1);d.mergeCells(3,2,4,2);d.mergeCells(3,3,4,3);
    ['司機','溫層','是否租車'].forEach((t,i)=>{const c=d.getCell(3,i+1);c.value=t;header(c);});
    for(let day=1;day<=31;day++){
      const col=4+(day-1)*2,date=new Date(Date.UTC(year,mo-1,day));
      d.mergeCells(3,col,3,col+1);
      const c=d.getCell(3,col);c.value=day<=numDays?`${day}日（${wd[date.getUTCDay()]}）`:'—';header(c);
      for(const [offset,v] of [['0','路線編號'],['1','車號']]){const x=d.getCell(4,col+Number(offset));x.value=v;header(x);}
      d.getColumn(col).width=14;d.getColumn(col+1).width=14;
    }
    d.mergeCells(3,66,4,66);d.getCell(3,66).value='已結案趟次';header(d.getCell(3,66));
    d.getColumn(1).width=20;d.getColumn(2).width=15;d.getColumn(3).width=13;d.getColumn(66).width=16;
    d.getRow(3).height=24;d.getRow(4).height=23;
    d.views=[{state:'frozen',xSplit:3,ySplit:4}];
    let rr=5,mapped=0;
    const monthPrefix=month+'-';
    for(const g of groups){
      const maxSameDay=Math.max(1,...[...g.dateMap.values()].map(x=>x.length));
      for(let line=0;line<maxSameDay;line++){
        const row=d.getRow(rr++);row.getCell(1).value=safe(g.driver);row.getCell(2).value=safe(g.zone);
        row.getCell(3).value=label(g.rental);
        let subtotal=0;
        for(let day=1;day<=numDays;day++){
          const date=monthPrefix+String(day).padStart(2,'0'),run=g.dateMap.get(date)?.[line];
          if(!run)continue;
          const col=4+2*(day-1);
          row.getCell(col).value=safe(run.route_code_snapshot||(run.finalized?'未保存':display.route(run.route_id)));
          row.getCell(col+1).value=safe(run.finalized?(run.plate_snapshot||'未保存'):display.plate(run.vehicle_id));
          subtotal++;mapped++;
        }
        // Counts confirmed execution entries, not units of payable work.
        row.getCell(66).value=subtotal;
        row.eachCell({includeEmpty:false},cell=>{cell.alignment={vertical:'middle',wrapText:true};
          cell.border={bottom:{style:'hair',color:{argb:'FFE5EAEC'}}};});
        if(line===0){row.getCell(1).font={bold:true};row.getCell(2).font={bold:true};}
      }
    }
    if(!groups.length){d.getCell('A5').value='本月尚無派車或已結案趟次';}
    d.autoFilter={from:{row:4,column:1},to:{row:Math.max(5,rr-1),column:66}};
    // Payroll is a DRAFT: valid only for approved rates; do not infer work-code conversion.
    const payRows=(data.preview||[]).map(x=>[x.driver,x.count,x.variable??'待設定',x.rentalDeduction??'待設定',x.adjustment??'待設定',x.salary??(x.knownItemsReady?'待確認':'待設定'),(x.messages||[]).join('；')]);
    newListSheet(wb,'薪資統計',month,['司機','已結案趟次','配送計酬','租車費用（扣款）','加給／獎懲','應計薪資','待確認事項'],payRows,[20,16,20,22,20,20,62]);
    const parking=(data.expenses||[]).filter(x=>x.category!=='petty_cash').map(x=>[
      x.service_date,x.category==='parking'?'停車費':'交通費',x.driver_id?display.driver(x.driver_id):'—',
      x.vehicle_id?display.plate(x.vehicle_id):'—',Number(x.amount),x.description,x.reference||'']);
    const cash=(data.expenses||[]).filter(x=>x.category==='petty_cash').map(x=>[
      x.service_date,x.driver_id?display.driver(x.driver_id):'—',x.vehicle_id?display.plate(x.vehicle_id):'—',
      Number(x.amount),x.description,x.reference||'']);
    newListSheet(wb,'停車交通',month,['日期','分類','司機','車號','金額','說明','憑證編號'],parking,[17,16,20,18,17,50,22]);
    newListSheet(wb,'零用金',month,['日期','司機','車號','金額','說明','憑證編號'],cash,[17,20,18,17,50,22]);
    for(const e of (data.attendance||[]))warnings.push({kind:'出勤例外',date:e.service_date,id:e.id,
      reason:`${display.driver(e.driver_id)} / ${e.original_work_code||e.entry_type}：請由主管核對，不自動折算趟次或薪資`});
    for(const x of (data.preview||[]))if(x.messages?.length)warnings.push({kind:'薪資待確認',reason:`${x.driver}：${x.messages.join('；')}`});
    // Keep every special-work source in the workbook even before pay rules
    // are implemented. The traditional completed-run grid remains unchanged.
    const specialRows=[
      ...(data.specialShifts||[]).map(s=>[s.service_date,display.driver(s.driver_id),'值班班段',
        `${String(s.start_time).slice(0,5)}–${String(s.end_time).slice(0,5)}`,s.finalized?'已結案':s.review_status,`班段 #${s.id}`]),
      ...(data.specialWork||[]).map(w=>[w.service_date,display.driver(w.driver_id),
        ({attached_support:'附屬支援',breakdown_replacement:'故障接替',follow_along:'跟車'})[w.kind]||w.kind,
        `主線 #${w.run_id} / ${w.support_reference||''} / ${w.note}`,w.finalized?'已結案':w.review_status,
        w.kind==='follow_along'?(w.follow_stage_snapshot==='trainee'?'訓練：每日固定':'正式：依路線'):
        w.kind==='breakdown_replacement'?(w.replacement_payee==='both'?'C：雙方歸屬':'B：接替歸屬'):'待對帳'])
    ];
    if(specialRows.length){
      newListSheet(wb,'特殊勤務待對帳',month,['日期','司機','類型','內容','審核','計酬分類'],specialRows,[17,20,20,65,16,30]);
      warnings.push({kind:'特殊勤務待對帳',reason:`本月 ${specialRows.length} 筆特殊勤務，尚未併入月出勤與薪資正式結算`});
    }
    const issueRows=warnings.map(x=>[x.kind,x.date||'',x.id||'',x.reason]);
    newListSheet(wb,'未對應資料',month,['類別','日期','來源 ID','待確認原因'],issueRows,[20,18,17,100]);
    for(const sheet of wb.worksheets){sheet.eachRow({includeEmpty:false},row=>row.eachCell({includeEmpty:false},c=>{
      const value=c.value;if(typeof value==='number'&&!Number.isFinite(value))throw Error(`無效數值 ${sheet.name}!${c.address}`);
    }));}
    wb.calcProperties.fullCalcOnLoad=true;
    return {buffer:await wb.xlsx.writeBuffer(),mapped,unresolved:warnings.length,
      filename:`月出勤報表-動態溫層試算-${month}.xlsx`,summary};
  }
  return {exportTemplate,makeRows,days,safe};
});
