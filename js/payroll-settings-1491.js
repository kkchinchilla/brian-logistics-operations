/* Brian-only rental settings. Route pay is maintained on 路線管理. */
(function(root){
 'use strict';let state=null;
 const engine=()=>root.PayrollReconciliation1491;
 const amount=n=>n===null||n===undefined?'待設定':Number(n).toLocaleString('zh-TW',{maximumFractionDigits:2});
 const setState=next=>{state=next;};
 function open(){
  if(!state||!finance())return;
  const selected=state,rates=selected.supplements.filter(r=>r.component==='rental'),revision=Math.max(0,...rates.map(r=>Number(r.id)));
  const label={rental:'租車費用（扣款／趟）'};
  const history=rates.slice().sort((a,b)=>b.effective_from.localeCompare(a.effective_from)||b.id-a.id).map(r=>`<tr><td>${esc(label[r.component])}</td><td>${amount(r.amount)}</td><td>${esc(r.effective_from)}</td><td>${esc(r.reason)}</td><td>#${r.id}</td></tr>`).join('');
  const current=Object.keys(label).map(k=>{const r=engine().selectSupplement(selected.supplements,k,selected.month+'-01');return `${label[k]}：${amount(r?.amount)}`;}).join('；');
  modal('租車費用設定',`<p class="note">配送趟次計酬使用「路線管理」的地區 × 溫層費率。租車費用適用所有司機，以配送日期選擇生效版本。</p><p>${esc(selected.month)} 月初：${esc(current)}</p>`+
   field('生效日','supplement-from',selected.month+'-01','date')+
   field('租車費用（NT$／趟，自薪資扣除）','supplement-rental','','number')+
   `<p class="note">金額請填正數或 0，系統依已結案租車配送趟數自動扣除。0 表示明確設為零。</p><label for="supplement-reason">變更原因（必填）</label><textarea class="field" id="supplement-reason" maxlength="2000" rows="3"></textarea><p class="note">新設定自生效日起套用，直到下一個生效版本。同日更正採最新版本，歷次紀錄保留；回溯生效日會更新該期間的月報試算。</p><details><summary>查看設定紀錄（${rates.length} 筆）</summary>${wrapTable(['項目','金額','生效日','原因','版本'],history)}</details>`,async()=>{
    if(!finance())throw Error('僅 Brian 可設定租車費用');
    const parse=id=>{const raw=chosen(id).trim();if(raw==='')return null;if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw))||Number(raw)>10000000)throw Error('金額請輸入 0 至 10,000,000 的整數；租車費用會自動扣除');return Number(raw);};
    const rental=parse('supplement-rental'),date=chosen('supplement-from'),reason=chosen('supplement-reason').trim();
    if(rental===null)throw Error('請填寫租車費用');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'1900-01-01'||date>'9998-12-31')throw Error('請選擇有效生效日');
    if(!reason||reason.length>2000)throw Error('請填寫 1 至 2000 字的變更原因');
    const {data,error}=await db.rpc('dashboard_save_rental_rate',{p_effective_from:date,p_amount:rental,p_reason:reason,p_expected_revision:revision});
    if(error)throw error;if(!data||!Number.isSafeInteger(Number(data.revision)))throw Error('設定回傳不完整，請重新整理確認');
    if(!await loadMonth())notify('設定已儲存，請重新載入月報。');else notify('租車費用設定已儲存。租車費用已按扣款計算。');
   });
  for(const id of ['supplement-rental']){const input=document.querySelector('#'+id);input.min='0';input.max='10000000';input.step='1';}
 }
 function detailHTML(id){
  const x=state?.report.summaries.find(x=>x.driverId===id);if(!x)return '';
  const lines=state.report.lines.filter(l=>l.driverId===id);
  const rows=lines.map(l=>`<tr><td class="sticky">${esc(l.date)}</td><td>${esc(l.kind==='per_run'?(l.routeName||'未保存路線名稱'):engine().componentLabels[l.kind]||l.kind)}</td><td>${esc(l.source)}</td><td>${esc(l.closeEventId||'—')}</td><td>${esc(l.ruleId||'—')}</td><td>${amount(l.amount)}</td></tr>`).join('');
  return `<section class="pricing-detail"><h3>薪資計算明細</h3><p class="note">配送計酬－租車費用＋加給／獎懲。配送與租車依結案紀錄計算；值班、跟車與學習僅統計出勤；路線費率取自路線管理目前設定。計算結果為目前應計薪資，並非已發薪紀錄。</p>${wrapTable(['配送計酬','租車費用（扣款）','加給／獎懲','應計薪資'],`<tr><td>${amount(x.variable)}</td><td>${amount(x.rentalDeduction)}</td><td>${amount(x.adjustment)}</td><td>${x.salary===null?(x.knownItemsReady?'待確認':'待設定'):amount(x.salary)}</td></tr>`)}${x.salary===null?`<p class="note">已知項目小計：${amount(x.basicSubtotal)}；仍有缺漏或待確認紀錄，不能當作應計薪資。</p>`:''}<details><summary>查看 ${lines.length} 筆計薪依據</summary>${wrapTable(['日期','項目／路線','來源','結案紀錄','費率來源／版本','金額'],rows)}</details><details open><summary>${x.issues.length} 項待確認</summary><ul class="pricing-issues">${x.issues.map(i=>`<li>${esc([i.date,i.source,i.message].filter(Boolean).join(' · '))}</li>`).join('')}</ul></details></section>`;
 }
 async function exportCSV(){
  const selectedMonth=month;if(!await loadMonth()||month!==selectedMonth||!state)return;
  const text=engine().csv(engine().exportRows(state.report));
  const u=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='計薪對帳_'+selectedMonth+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
 }
 root.PayrollSettings1491={setState,open,detailHTML,exportCSV};
})(typeof globalThis!=='undefined'?globalThis:this);
