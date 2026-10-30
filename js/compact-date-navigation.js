/* Presentation around the existing date/month inputs and event handlers.
   All reads, role checks and stale-response handling stay in the page modules. */
(()=>{'use strict';
 const controls=new WeakMap();
 const weekdays=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
 function parse(value,monthly){
  if(!(monthly?/^\d{4}-\d{2}$/:/^\d{4}-\d{2}-\d{2}$/).test(value))return null;
  const [year,month,day=1]=value.split('-').map(Number),date=new Date(0);
  date.setUTCFullYear(year,month-1,day);date.setUTCHours(12,0,0,0);
  return year>=1&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
 }
 function mount(input){
  const nav=input.closest('.date-navigation,.driver-date-nav');
  if(!nav)return null;
  const monthly=input.type==='month',buttons=[...nav.querySelectorAll('button')];
  if(buttons.length!==2)return null;
  const trigger=document.createElement('label');trigger.className='compact-date-trigger';
  trigger.innerHTML='<span class="compact-date-main" aria-hidden="true"><span class="compact-date-label"></span><svg viewBox="0 0 24 24" focusable="false"><path d="m6 9 6 6 6-6"/></svg></span><span class="compact-date-context" aria-hidden="true"></span>';
  input.classList.remove('field');input.classList.add('compact-date-native');
  input.min=monthly?'0001-01':'0001-01-01';input.max=monthly?'9999-12':'9999-12-31';
  trigger.append(input);
  const arrows=document.createElement('div');arrows.className='compact-date-arrows';
  arrows.setAttribute('role','group');arrows.setAttribute('aria-label',monthly?'切換報表月份':'切換出勤日期');
  for(const button of buttons){button.type='button';button.classList.add('compact-date-arrow');arrows.append(button);}
  nav.replaceChildren(trigger,arrows);nav.classList.add('compact-date-navigation');
  const status=document.createElement('span');status.className='compact-date-status';
  const current=document.createElement('span');current.className='compact-date-current';current.textContent=monthly?'本月':'今天';
  const reset=document.getElementById('driver-today')||document.createElement('button');
  reset.type='button';reset.className='compact-date-reset';reset.textContent=monthly?'回到本月':'回到今天';
  if(!reset.id){
   reset.id=monthly?'month-today':'attendance-today';
   reset.addEventListener('click',()=>{input.value=today().slice(0,monthly?7:10);input.dispatchEvent(new Event('change',{bubbles:true}));});
  }
  status.append(current,reset);
  const title=document.querySelector('.tgj-page-title');
  if(title){title.classList.add('has-date-status');title.append(status);}
  else nav.before(status);
  const state={monthly,nav,trigger,current,reset,buttons,lastValid:input.value};
  controls.set(input,state);
  // Clearing an input must not send an empty date to attendance/payroll queries.
  input.addEventListener('change',event=>{
   if(!parse(input.value,monthly)){input.value=state.lastValid;event.stopImmediatePropagation();}
   refresh(input);
  },true);
  return state;
 }
 function refresh(input){
  if(!input)return;
  const state=controls.get(input)||mount(input);if(!state)return;
  const date=parse(input.value,state.monthly);if(!date)return;
  state.lastValid=input.value;
  const parts=state.monthly?[date.getUTCMonth()+1,'月']:[date.getUTCMonth()+1,'月',date.getUTCDate(),'日'];
  state.trigger.querySelector('.compact-date-label').replaceChildren(...parts.map((part,i)=>{
   const span=document.createElement('span');span.textContent=String(part);if(i%2)span.className='compact-date-unit';return span;
  }));
  state.trigger.querySelector('.compact-date-context').textContent=`${date.getUTCFullYear()} 年`+(state.monthly?'':` · ${weekdays[date.getUTCDay()]}`);
  const isCurrent=input.value===today().slice(0,state.monthly?7:10);
  state.current.hidden=!isCurrent;state.reset.hidden=isCurrent;
  state.buttons[0].disabled=input.value===input.min;state.buttons[1].disabled=input.value===input.max;
 }
 globalThis.CompactDateNavigation={refresh};
 // Recheck the today/month marker after a backgrounded app returns at midnight.
 window.addEventListener('pageshow',()=>document.querySelectorAll('.compact-date-native').forEach(refresh));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)document.querySelectorAll('.compact-date-native').forEach(refresh);});
})();
