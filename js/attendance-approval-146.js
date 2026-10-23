/* Requests never replace board values before the database commits approval. */
const requestStatus146={pending:'待審核',approved:'已核准',rejected:'已退回',stale:'需重新送審'};
const requestKind148=q=>q.request_kind==='duty'?(q.proposed_void?'刪除勤務':(q.base_record?.source?.kind==='empty'?'新增':'變更為')+dutyLabel1411(q.proposed_cell?.kind)):q.request_kind==='standby'?(q.proposed_void?'刪除值班':q.proposed_cell?.kind==='route'?'值班改為配送':q.base_record?.source?.kind==='empty'?'新增值班':q.base_record?.source?.kind==='standby'?'修改值班':'配送改為值班'):q.request_kind==='add'?'新增趟次':q.proposed_void?'刪除趟次':'修改趟次';
function paintApprovalButton146(){
 const n=attendanceRequests146.filter(q=>q.status==='pending').length;
 $('#approval-open').textContent=(supervisor()?'變更審核':'我的變更申請')+(n?` (${n})`:'');
}
function openApprovalInbox146(){
 if(!approvalReady146)return;
 const list=[...attendanceRequests146].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||b.id-a.id);
 modal(supervisor()?'變更審核':'我的變更申請',
  '<p class="note">列出所有日期的待審申請，以及目前出勤日期的審核結果。核准前，出勤表保留原紀錄。</p>'+
  `<div class="approval-list">${list.map(q=>`<button type="button" class="approval-item" data-request-id="${q.id}"><span><strong>${esc(name(q.driver_id))}</strong> · ${esc(q.service_date)} · ${esc(requestKind148(q))}<small>${esc(q.base_record?.source?.kind==='duty'?dutyLabel1411(q.base_record.kind):q.base_record?.source?.kind==='standby'?'值班':rt(q.base_record.route_id)?.route_name||'—')} → ${q.proposed_void?'申請刪除':esc(isDuty1411(q.proposed_cell?.kind)?dutyLabel1411(q.proposed_cell.kind):q.proposed_cell?.kind==='standby'?'值班':rt(q.proposed_route_id)?.route_name||'—')}</small></span><span>${esc(requestStatus146[q.status]||q.status)} ›</span></button>`).join('')||'<p class="empty">目前沒有變更申請</p>'}</div>`,async()=>{});
 $('#modal-save').hidden=true;
 document.querySelectorAll('[data-request-id]').forEach(b=>b.onclick=()=>{
  const q=list.find(q=>String(q.id)===b.dataset.requestId);if(q)openApprovalRequest146(q);
 });
}
function openApprovalRequest146(q){
 const pending=q.status==='pending',canReview=pending&&supervisor();
 const b=q.base_record||{};
 const row=(label,before,after)=>`<tr><th>${esc(label)}</th><td>${esc(before||'—')}</td><td>${esc(after||'—')}</td></tr>`;
 const beforeStandby=b.source?.kind==='standby',afterStandby=q.proposed_cell?.kind==='standby';
 const beforeDuty=b.source?.kind==='duty',afterDuty=isDuty1411(q.proposed_cell?.kind);
 const comparison=row('路線',beforeDuty?dutyLabel1411(b.kind):beforeStandby?'值班':rt(b.route_id)?.route_name,afterDuty?dutyLabel1411(q.proposed_cell.kind):afterStandby?'值班':rt(q.proposed_route_id)?.route_name)+
  (!(beforeDuty||beforeStandby)||!(afterDuty||afterStandby)?row('車號',beforeDuty||beforeStandby?'不指定':plate(b.vehicle_id),afterDuty||afterStandby?'不指定':plate(q.proposed_vehicle_id)):'')+
  (q.request_kind==='duty'?row('計酬單位',beforeDuty?'每筆紀錄':'',afterDuty?'每筆紀錄':''):'')+
  (['standby','duty'].includes(q.request_kind)?row('出勤欄位',q.attendance_category+q.attendance_slot_index,q.attendance_category+q.attendance_slot_index):'')+
  row('備註',b.note,q.proposed_note)+(q.request_kind==='add'?row('狀態','尚未新增',`申請新增 · ${q.attendance_category}${q.attendance_slot_index}`):q.proposed_void?row('狀態','有效','申請刪除'):'');
 modal(`${name(q.driver_id)} · ${q.service_date}`,
  `<p class="note">${esc(requestKind148(q))} · ${esc(requestStatus146[q.status]||q.status)} · 申請 #${q.id}</p>`+
  `<div class="scroll"><table class="approval-comparison"><thead><tr><th>項目</th><th>送審時紀錄</th><th>申請變更</th></tr></thead><tbody>${comparison}</tbody></table></div>`+
  (q.review_reason?`<p class="note">審核說明：${esc(q.review_reason)}</p>`:'')+
  (canReview?'<label for="approval-decision">審核結果</label><select class="field" id="approval-decision"><option value="approve">核准變更</option><option value="reject">退回申請</option></select>'+field('審核說明（退回時必填）','approval-reason',''):
   pending?'<p class="note">等待主管審核。原勤務紀錄尚未變更。</p>':''),async()=>{
   if(!canReview)return;
   const approve=chosen('approval-decision')==='approve',reason=chosen('approval-reason').trim();
   if(!approve&&!reason)throw Error('退回時請填寫原因');
   const {data,error}=await db.rpc('dashboard_review_attendance_change',{
    p_request_id:q.id,p_expected_revision:q.revision,p_approve:approve,p_reason:reason
   });
   if(error)throw error;
   await fetchBoard();notify(data.status==='stale'?'原紀錄已變更，此申請未套用；請司機重新送審。':data.already_reviewed?'此申請已由其他主管處理。':approve?'變更已核准並套用':'申請已退回，原紀錄保持不變');
  });
 $('#modal-save').hidden=!canReview;
 if(canReview){
  $('#modal-save').textContent='確認核准';
  $('#approval-decision').onchange=()=>{$('#modal-save').textContent=chosen('approval-decision')==='approve'?'確認核准':'確認退回';};
 }
}
