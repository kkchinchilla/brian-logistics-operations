/* Reserve the actual navigation height when larger text wraps its labels.
   Hidden driver/offline navigation reserves no space. No account/data changes. */
(()=>{'use strict';
 function init(){
  const body=document.body,bar=document.querySelector('.mobilebar,.mobile-navbar');
  if(!body.dataset.dashboard||!bar)return;
  let previous=-1;
  function measure(){
   const height=Math.ceil(bar.getBoundingClientRect().height);
   if(height===previous)return;
   previous=height;
   body.style.setProperty('--dashboard-nav-height',`${height}px`);
   // A visible bar already includes the bottom safe area; don't count it twice.
   body.style.setProperty('--dashboard-footer-safe-area',height?'0px':'env(safe-area-inset-bottom,0px)');
  }
  measure();
  if('ResizeObserver' in window)new ResizeObserver(measure).observe(bar);
  window.addEventListener('resize',measure,{passive:true});
  window.addEventListener('pageshow',measure);
  document.fonts?.ready.then(measure);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
