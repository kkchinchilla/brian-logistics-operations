/* One logout path for desktop and mobile, including the route dashboard. */
(()=>{'use strict';
 let busy=false;
 async function logout(){
  if(busy)return;
  busy=true;
  const buttons=[...document.querySelectorAll('[data-session-logout],#logout,#route-logout')];
  const labels=buttons.map(b=>b.textContent);
  buttons.forEach(b=>{b.disabled=true;b.textContent='登出中…';});
  try{
   const {error}=await db.auth.signOut();
   if(error)throw error;
   location.replace('index.html');
  }catch(e){
   let status=document.getElementById('logout-status');
   if(!status){status=document.createElement('p');status.id='logout-status';status.setAttribute('role','alert');document.querySelector('.main')?.prepend(status);}
   status.textContent='登出失敗，請重試。';
   buttons.forEach((b,i)=>{b.disabled=false;b.textContent=labels[i];});
   busy=false;
  }
 }
 function init(){document.querySelectorAll('[data-session-logout],#logout,#route-logout').forEach(b=>b.addEventListener('click',logout));}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
