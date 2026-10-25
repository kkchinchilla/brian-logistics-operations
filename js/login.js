const loginForm=document.querySelector('#login-form');
const errorMessage=document.querySelector('#error-message');
const loginButton=document.querySelector('#login-submit');
let signingIn=false;

// App launches always open index.html, including when Auth has a saved session.
// Verify with Auth and the current profile before leaving the login screen.
async function restoreLoginSession(){
 let phase='auth';
 loginButton.disabled=true;loginButton.textContent='確認登入狀態…';
 try{
  if(window.navigator?.onLine===false){DashboardSession.showRecovery();return;}
  const {data,error}=await db.auth.getSession();
  if(error)throw error;
  if(!data?.session)return;
  const {data:userData,error:userError}=await db.auth.getUser();
  if(userError)throw userError;
  if(!userData?.user?.id)return;
  phase='profile';
  const {data:profile,error:profileError}=await db.from('profiles').select('role, active').eq('id',userData.user.id).maybeSingle();
  if(profileError)throw profileError;
  if(!profile||!profile.active||!['dispatcher','driver'].includes(profile.role)){
   await db.auth.signOut({scope:'local'});
   errorMessage.textContent='無法讀取使用者資料，或此帳號已停用';
   return;
  }
  window.location.replace('ui-attendance.html');
 }catch(error){
  // A temporary network failure must not erase a potentially valid session.
  if(phase==='auth'&&DashboardSession.invalidAuth(error)){
   errorMessage.textContent='登入已失效，請重新登入。';
  }else{
   DashboardSession.showRecovery();
  }
 }finally{
  document.body.dataset.sessionState='ready';
  loginButton.disabled=false;loginButton.textContent='登入';
 }
}
const sessionRestore=restoreLoginSession();

// Supabase expects an international phone identifier. Never substitute an email.
function normalizeLoginPhone(value){
 const phone=String(value??'').normalize('NFKC').trim().replace(/[\s()\-]/g,'');
 if(/^09\d{8}$/.test(phone))return '+886'+phone.slice(1);
 if(/^8869\d{8}$/.test(phone))return '+'+phone;
 if(phone.startsWith('+886'))return /^\+8869\d{8}$/.test(phone)?phone:null;
 if(/^\+[1-9]\d{7,14}$/.test(phone))return phone;
 return null;
}

function phoneLoginError(error){
 if(error?.code==='phone_provider_disabled')return '手機登入尚未啟用，請聯絡管理員。';
 if(error?.code==='phone_not_confirmed')return '此手機號碼尚未完成帳號設定，請聯絡管理員。';
 if(error?.status===429||['over_request_rate_limit','over_sms_send_rate_limit'].includes(error?.code))return '嘗試次數過多，請稍後再試。';
 if(error?.code==='invalid_credentials'||error?.status===400)return '手機號碼或密碼不正確。';
 return '目前無法登入，請檢查網路連線後再試。';
}

loginForm.addEventListener('submit',async event=>{
 event.preventDefault();
 await sessionRestore;
 if(signingIn)return;
 errorMessage.textContent='';
 const phone=normalizeLoginPhone(document.querySelector('#phone').value);
 const password=document.querySelector('#password').value;
 if(!phone){errorMessage.textContent='請輸入有效手機號碼：台灣手機請填 09 開頭的 10 碼，其他國家請加國碼（+）。';return;}
 if(!password){errorMessage.textContent='請輸入密碼。';return;}
 signingIn=true;loginButton.disabled=true;loginButton.textContent='登入中…';
 let signedIn=false;
 try{
  const {data,error}=await db.auth.signInWithPassword({phone,password});
  if(error){errorMessage.textContent=phoneLoginError(error);return;}
  if(!data?.user?.id)throw Error('Missing authenticated user');
  signedIn=true;
  const {data:profile,error:profileError}=await db.from('profiles').select('display_name, role, active').eq('id',data.user.id).single();
  if(profileError||!profile||!profile.active){
   await db.auth.signOut();signedIn=false;
   errorMessage.textContent='無法讀取使用者資料，或此帳號已停用';return;
  }
  if(!['dispatcher','driver'].includes(profile.role)){
   await db.auth.signOut();signedIn=false;
   errorMessage.textContent='無法辨識此帳號的使用者權限';return;
  }
  window.location.href='ui-attendance.html';
 }catch(error){
  if(signedIn){try{await db.auth.signOut();}catch{/* Dashboard access also verifies the profile. */}}
  errorMessage.textContent='目前無法登入，請檢查網路連線後再試。';
 }finally{
  signingIn=false;loginButton.disabled=false;loginButton.textContent='登入';
 }
});
