/* Presentation around the existing date/month inputs and event handlers.
   All reads, role checks and stale-response handling stay in the page modules. */
(()=>{'use strict';
 const controls=new WeakMap();
 function desktopHeader(nav){
  if(nav.classList.contains('plan-datebar'))return;
  const header=document.getElementById('head-actions'),desktop=window.matchMedia?.('(min-width:801px)');
  if(!header||!desktop)return;
  const toolbar=nav.closest('.driver-toolbar'),source=toolbar||header;
  const actions=[...source.children].filter(node=>node.tagName==='BUTTON');
  const placements=[nav,...actions].map(node=>{
   const anchor=document.createComment('mobile control position');node.before(anchor);return {node,anchor};
  });
  const row=document.createElement('div');row.className='desktop-date-actions';
  const toolbarHidden=toolbar?.hidden;
  function arrange(){
   const focused=document.activeElement,restoreFocus=placements.some(({node})=>node.contains(focused));
   if(desktop.matches){
    header.classList.add('desktop-date-header');header.prepend(nav);row.append(...actions);header.append(row);
    if(toolbar)toolbar.hidden=true;
   }else{
    placements.forEach(({node,anchor})=>anchor.after(node));row.remove();header.classList.remove('desktop-date-header');
    if(toolbar)toolbar.hidden=toolbarHidden;
   }
   if(restoreFocus&&focused.isConnected)focused.focus({preventScroll:true});
  }
  desktop.addEventListener('change',arrange);arrange();
 }
 function parse(value,monthly){
  if(!(monthly?/^\d{4}-\d{2}$/:/^\d{4}-\d{2}-\d{2}$/).test(value))return null;
  const [year,month,day=1]=value.split('-').map(Number),date=new Date(0);
  date.setUTCFullYear(year,month-1,day);date.setUTCHours(12,0,0,0);
  return year>=1&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
 }
 function mount(input){
  const nav=input.closest('.date-navigation,.driver-date-nav,.plan-datebar');
  if(!nav)return null;
  const monthly=input.type==='month',buttons=[...nav.querySelectorAll('button')];
  if(buttons.length!==2)return null;
  const trigger=document.createElement('label');trigger.className='compact-date-trigger';
  trigger.innerHTML='<span class="compact-date-main" aria-hidden="true"><span class="compact-date-label"></span><svg viewBox="0 0 24 24" focusable="false"><path d="m6 9 6 6 6-6"/></svg></span>';
  input.classList.remove('field');input.classList.add('compact-date-native');
  input.min||=(monthly?'0001-01':'0001-01-01');input.max||=(monthly?'9999-12':'9999-12-31');
  trigger.append(input);
  buttons.forEach((button,i)=>{
   button.type='button';button.classList.add('compact-date-arrow');
   button.innerHTML=`<svg class="date-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${i?'m9 6 6 6-6 6':'m15 6-6 6 6 6'}"/></svg>`;
  });
  nav.replaceChildren(buttons[0],trigger,buttons[1]);nav.classList.add('compact-date-navigation');
  nav.setAttribute('role','group');nav.setAttribute('aria-label',monthly?'切換月份':'切換出勤日期');
  const state={monthly,nav,trigger,buttons,lastValid:input.value};
  controls.set(input,state);
  // Clearing an input must not send an empty date to attendance/payroll queries.
  input.addEventListener('change',event=>{
   if(!parse(input.value,monthly)||input.value<input.min||input.value>input.max){input.value=state.lastValid;event.stopImmediatePropagation();}
   refresh(input);
  },true);
  desktopHeader(nav);
  return state;
 }
 function refresh(input){
  if(!input)return;
  const state=controls.get(input)||mount(input);if(!state)return;
  const date=parse(input.value,state.monthly);if(!date)return;
  state.lastValid=input.value;
  const [year,month,day]=input.value.split('-');
  const parts=[state.monthly?`${month}/`:`${month}/${day}/`,year];
  state.trigger.querySelector('.compact-date-label').replaceChildren(...parts.map(part=>{
   const span=document.createElement('span');span.textContent=part;return span;
  }));
  state.buttons[0].disabled=input.value===input.min;state.buttons[1].disabled=input.value===input.max;
 }
 globalThis.CompactDateNavigation={refresh};
 // Keep the visible label in sync when the browser restores the page/input.
 window.addEventListener('pageshow',()=>document.querySelectorAll('.compact-date-native').forEach(refresh));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)document.querySelectorAll('.compact-date-native').forEach(refresh);});
})();
