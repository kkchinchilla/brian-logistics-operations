/* Only return to a known same-origin app page; never trust a supplied redirect. */
(()=>{'use strict';
 const back=document.getElementById('information-back');
 try{
  const ref=new URL(document.referrer),here=new URL(location.href);
  const allowed=new Set(['index.html','ui-attendance.html','ui-routes.html','ui-vehicles.html','ui-monthly.html','ui-accounts.html']);
  if(ref.origin===here.origin&&ref.pathname.slice(0,ref.pathname.lastIndexOf('/')+1)===here.pathname.slice(0,here.pathname.lastIndexOf('/')+1)&&allowed.has(ref.pathname.split('/').pop()))back.href=ref.pathname;
 }catch{}
})();
