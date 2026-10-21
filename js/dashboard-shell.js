/* Shared viewport management for the four approved interactive prototypes.
   Never grants application permissions; original demo interactions remain local-only. */
(()=>{
 const page=document.body.dataset.dashboard;
 let mode='';
 function applyViewport(){
  const next=window.matchMedia('(max-width: 800px)').matches?'mobile':'desktop';
  if(mode===next)return;
  mode=next;
  if(page==='attendance'){
    const btn=document.querySelector('#device-choices [data-device="'+next+'"]');
    if(btn)btn.click();
  }else if(page==='routes'){
    const btn=document.querySelector('#device-'+next);if(btn)btn.click();
  }else if(page==='vehicles'){
    const btn=document.querySelector('#previewSwitch [data-device="'+next+'"]');if(btn)btn.click();
  }else if(page==='monthly'){
    const btn=document.querySelector('#device [data-screen="'+next+'"]');if(btn)btn.click();
  }
 }
 function init(){applyViewport();window.addEventListener('resize',applyViewport,{passive:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
