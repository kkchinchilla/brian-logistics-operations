/* Network failures are not evidence that a saved session is invalid.
   Never authorize from a cached profile: verify Auth and profiles before loading data. */
window.DashboardSession=(()=>{
 const invalidAuth=error=>error?.name==='AuthSessionMissingError'||
  ['session_not_found','session_expired','refresh_token_not_found','refresh_token_already_used','bad_jwt','user_not_found','user_banned'].includes(error?.code)||
  [401,403].includes(error?.status);
 let recoveryShown=false,reloading=false;
 function retry(){if(reloading)return;reloading=true;window.location.reload();}
 function showRecovery(){
  if(recoveryShown)return;
  recoveryShown=true;
  document.body.dataset.connectionState='blocked';
  const panel=document.createElement('section');panel.id='connection-recovery';panel.setAttribute('role','alert');
  const title=document.createElement('h2');title.textContent='目前無法連線';
  const text=document.createElement('p');text.textContent='請檢查網路連線。連線恢復後會重新載入此頁；你也可以按下重試。';
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='重新載入';button.addEventListener('click',retry);
  panel.append(title,text,button);(document.querySelector('.main')||document.querySelector('.loginbox')).prepend(panel);
  window.addEventListener('online',retry,{once:true});
  // Android may restore the WebView after the online event has already fired.
  window.addEventListener('focus',()=>{if(window.navigator?.onLine===true)retry();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&window.navigator?.onLine===true)retry();});
 }
 async function verify(client){
  let phase='auth';
  try{
   if(window.navigator?.onLine===false){showRecovery();return null;}
   // Surface refresh errors before getUser: an offline/expired saved session is
   // not proof of logout. getSession refreshes tokens but never grants access.
   const {data:sessionData,error:sessionError}=await client.auth.getSession();
   if(sessionError)throw sessionError;
   if(!sessionData?.session){window.location.replace('index.html');return null;}
   const {data,error}=await client.auth.getUser();
   if(error){if(invalidAuth(error)){window.location.replace('index.html');return null;}throw error;}
   if(!data?.user){window.location.replace('index.html');return null;}
   phase='profile';
   const {data:profile,error:profileError}=await client.from('profiles').select('id,display_name,role,active,can_manage_finance').eq('id',data.user.id).single();
   // A failed profile request must not sign out a valid account.
   if(profileError&&profileError.code!=='PGRST116')throw profileError;
   if(!profile?.active||!['dispatcher','driver'].includes(profile.role)){
    await client.auth.signOut({scope:'local'});window.location.replace('index.html');return null;
   }
   return {user:data.user,profile};
  }catch(error){
   // Auth may reject as well as return an error object.
   if(phase==='auth'&&invalidAuth(error)){window.location.replace('index.html');return null;}
   showRecovery();return null;
  }
 }
 // This script precedes the network-loaded SDK, including on the launch page.
 // Show recovery even when the SDK cannot load at all during a cold start.
 if(window.navigator?.onLine===false)showRecovery();
 return {verify,showRecovery,invalidAuth};
})();
