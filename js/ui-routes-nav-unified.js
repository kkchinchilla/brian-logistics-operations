/* Route navigation: identical logout behavior to the three production dashboard pages. */
(()=>{'use strict';
 const button=document.getElementById('route-logout');
 if(!button)return;
 button.addEventListener('click',async()=>{
   if(button.disabled)return;
   button.disabled=true;
   const label=button.textContent;button.textContent='登出中…';
   try{
     const client=(typeof db!=='undefined'?db:window.db);
     if(!client?.auth?.signOut)throw new Error('無法取得登入服務');
     const {error}=await client.auth.signOut();
     if(error)throw error;
     location.replace('index.html');
   }catch(e){
     button.disabled=false;button.textContent=label;
     const status=document.getElementById('route-status');
     if(status)status.textContent='登出失敗，請重試：'+String(e?.message||e);
   }
 });
})();
