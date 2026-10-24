/* One native Back listener per dashboard; dismiss the top layer through its own cancel action. */
(()=>{'use strict';
 const cap=window.Capacitor;
 if(cap?.getPlatform?.()!=='android'||!cap.isPluginAvailable?.('App'))return;
 const app=cap.Plugins?.App||cap.registerPlugin('App');
 const el=id=>document.getElementById(id);
 app.addListener('backButton',({canGoBack})=>{
  // Category dialogs can overlay an unsaved route; close only the category first.
  const layers=[
   ['entity-modal','open','entity-cancel','entity-submit'],
   ['rate-modal','open','rate-cancel','save-form'],
   ['drawer','open','cancel-form','save-form'],
   ['modal','open','modal-cancel','modal-save'],
   ['plan-panel','show','plan-x','plan-x'],
   ['monthly-detail','open','close-detail',null]
  ];
  for(const [id,state,cancel,save] of layers){
   if(!el(id)?.classList.contains(state))continue;
   // Consume Back while saving; never fall through to another dashboard.
   if(save&&el(save)?.disabled)return;
   el(cancel)?.click();
   return;
  }
  if(canGoBack)window.history.back();
  else app.minimizeApp().catch(err=>console.warn('Android back navigation failed',err));
 }).catch(err=>console.warn('Dashboard Android back listener unavailable',err));
})();
