/* v0.5 — route master administration. All user-visible content Traditional Chinese. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const inputs={route_code:'route-code-input',route_name:'route-name-input',temperature_zone:'route-zone-input',
    default_start_time:'route-start-input',default_end_time:'route-end-input'};
  let editingId=null,rows=[];
  const text=(parent,value)=>{parent.textContent=String(value??'');};
  const feedback=(s,bad=false)=>{const el=$('route-form-feedback');text(el,s);el.style.color=bad?'#a33838':'#1f6b46';};
  function resetForm(){editingId=null;$('route-management-form').reset();$('routes-form-title').textContent='新增配送路線';
    $('route-save').textContent='新增路線';$('route-cancel-edit').hidden=true;}
  function addCell(row,value){const td=row.insertCell();text(td,value);return td;}
  const hhmm=t=>String(t||'').slice(0,5)||'—';
  async function load(){
    const {data,error}=await db.from('routes')
      .select('id,route_code,route_name,temperature_zone,default_start_time,default_end_time,active')
      .order('route_code');
    if(error)throw error;
    rows=data||[];const body=$('routes-body');body.replaceChildren();
    const zones=[...new Set(rows.map(r=>r.temperature_zone).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-TW'));
    $('known-zones').replaceChildren();for(const zone of zones){const op=document.createElement('option');op.value=zone;$('known-zones').appendChild(op);}
    for(const route of rows){
      const tr=body.insertRow();addCell(tr,route.route_code);addCell(tr,route.route_name||'—');
      addCell(tr,route.temperature_zone||'待設定');addCell(tr,hhmm(route.default_start_time));
      addCell(tr,hhmm(route.default_end_time));addCell(tr,route.active?'啟用':'停用');
      const cell=tr.insertCell(),actions=document.createElement('div');actions.className='table-actions';
      const edit=document.createElement('button');edit.type='button';text(edit,'編輯');
      edit.addEventListener('click',()=>{
        editingId=route.id;for(const [name,id] of Object.entries(inputs)) $(id).value=(route[name]??'').toString().slice(0,name.endsWith('time')?5:120);
        $('routes-form-title').textContent=`編輯路線：${route.route_code}`;
        $('route-save').textContent='儲存變更';$('route-cancel-edit').hidden=false;feedback('');window.scrollTo({top:0,behavior:'smooth'});
      });
      const toggle=document.createElement('button');toggle.type='button';text(toggle,route.active?'停用':'啟用');
      toggle.addEventListener('click',async()=>{
        if(!confirm(`確定要${route.active?'停用':'啟用'}路線 ${route.route_code} 嗎？`))return;
        toggle.disabled=true;
        try{const {error}=await db.from('routes').update({active:!route.active}).eq('id',route.id);if(error)throw error;
          await load();feedback('路線狀態已更新。');}
        catch(e){feedback(`更新失敗：${e.message}`,true);toggle.disabled=false;}
      });
      actions.append(edit,toggle);cell.appendChild(actions);
    }
    if(!rows.length){const tr=body.insertRow(),cell=tr.insertCell();cell.colSpan=7;text(cell,'尚未建立配送路線。');}
  }
  async function init(){
    const {data:{user},error}=await db.auth.getUser();if(error||!user){location.href='index.html';return;}
    const profile=await db.from('profiles').select('role,active,display_name').eq('id',user.id).single();
    if(profile.error||!profile.data?.active||profile.data.role!=='dispatcher'){$('routes-denied').hidden=false;return;}
    text($('routes-user'),profile.data.display_name);$('routes-main').hidden=false;
    $('routes-logout').addEventListener('click',async()=>{await db.auth.signOut();location.href='index.html';});
    $('route-cancel-edit').addEventListener('click',()=>{resetForm();feedback('');});
    $('route-management-form').addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,button=$('route-save');button.disabled=true;
      try{
        const payload=Object.fromEntries(Object.entries(inputs).map(([k,id])=>[k,$(id).value.trim()||null]));
        payload.route_code=payload.route_code?.trim();payload.temperature_zone=payload.temperature_zone?.trim();
        if(!payload.route_code||!payload.temperature_zone||!payload.default_start_time||!payload.default_end_time)
          throw Error('請填寫路線編號、溫層及固定起迄時間。');
        if(payload.default_start_time===payload.default_end_time)throw Error('起訖時間不能相同。');
        const result=editingId?await db.from('routes').update(payload).eq('id',editingId):
          await db.from('routes').insert({...payload,active:true});
        if(result.error)throw result.error;
        resetForm();await load();feedback('配送路線已儲存。');
      }catch(e){feedback(`儲存失敗：${e.message}`,true);}finally{button.disabled=false;}
    });
    try{await load();}catch(e){feedback(`載入失敗：${e.message}`,true);}
  }
  init().catch(e=>feedback(`系統初始化失敗：${e.message}`,true));
})();
