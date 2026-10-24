/* Android Back dismisses the top monthly-report layer before leaving the page. */
(()=>{'use strict';
 const cap=window.Capacitor;
 if(cap?.getPlatform?.()!=='android'||!cap.isPluginAvailable?.('App'))return;
 const app=cap.Plugins?.App||cap.registerPlugin('App');
 app.addListener('backButton',({canGoBack})=>{
  const modal=document.querySelector('#modal.open');
  if(modal){
   // Keep the current save on screen until it succeeds or reports an error.
   if(document.querySelector('#modal-save')?.disabled)return;
   document.querySelector('#modal-cancel')?.click();
   return;
  }
  const detail=document.querySelector('#monthly-detail.open');
  if(detail){detail.querySelector('#close-detail')?.click();return;}
  if(canGoBack)window.history.back();
  else app.minimizeApp().catch(err=>console.warn('Android back navigation failed',err));
 }).catch(err=>console.warn('Monthly Android back listener unavailable',err));
})();
