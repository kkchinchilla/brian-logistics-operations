/* Use an actual file URI in Android; browsers retain their normal CSV download. */
(function(root){
 'use strict';
 let busy=false,sequence=0;
 async function csv(filename,text){
  if(busy)return false;
  busy=true;
  try{
   const cap=root.Capacitor;
   if(cap?.getPlatform?.()==='android'){
    if(!['Filesystem','Share'].every(name=>cap.isPluginAvailable?.(name)))throw Error('此版本尚未啟用檔案匯出，請更新 App 後重試。');
    const plugin=name=>cap.Plugins?.[name]||cap.registerPlugin(name);
    const filesystem=plugin('Filesystem'),share=plugin('Share');
    // Unique cache folders prevent a subsequent export from overwriting a shared file.
    const path='payroll-exports/'+Date.now()+'-'+(++sequence)+'/'+filename;
    const file=await filesystem.writeFile({path,data:text,directory:'CACHE',encoding:'utf8',recursive:true});
    if(!file?.uri)throw Error('無法建立匯出檔案，請重試。');
    await share.share({title:filename,files:[file.uri],dialogTitle:'匯出 CSV：選擇儲存或分享位置'});
    // Keep cache contents available for the receiving app; Android may reclaim them.
   }else{
    const u=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=u;a.download=filename;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
   }
   return true;
  }finally{busy=false;}
 }
 root.ReportExport={csv};
})(typeof globalThis!=='undefined'?globalThis:this);
