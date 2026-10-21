/* Brian-only pricing controls and reconciliation inside the existing monthly dashboard. */
(function(root){
 'use strict';
 let state=null;
 const engine=()=>root.PayrollReconciliation149;
 const amount=n=>n===null||n===undefined?'待設定':Number(n).toLocaleString('zh-TW',{maximumFractionDigits:2});
 const person=id=>state.drivers.find(d=>d.id===id)?.display_name||'未列於司機名冊';
 const route=id=>state.routes.find(r=>String(r.id)===String(id))?.route_code||'路線 #'+id;
 const select=(label,id,body)=>`<label for="${id}">${label}</label><select class="field" id="${id}">${body}</select>`;
 const reason=(value='')=>`<label for="pricing-reason">依據／原因（必填）</label><textarea class="field" id="pricing-reason" maxlength="2000" rows="3">${esc(value)}</textarea>`;
 function checkedReason(){const v=chosen('pricing-reason').trim();if(!v||v.length>2000)throw Error('請填寫 1 至 2000 字的依據／原因');return v;}
 async function rpc(fn,args){if(!finance())throw Error('僅 Brian 可設定計薪');const {data,error}=await db.rpc(fn,args);if(error)throw error;if(!data||typeof data!=='object')throw Error('設定未成功回傳，請重新整理確認');return data;}
 async function refresh(){const ok=await loadMonth();if(!ok)notify('設定已儲存，但報表重新整理失敗；請重新載入頁面。');else notify('計薪設定已儲存，基本項目對帳已更新。');}
 function setState(next){state=next;}
 function render(){
  if(!state||!finance())return '';
  const {configs,rules,report,month}=state;
  const bases=state.drivers.map(d=>{const c=configs.find(c=>c.driver_id===d.id);return `<tr><td class="sticky">${esc(d.display_name)}</td><td>${esc(engine().basisLabels[c?.pay_basis]||'待設定')}</td><td class="pricing-note">${esc(c?.explanation||'尚未設定計酬依據')}</td><td>${d.active===false?'<span class="muted">已停用司機</span>':`<button class="rowlink" data-pricing-basis="${esc(d.id)}">${c?'編輯':'設定'}</button>`}</td></tr>`}).join('');
  const rates=rules.slice().sort((a,b)=>person(a.driver_id).localeCompare(person(b.driver_id),'zh-Hant')||b.effective_from.localeCompare(a.effective_from)||b.id-a.id).map(r=>`<tr><td class="sticky">${esc(person(r.driver_id))}</td><td>${esc(engine().componentLabels[r.component]||r.component)}</td><td>${r.route_id?esc(route(r.route_id)):'—'}</td><td>${amount(r.amount)}</td><td>${esc(r.effective_from)}<br>至 ${esc(r.effective_to||'持續有效')}</td><td>${r.active?(r.effective_from>month+'-31'?'尚未生效':r.effective_to&&r.effective_to<month+'-01'?'歷史期間':'啟用'):'已停用'}</td><td class="pricing-note">${esc(r.explanation)}</td><td>${r.active?`<button class="rowlink" data-pricing-replace="${r.id}">設定新費率</button><button class="rowlink" data-pricing-end="${r.id}">結束／停用</button>`:'—'}</td></tr>`).join('');
  const summary=report.summaries.map(x=>`<tr><td class="sticky">${esc(x.name)}</td><td>${esc(engine().basisLabels[x.basis]||'待設定')}</td><td>${x.count}</td><td>${amount(x.fixed)}</td><td>${amount(x.variable)}</td><td>${amount(x.adjustment)}</td><td>${amount(x.basicSubtotal)}</td><td><button class="rowlink" data-pricing-detail="${esc(x.driverId)}">${x.issues.length} 項待確認</button></td></tr>`).join('');
  return `<section class="panel pricing-section"><div class="panel-heading"><div><h2>司機計酬方式</h2><p>設定固定月薪、按趟或人工計算，並記錄依據。</p></div></div>${wrapTable(['司機','計酬方式','設定依據','操作'],bases)}</section>
   <section class="panel pricing-section"><div class="panel-heading"><div><h2>計薪費率與有效期間</h2><p>變更金額時新增生效期間，保留前期費率。配送客戶收費不會自動當成司機薪資。</p></div><button type="button" class="btn primary" id="pricing-add">＋ 新增費率</button></div>${wrapTable(['司機','項目','路線','金額（NT$）','有效期間','狀態','依據','操作'],rates)}</section>
   <section class="panel pricing-section"><div class="panel-heading"><div><h2>${esc(month)} 基本項目對帳</h2><p>固定月薪＋已結案路線計酬＋人工調整。以下小計不等於應計薪資。</p></div></div>${wrapTable(['司機','計酬方式','結案趟次','固定月薪','路線計酬','人工調整','基本項目小計','待確認'],summary)}<p class="note">地區／職務加給、租車、值班與特殊勤務的完整計薪規則尚待確認，應計薪資維持「待設定」。費率依出勤日期套用；固定月薪須有整月有效規則，月中異動不自行拆算。</p></section>`;
 }
 function bind(){
  document.querySelector('#pricing-add')?.addEventListener('click',()=>editRate());
  document.querySelectorAll('[data-pricing-basis]').forEach(b=>b.onclick=()=>editBasis(b.dataset.pricingBasis));
  document.querySelectorAll('[data-pricing-replace]').forEach(b=>b.onclick=()=>editRate(state.rules.find(r=>String(r.id)===b.dataset.pricingReplace)));
  document.querySelectorAll('[data-pricing-end]').forEach(b=>b.onclick=()=>endRate(state.rules.find(r=>String(r.id)===b.dataset.pricingEnd)));
  document.querySelectorAll('[data-pricing-detail]').forEach(b=>b.onclick=()=>{const id=b.dataset.pricingDetail;document.querySelector('#filter').value='';drawMonth();detail(id)});
 }
 function editBasis(id){
  const old=state.configs.find(c=>c.driver_id===id)||null;
  modal(person(id)+' · 計酬方式',select('計酬方式','pricing-basis',option('','請選擇',old?.pay_basis)+Object.entries(engine().basisLabels).map(([v,t])=>option(v,t,old?.pay_basis)).join(''))+reason(old?.explanation)+`<p class="note">這是目前對帳使用的計酬方式；歷史已發薪結果不在此頁重建。</p>`,async()=>{
   const value=chosen('pricing-basis');if(!Object.hasOwn(engine().basisLabels,value))throw Error('請選擇計酬方式');
   await rpc('dashboard_save_payroll_config',{p_driver_id:id,p_pay_basis:value,p_explanation:checkedReason(),p_expected:old});await refresh();
  });
 }
 function editRate(old){
  const selectedDriver=old?.driver_id||'',selectedComponent=old?.component||'per_run';
  const drivers=state.drivers.filter(d=>d.active!==false||d.id===selectedDriver);
  const routes=state.routes.filter(r=>r.active!==false||r.id===old?.route_id);
  modal(old?'設定新費率（保留前期）':'新增計薪費率',
   select('司機','pricing-driver',option('','請選擇',selectedDriver)+drivers.map(d=>option(d.id,d.display_name,selectedDriver)).join(''))+
   select('計薪項目','pricing-component',Object.entries(engine().componentLabels).map(([v,t])=>option(v,t,selectedComponent)).join(''))+
   select('路線','pricing-route',option('','請選擇',old?.route_id)+routes.map(r=>option(r.id,r.route_code,old?.route_id)).join(''))+
   field('金額（NT$，0 表示明確設定為零）','pricing-amount',old?.amount??'','number')+
   field('生效日','pricing-from',state.month+'-01','date')+field('結束日（可留空）','pricing-to',old?.effective_to||'','date')+reason()+
   (old?`<p class="note">原費率 NT$${amount(old.amount)}，自 ${esc(old.effective_from)} 生效。新費率儲存後，原費率結束日會設為新生效日前一天。</p>`:''),async()=>{
    const raw=chosen('pricing-amount');if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>10000000)throw Error('費率請輸入 0 至 10,000,000 的整數');
    const from=chosen('pricing-from'),to=chosen('pricing-to')||null,component=chosen('pricing-component');
    if(!chosen('pricing-driver')||!from||to&&to<from)throw Error('請完整選擇司機與有效日期');
    if(component==='per_run'&&!chosen('pricing-route'))throw Error('請選擇路線');
    await rpc('dashboard_add_payroll_rate',{p_driver_id:chosen('pricing-driver'),p_component:component,p_route_id:component==='per_run'?Number(chosen('pricing-route')):null,p_amount:Number(raw),p_effective_from:from,p_effective_to:to,p_explanation:checkedReason(),p_supersedes_id:old?.id||null,p_expected:old||null});await refresh();
   });
  const apply=()=>{document.querySelector('#pricing-route').disabled=!!old||chosen('pricing-component')==='fixed_monthly';};
  document.querySelector('#pricing-component').onchange=apply;
  if(old){document.querySelector('#pricing-driver').disabled=true;document.querySelector('#pricing-component').disabled=true;}
  document.querySelector('#pricing-amount').min='0';document.querySelector('#pricing-amount').max='10000000';document.querySelector('#pricing-amount').step='1';apply();
 }
 function endRate(old){
  if(!old)return;
  modal(person(old.driver_id)+' · 結束／停用費率',select('操作','pricing-action',option('end','設定最後適用日','end')+option('disable','整筆停用（不再套用任何日期）','end'))+field('最後適用日','pricing-end',old.effective_to||engine().dates(state.month).last,'date')+reason()+`<p class="note">結束期間會保留前期適用金額。整筆停用會從所有月份的對帳試算排除此費率；變更原因會留存。</p>`,async()=>{
   const end=chosen('pricing-action')==='end'?chosen('pricing-end'):null;if(end==='')throw Error('請選擇最後適用日');
   await rpc('dashboard_end_payroll_rate',{p_rule_id:old.id,p_expected:old,p_effective_to:end,p_reason:checkedReason()});await refresh();
  });document.querySelector('#pricing-action').onchange=()=>{document.querySelector('#pricing-end').disabled=chosen('pricing-action')==='disable';};
 }
 function detailHTML(id){
  const x=state?.report.summaries.find(x=>x.driverId===id);if(!x)return '';
  const lineRows=state.report.lines.filter(l=>l.driverId===id).map(l=>`<tr><td class="sticky">${esc(l.date)}</td><td>${esc(l.routeCode||engine().componentLabels[l.kind]||l.kind)}</td><td>${esc(l.source)}</td><td>${l.closeEventId||'—'}</td><td>${l.ruleId||'—'}</td><td>${l.notApplicable?'不適用':amount(l.amount)}</td></tr>`).join('');
  return `<section class="pricing-detail"><h3>基本項目對帳</h3><p class="note">依目前設定試算；應計薪資仍待完整規則確認。</p>${wrapTable(['固定月薪','路線計酬','人工調整','基本項目小計'],`<tr><td>${amount(x.fixed)}</td><td>${amount(x.variable)}</td><td>${amount(x.adjustment)}</td><td>${amount(x.basicSubtotal)}</td></tr>`)}<details><summary>查看 ${state.report.lines.filter(l=>l.driverId===id).length} 筆計薪依據</summary>${wrapTable(['日期','項目／路線','來源','結案紀錄','費率','基本項目金額'],lineRows)}</details><details open><summary>${x.issues.length} 項待確認</summary><ul class="pricing-issues">${x.issues.map(i=>`<li>${esc([i.date,i.source,i.message].filter(Boolean).join(' · '))}</li>`).join('')}</ul></details></section>`;
 }
 async function exportCSV(){
  const selectedMonth=month;if(!await loadMonth()||month!==selectedMonth||!state)return;
  const text=engine().csv(engine().exportRows(state.report));
  const u=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='計薪對帳_'+selectedMonth+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 root.PayrollSettings149={setState,render,bind,detailHTML,exportCSV};
})(typeof globalThis!=='undefined'?globalThis:this);
