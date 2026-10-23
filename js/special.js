/* v0.5.5 phase 1 — supervisor-only, database-validated operational records. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = {runs:[], shifts:[], work:[], stages:[], drivers:[], vehicles:[], completions:[], executions:[]};
  const statusLabels = {pending:'待審核',confirmed:'已確認',rejected:'已退回'};
  const kinds = {attached_support:'附屬支援',breakdown_replacement:'故障接替',follow_along:'跟車'};
  const stages = {trainee:'訓練中',employed:'正式入職'};
  const stagePay = {trainee:'訓練每日固定',employed:'正式司機依路線'};
  const localDate = () => {const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;};
  const hhmm = value => String(value||'').slice(0,5)||'—';
  const person = id => state.drivers.find(d=>d.id===id)?.display_name || '—';
  const vehicle = id => state.vehicles.find(v=>String(v.id)===String(id))?.plate_number || '—';
  const run = id => state.runs.find(r=>String(r.id)===String(id));
  const message=(s,error=false)=>{const el=$('special-feedback');el.textContent=s;el.classList.toggle('is-error',error);};
  const cell=(tr,value)=>{const td=tr.insertCell();td.textContent=String(value??'—');return td;};
  function choose(id,items,labelFn,placeholder='請選擇') {
    const el=$(id), selected=el.value;
    el.replaceChildren(new Option(placeholder,''));
    for(const entry of items) el.add(new Option(labelFn(entry),String(entry.id)));
    if([...el.options].some(o=>o.value===selected)) el.value=selected;
  }
  function emptyRow(bodyId, text, cols){const tr=$(bodyId).insertRow();const el=cell(tr,text);el.colSpan=cols;}
  function formatRun(r){return `#${r.id} ${r.route_name_snapshot||r.routes?.route_name||'—'} / ${person(r.driver_id)} / ${vehicle(r.vehicle_id)} / ${hhmm(r.planned_start_time)}–${hhmm(r.planned_end_time)} (${r.status})`;}
  function findShiftResult(shift) {
    const matching=state.work.filter(w=>w.standby_shift_id===shift.id && ['attached_support','breakdown_replacement'].includes(w.kind));
    if(matching.some(w=>w.review_status==='confirmed')) return '已轉支援（本班不計值班）';
    if(matching.some(w=>w.review_status==='pending')) return '有待審核支援（暫不結算）';
    return shift.review_status==='confirmed'?'值班（已確認）':'待確認值班';
  }
  function actionButtons(row,table,id,record){
    if(record.review_status!=='pending'){cell(row,'—');return;}
    const td=cell(row,'');td.textContent='';
    const group=document.createElement('div');group.className='special-review-actions';td.appendChild(group);
    for(const next of ['confirmed','rejected']){
      const btn=document.createElement('button');btn.type='button';btn.className='finance-small-btn';btn.textContent=next==='confirmed'?'確認':'退回';
      btn.addEventListener('click',async()=>{
        let note=null;
        if(next==='rejected') { note=window.prompt('請填寫退回原因：');if(note===null)return;note=note.trim();if(!note){message('退回必須填寫原因。',true);return;} }
        else if(!window.confirm(`確定確認此筆${table==='v055_standby_shifts'?'值班':'特殊勤務'}紀錄嗎？`))return;
        btn.disabled=true;
        try{
          const {data,error}=await db.from(table).update({review_status:next,review_note:note})
            .eq('id',id).eq('review_status','pending').select('id');
          if(error)throw error;
          if(data.length!==1)throw Error('紀錄已被修改，請重新整理。');
          await reload();message(next==='confirmed'?'審核成功。':'紀錄已退回。');
        } catch(e){message(`審核失敗：${e.message}`,true);btn.disabled=false;}
      });group.appendChild(btn);
    }
  }
  function render(){
    for(const body of ['stage-rows','standby-rows','work-rows'])$(body).replaceChildren();
    const day=$('special-date').value;
    const byStage=state.stages.slice().sort((a,b)=>b.effective_from.localeCompare(a.effective_from));
    for(const s of byStage){const tr=$('stage-rows').insertRow();[s.effective_from,person(s.driver_id),stages[s.stage],s.reason].forEach(v=>cell(tr,v));}
    if(!byStage.length)emptyRow('stage-rows','尚無任職階段資料',4);
    for(const s of state.shifts){
      const tr=$('standby-rows').insertRow();
      [person(s.driver_id),`${hhmm(s.start_time)}–${hhmm(s.end_time)}`,'排定值班',findShiftResult(s),statusLabels[s.review_status]].forEach(v=>cell(tr,v));
      actionButtons(tr,'v055_standby_shifts',s.id,s);
    }
    if(!state.shifts.length)emptyRow('standby-rows','當日尚無值班排定',6);
    for(const w of state.work){
      const tr=$('work-rows').insertRow();
      const parent=run(w.run_id);
      const submission=state.completions.find(c=>c.work_id===w.id);
      const execution=state.executions.find(e=>e.run_id===w.run_id);
      const isReplacement=w.kind==='breakdown_replacement';
      const wrongAttribution=isReplacement && execution && (execution.driver_id!==w.driver_id || Number(execution.vehicle_id)!==Number(w.vehicle_id));
      const classification=w.kind==='follow_along'?stagePay[w.follow_stage_snapshot]:w.kind==='breakdown_replacement'?(w.replacement_payee==='both'?'C：雙方計入':'B：接替司機計入'):'支援趟次（費率待定）';
      [parent?formatRun(parent):`#${w.run_id}`,w.support_reference?`${kinds[w.kind]}：${w.support_reference}`:kinds[w.kind],person(w.driver_id),vehicle(w.vehicle_id),
        w.standby_shift_id?`班段 #${w.standby_shift_id}`:'—',classification,
        submission?`已回報（${new Date(submission.completed_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}）`:'尚未回報',
        statusLabels[w.review_status]].forEach(v=>cell(tr,v));
      const actionTd=tr.insertCell();
      actionTd.className='special-work-actions-cell';
      const actionGroup=document.createElement('div');
      actionGroup.className='special-work-actions';
      actionTd.appendChild(actionGroup);
      if(w.review_status==='pending' && w.kind==='breakdown_replacement' && submission && parent && parent.status!=='completed'){
        const btn=document.createElement('button');
        btn.type='button';btn.className='finance-small-btn special-work-finalize';
        btn.textContent='結束主線並送審';
        btn.addEventListener('click',async()=>{
          if(!window.confirm(`接替司機已回報完成。確定結束原始趟次 #${w.run_id} 並建立待審核的實際配送嗎？`))return;
          btn.disabled=true;
          try{
            const {error}=await db.rpc('v055_finalize_replacement',{p_work_id:w.id});
            if(error)throw error;
            await reload();message('主線已結束。請先核對實際司機與車輛，再至每日派車看板「實際趟次審核」確認，最後回此頁確認勤務。');
          }catch(e){message(`結束主線失敗：${e.message}`,true);btn.disabled=false;}
        });
        actionGroup.appendChild(btn);
      }
      if(isReplacement && submission && execution){
        const indicator=document.createElement('span');
        indicator.textContent=wrongAttribution
          ? '警示：主線實際紀錄仍是原派司機／車輛，必須先校正。'
          : `實際歸屬已核對（${statusLabels[execution.review_status]||execution.review_status}）`;
        indicator.className=wrongAttribution?'special-work-alert':'special-work-note';
        actionGroup.appendChild(indicator);
      }
      if(wrongAttribution && submission){
        const fix=document.createElement('button');
        fix.type='button';fix.className='finance-small-btn special-work-fix';
        fix.textContent='稽核校正實際司機／車輛';
        fix.addEventListener('click',async()=>{
          const reason=window.prompt(`要將主線 #${w.run_id} 的實際司機／車輛，從原派車資料校正為 ${person(w.driver_id)}／${vehicle(w.vehicle_id)}。\n請輸入至少 10 字的校正原因（不可撤銷）：`);
          if(reason===null)return;
          if(reason.trim().length<10){message('校正原因至少 10 字。',true);return;}
          if(!window.confirm('此動作會保留原派紀錄及新增不可修改的校正稽核，並更新實際趟次統計。確定？'))return;
          fix.disabled=true;
          try{
            const {data,error}=await db.rpc('v05512_reconcile_replacement_execution',
              {p_work_id:w.id,p_reason:reason.trim()});
            if(error)throw error;
            await reload();
            message(data?.state==='already_correct'?'實際司機／車輛原已正確。':'校正完成；原派車與歷史審核紀錄保留。B／C 薪資仍待下一階段對帳。');
          }catch(e){message(`校正失敗：${e.message}`,true);fix.disabled=false;}
        });
        actionGroup.appendChild(fix);
      }
      if(w.review_status==='pending'){
        for(const next of ['confirmed','rejected']){
          const btn=document.createElement('button');btn.type='button';btn.className='finance-small-btn '+(next==='confirmed'?'special-work-confirm':'special-work-reject');
          btn.textContent=next==='confirmed'?'確認勤務':'退回';
          if(next==='confirmed' && isReplacement && (!execution || wrongAttribution || execution.review_status!=='confirmed'))btn.disabled=true;
          btn.addEventListener('click',async()=>{
            let note=null;
            if(next==='rejected') {note=window.prompt('請填寫退回原因：');if(note===null)return;note=note.trim();if(!note){message('退回必須填寫原因。',true);return;}}
            else if(!window.confirm('確認此筆特殊勤務？必須已有司機回報，且主線實際執行已經主管確認。'))return;
            btn.disabled=true;
            try{
              const {data,error}=await db.from('v055_run_work').update({review_status:next,review_note:note})
                .eq('id',w.id).eq('review_status','pending').select('id');
              if(error)throw error;
              if(data.length!==1)throw Error('紀錄已被修改，請重新整理。');
              await reload();message(next==='confirmed'?'特殊勤務已確認。':'特殊勤務已退回。');
            }catch(e){message(`審核失敗：${e.message}`,true);btn.disabled=false;}
          });
          actionGroup.appendChild(btn);
        }
      }else if(!actionGroup.children.length){actionGroup.textContent='—';}
    }
    if(!state.work.length)emptyRow('work-rows','當日尚無特殊勤務',9);
    choose('work-parent',state.runs.filter(r=>r.status!=='cancelled'),formatRun);
    updateWorkFields();
  }
  async function fetchAll(table, query){
    const {data,error}=await query;
    if(error)throw Error(`${table}：${error.message}`);
    return data||[];
  }
  async function reload(){
    const day=$('special-date').value;
    if(!/^\d{4}-\d\d-\d\d$/.test(day))throw Error('請先選擇管理日期。');
    const [runs,shifts,work,stages]=await Promise.all([
      fetchAll('runs',db.from('runs').select('id,service_date,status,driver_id,vehicle_id,route_name_snapshot,planned_start_time,planned_end_time,routes(route_name)').eq('service_date',day).order('planned_start_time')),
      fetchAll('v055_standby_shifts',db.from('v055_standby_shifts').select('*').eq('service_date',day).order('start_time')),
      fetchAll('v055_run_work',db.from('v055_run_work').select('*').eq('service_date',day).order('id')),
      fetchAll('v055_driver_stages',db.from('v055_driver_stages').select('*').order('effective_from',{ascending:false}).limit(2000))
    ]);
    const ids=work.map(w=>w.id);
    const runIds=[...new Set(work.map(w=>w.run_id))];
    const executions=runIds.length?await fetchAll('trip_executions',
      db.from('trip_executions').select('id,run_id,driver_id,vehicle_id,review_status').in('run_id',runIds)):[];
    const completions=ids.length?await fetchAll('v055_driver_work_completions',
      db.from('v055_driver_work_completions')
        .select('work_id,driver_id,completed_at,completion_note').in('work_id',ids)):[];
    Object.assign(state,{runs,shifts,work,stages,completions,executions});render();
  }
  function updateWorkFields(){
    const kind=$('work-kind').value,parent=run($('work-parent').value);
    $('work-payee-wrap').hidden=kind!=='breakdown_replacement';
    $('work-reference-wrap').hidden=kind!=='attached_support';
    $('work-reference').required=kind==='attached_support';
    $('work-standby-wrap').hidden=kind==='follow_along';
    $('work-kind-hint').textContent={
      attached_support:'附屬支援會自動沿用主線司機與車輛；與主線時間重疊不算獨立派車衝突。',
      breakdown_replacement:'故障接替必須改用其他司機與車輛，預設只計接替司機；真正歸屬需在後續薪資整合前核對。',
      follow_along:'跟車須選擇另一位司機，與主線共用車輛；當日訓練／入職階段由資料庫自動決定。'
    }[kind];
    const isSame=kind==='attached_support';
    $('work-driver').disabled=isSame;
    $('work-vehicle').disabled=kind!=='breakdown_replacement';
    if(parent && (isSame||kind==='follow_along'))$('work-vehicle').value=String(parent.vehicle_id);
    if(parent && isSame)$('work-driver').value=parent.driver_id;
    const selectedDriver=kind==='attached_support'?parent?.driver_id:$('work-driver').value;
    const shiftChoices=state.shifts.filter(s=>s.review_status!=='rejected' && s.driver_id===selectedDriver);
    choose('work-standby',kind==='follow_along'?[]:shiftChoices,
      s=>`#${s.id} ${person(s.driver_id)} ${hhmm(s.start_time)}–${hhmm(s.end_time)}`,'沒有值班關聯');
    if(kind==='follow_along')$('work-standby').value='';
    else if(shiftChoices.length===1 && !$('work-standby').value)$('work-standby').value=String(shiftChoices[0].id);
    if(kind==='breakdown_replacement' && parent && $('work-driver').value===parent.driver_id)$('work-driver').value='';
  }
  async function save(table,payload,form){
    try{
      const {error}=await db.from(table).insert(payload);
      if(error)throw error;
      form.reset();await reload();message('紀錄已新增，等待主管審核。');
    } catch(e){message(`儲存失敗：${e.message}`,true);}
  }
  function bind(){
    $('special-refresh').addEventListener('click',async()=>{try{await reload();message('資料已更新。');}catch(e){message(e.message,true);}});
    $('special-date').addEventListener('change',async()=>{try{await reload();message('');}catch(e){message(e.message,true);}});
    $('work-kind').addEventListener('change',updateWorkFields);
    $('work-parent').addEventListener('change',updateWorkFields);
    $('work-driver').addEventListener('change',updateWorkFields);
    $('stage-form').addEventListener('submit',e=>{e.preventDefault();save('v055_driver_stages',{
      driver_id:$('stage-driver').value,effective_from:$('stage-from').value,stage:$('stage-value').value,reason:$('stage-reason').value.trim()},e.currentTarget);});
    $('standby-form').addEventListener('submit',e=>{e.preventDefault();save('v055_standby_shifts',{
      service_date:$('special-date').value,driver_id:$('standby-driver').value,start_time:$('standby-start').value,
      end_time:$('standby-end').value,note:$('standby-note').value.trim()},e.currentTarget);});
    $('work-form').addEventListener('submit',e=>{
      e.preventDefault();const parent=run($('work-parent').value),kind=$('work-kind').value;
      if(!parent){message('請先選擇原始趟次。',true);return;}
      const payload={run_id:parent.id,service_date:parent.service_date,kind,
        driver_id:kind==='attached_support'?parent.driver_id:$('work-driver').value,
        vehicle_id:kind==='breakdown_replacement'?Number($('work-vehicle').value):parent.vehicle_id,
        standby_shift_id:kind==='follow_along'||!$('work-standby').value?null:Number($('work-standby').value),
        replacement_payee:kind==='breakdown_replacement'?$('work-payee').value:null,
        support_reference:kind==='attached_support'?$('work-reference').value.trim():null,
        note:$('work-note').value.trim()};
      save('v055_run_work',payload,e.currentTarget);
    });
    $('special-logout').addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html';});
  }
  async function init(){
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user){location.href='index.html';return;}
    const {data:profile,error:pe}=await db.from('profiles').select('display_name,role,active').eq('id',user.id).single();
    if(pe||!profile?.active||profile.role!=='dispatcher'){$('special-blocked').hidden=false;return;}
    $('special-user').textContent=profile.display_name;
    $('special-main').hidden=false;
    bind();
    const [drivers,vehicles]=await Promise.all([
      fetchAll('profiles',db.from('profiles').select('id,display_name').eq('role','driver').eq('active',true).order('display_name')),
      fetchAll('vehicles',db.from('vehicles').select('id,plate_number').eq('active',true).order('plate_number'))
    ]);
    state.drivers=drivers;state.vehicles=vehicles;
    for(const id of ['stage-driver','standby-driver','work-driver'])choose(id,drivers,d=>d.display_name);
    choose('work-vehicle',vehicles,v=>v.plate_number);
    $('special-date').value=localDate();$('stage-from').value=localDate();
    await reload();message('資料已載入。');
  }
  init().catch(e=>{console.error(e);message(`初始化失敗：${e.message}。請先確認 SQL 06 已安裝。`,true);});
})();
