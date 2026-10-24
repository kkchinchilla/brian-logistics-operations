/* One native Back listener per dashboard; dismiss the top layer through its own cancel action. */
(()=>{'use strict';
 const cap=window.Capacitor;
 if(cap?.getPlatform?.()!=='android'||!cap.isPluginAvailable?.('App'))return;
 const app=cap.Plugins?.App||cap.registerPlugin('App');
 const el=id=>document.getElementById(id);
 const histories=new Map();let restoring=false;
 const tabs=window.DashboardTabs={
  reset(scope){histories.delete(scope)},
  record(scope,from,to,restore){
   if(restoring||from===to)return;
   let h=histories.get(scope);
   if(!h||h.keys.at(-1)!==from)h={keys:[from],restore};
   const index=h.keys.indexOf(to);
   if(index>=0)h.keys=h.keys.slice(0,index+1);else h.keys.push(to);
   h.restore=restore;histories.set(scope,h);
  },
  back(scope){
   if(restoring)return true;
   const h=histories.get(scope);if(!h||h.keys.length<2)return false;
   restoring=true;
   Promise.resolve().then(()=>h.restore(h.keys.at(-2))).then(ok=>{if(ok!==false)h.keys.pop()}).catch(err=>console.warn('Tab navigation failed',err)).finally(()=>{restoring=false});
   return true;
  }
 };
 app.addListener('backButton',({canGoBack})=>{
  if(restoring)return;
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
   if((id==='plan-panel'||id==='monthly-detail')&&tabs.back(id))return;
   el(cancel)?.click();
   return;
  }
  if(tabs.back('dashboard'))return;
  if(canGoBack)window.history.back();
  else app.minimizeApp().catch(err=>console.warn('Android back navigation failed',err));
 }).catch(err=>console.warn('Dashboard Android back listener unavailable',err));
})();
