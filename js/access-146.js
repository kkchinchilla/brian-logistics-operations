/* Server capability is authoritative. Hidden by default, including legacy links. */
const DashboardAccess146=(()=>{
 let pending=null,allowed=false;
 async function load(){
  if(!pending)pending=(async()=>{
   try{
    const {data,error}=await db.rpc('dashboard_get_capabilities',{});
    allowed=!error&&data?.increment==='1.4.6'&&data.can_manage_finance===true;
   }catch(e){allowed=false;}
   document.body.dataset.financeAccess=allowed?'allowed':'denied';
   return allowed;
  })();
  return pending;
 }
 document.addEventListener('DOMContentLoaded',load);
 return {load,finance:()=>allowed};
})();
