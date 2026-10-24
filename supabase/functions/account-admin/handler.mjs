// No request bodies, phone numbers, passwords, or Auth user objects are logged.
export function normalizePhone(value) {
 const phone=String(value??'').normalize('NFKC').trim().replace(/[\s()\-]/g,'');
 if(/^09\d{8}$/.test(phone))return '+886'+phone.slice(1);
 if(/^8869\d{8}$/.test(phone))return '+'+phone;
 if(phone.startsWith('+886'))return /^\+8869\d{8}$/.test(phone)?phone:null;
 return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
class Failure extends Error { constructor(status,message){super(message);this.status=status;} }
const fail=(message,status=400)=>{throw new Failure(status,message);};
function password(value){
 if(typeof value!=='string'||value.length<8||new TextEncoder().encode(value).length>72)fail('新密碼至少 8 個字元，且不得超過 72 位元組。');
 return value;
}
function details(body){
 const name=typeof body.name==='string'?body.name.trim():'';
 if(!name||name.length>70)fail('請填寫姓名（1–70 字）。');
 if(!['driver','dispatcher'].includes(body.role))fail('請選擇司機或主管。');
 return {name,role:body.role};
}
function phoneInput(body){
 const phone=normalizePhone(body.phone);
 if(!phone)fail('請輸入有效手機號碼。');
 if(body.phone_verified!==true)fail('請先確認此手機號碼屬於使用者本人。');
 return phone;
}
function authError(error){
 if(['phone_exists','user_already_exists','identity_already_exists'].includes(error?.code)||/already.*(registered|exists)/i.test(error?.message||''))return new Failure(409,'此手機號碼已被其他帳號使用。');
 if(error?.code==='weak_password')return new Failure(400,'密碼未符合安全要求，請使用更長且較難猜測的密碼。');
 if(error?.status===429)return new Failure(429,'操作次數過多，請稍後再試。');
 return new Failure(502,'帳號服務暫時無法完成操作，請重新整理確認後再試。');
}
export function createAccountHandler({createClient,url,publicKey,secretKey,allowedOrigin,allowedOrigins=allowedOrigin?[allowedOrigin]:[]}) {
 const origins=new Set(allowedOrigins);
 return async function handle(request){
  const origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if(origins.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'});
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!origins.has(origin))return respond({error:'不允許此來源。'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond({error:'請使用 POST。'},405);
  try{
   const authorization=request.headers.get('Authorization')||'';
   const token=authorization.match(/^Bearer (\S+)$/i)?.[1];
   if(!token)fail('請先登入。',401);
   if(!url||!publicKey||!secretKey)fail('帳號服務尚未設定完成。',503);
   const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
   const caller=createClient(url,publicKey,{...options,global:{headers:{Authorization:authorization}}});
   const verified=await caller.auth.getUser(token);
   if(verified.error||!verified.data?.user?.id)fail('登入已失效，請重新登入。',401);
   const context=await caller.rpc('dashboard_account_admin_context');
   if(context.error||context.data?.actor_id!==verified.data.user.id)fail('帳號管理僅限 Brian 使用；若已登出，請重新登入。',403);
   // Never construct an admin client until identity and live-session permission pass.
   const admin=createClient(url,secretKey,options);
   const raw=await request.text();if(raw.length>8192)fail('資料過長。',413);
   let body;try{body=JSON.parse(raw);}catch{fail('資料格式不正確。');}
   if(!body||typeof body!=='object'||Array.isArray(body))fail('資料格式不正確。');
   const actor=context.data.actor_id;
   const directory=await admin.rpc('dashboard_account_directory',{p_actor:actor});
   if(directory.error||!Array.isArray(directory.data))fail('無法載入帳號資料，請稍後再試。',503);
   const users=directory.data;
   if(body.action==='list')return respond({users,actor_id:actor});
   const apply=async(action,target,extra={})=>{
    const r=await admin.rpc('dashboard_account_apply',{p_actor:actor,p_target:target,p_action:action,...extra});
    if(r.error)throw new Failure(409,'使用者資料已變更或無法儲存，請重新整理後再試。');
   };
   if(body.action==='create'){
    const {name,role}=details(body),phone=phoneInput(body),pass=password(body.password);
    const result=await admin.auth.admin.createUser({phone,password:pass,phone_confirm:true});
    if(result.error||!result.data?.user?.id)throw authError(result.error);
    const target=result.data.user.id;
    try{await apply('create',target,{p_name:name,p_role:role});}
    catch(error){
     // Only the new account from this request can be rolled back; it has no profile/history.
     const cleanup=await admin.auth.admin.deleteUser(target);
     if(cleanup.error)fail('帳號資料建立未完成，登入權限未開通。請聯絡系統管理員協助處理。',503);
     throw error;
    }
    return respond({ok:true,message:'帳號已建立，請將登入資料告知使用者。'});
   }
   if(!['edit','phone','password','delete'].includes(body.action))fail('不支援此操作。');
   const target=users.find(u=>u.id===body.user_id);
   if(!target||target.deleted)fail('此帳號不存在或已刪除。',404);
   if(body.action!=='delete'&&!target.active)fail('此帳號已停用。',409);
   if(body.action==='edit'){
    const {name,role}=details(body);
    if(target.is_owner&&role!=='dispatcher')fail('無法變更管理員角色。',403);
    await apply('edit',target.id,{p_name:name,p_role:role});
    return respond({ok:true,message:'帳號資料已更新。'});
   }
   if(body.action==='delete'){
    if(target.is_owner||target.id===actor)fail('無法刪除自己的管理員帳號。',403);
    if(body.confirm_name!==target.display_name)fail('請輸入使用者姓名以確認刪除。');
    await apply('delete_requested',target.id);
    const result=await admin.auth.admin.deleteUser(target.id,true);
    if(result.error)fail('帳號已停用，但刪除尚未完成。請重新整理後按「重試刪除」。',502);
    try{await apply('delete',target.id);}catch{return respond({ok:true,message:'帳號已刪除；歷史紀錄已保留。操作紀錄稍後需由管理員確認。'});}
    return respond({ok:true,message:'帳號已刪除；歷史出勤與報表已保留。'});
   }
   const attributes=body.action==='phone'?{phone:phoneInput(body),phone_confirm:true}:{password:password(body.password)};
   const result=await admin.auth.admin.updateUserById(target.id,attributes);
   if(result.error)throw authError(result.error);
   // Credentials have already changed if audit storage fails; never report otherwise.
   let auditSaved=true;try{await apply(body.action,target.id);}catch{auditSaved=false;}
   return respond({ok:true,self_relogin:target.id===actor,message:body.action==='phone'?'手機號碼已更新，請使用新號碼登入。':'密碼已更新，請將新密碼告知使用者。',audit_saved:auditSaved});
  }catch(error){
   return respond({error:error instanceof Failure?error.message:'連線中斷或服務暫時無法使用，請重新整理確認後再試。'},error instanceof Failure?error.status:503);
  }
 };
}
