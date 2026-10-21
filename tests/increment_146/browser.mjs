import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import chromium from '@sparticuz/chromium';
import {chromium as pw} from 'playwright';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..'),out=path.resolve(here,'_screenshots');fs.mkdirSync(out,{recursive:true});
const fixture=fs.readFileSync(root+'/tests/mock_supabase_143.js','utf8').replace('gte(k,v){','lt(k,v){this.filters.push(x=>x[k]<v);return this;}gte(k,v){')+'\n'+fs.readFileSync(root+'/tests/mock_increment_146.js','utf8')+'\n'+fs.readFileSync(root+'/tests/mock_increment_147.js','utf8')+'\n'+fs.readFileSync(root+'/tests/mock_increment_148.js','utf8');
const fontRoot=path.resolve(here,'node_modules/@fontsource/noto-sans-tc');
const fontCSS=fs.readFileSync(fontRoot+'/400.css','utf8').replace(/url\(([^)]+)\)/g,(m,u)=>`url(data:font/woff2;base64,${fs.readFileSync(fontRoot+'/'+u.replace(/["']/g,'')).toString('base64')})`);
const browser=await pw.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:chromium.args.filter(x=>x!=='--single-process'),headless:true});let count=0;
const check=(name,value)=>{assert.ok(value,name);console.log('PASS:',name);count++;};
async function setup(width,role='dispatcher',file='ui-attendance.html',finance=false,fail=null){
 const ctx=await browser.newContext({viewport:{width,height:width<768?844:950}}),p=await ctx.newPage(),errors=[];p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));
 let html=fs.readFileSync(root+'/'+file,'utf8');
 html=html.replace(/<link[^>]+href="([^"]+)"[^>]*>/g,(m,name)=>name.startsWith('http')?'':`<style>${fs.readFileSync(root+'/'+name.split('?')[0],'utf8')}</style>`);
 html=html.replace(/<script src="([^"]+)"[^>]*><\/script>/g,(m,name)=>{
  if(name.startsWith('https:'))return '';
  if(name==='js/config.js')return `<script>${fixture}\nmock143.role=${JSON.stringify(role)};mock143.financeAllowed=${finance};mock143.fail=${JSON.stringify(fail)};const db=window._testDB143;</script>`;
  return `<script>${fs.readFileSync(root+'/'+name.split('?')[0],'utf8')}</script>`;
 });
 await p.setContent(html.replace('</head>','<style>'+fontCSS+'</style></head>'),{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);
 if(file==='ui-attendance.html'){await p.waitForSelector('#attendance-table table');await p.evaluate(async()=>{boardDate='2026-10-15';document.querySelector('#service-date').value=boardDate;await fetchBoard();});}
 else await p.waitForFunction(()=>document.body.dataset.financeAccess);
 return {ctx,p,errors};
}
async function save(p){await p.click('#modal-save');await p.waitForFunction(()=>!document.querySelector('#modal').classList.contains('open'));}
try{
 for(const width of [320,375,390,768,1024,1366,1920]){
  const {ctx,p,errors}=await setup(width,'driver');
  check(`${width}px driver sees three boards`,await p.locator('a[href="ui-monthly.html"]:visible').count()===0);
  await p.locator('[data-run]').first().click();
  check(`${width}px unified proposal editor`,await p.locator('#cell-route,#cell-vehicle,#cell-note').count()===3&&await p.locator('#modal-save').textContent()==='送出審核'&&await p.locator('#cell-cancel-run').count()===1&&await p.locator('#mode-actual,#mode-planned').count()===0);
  check(`${width}px no overflow`,await p.evaluate(()=>{const r=document.querySelector('#modal .dialog').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('#modal-fields input,#modal-fields select,#modal .actions button')].every(e=>{const f=e.getBoundingClientRect();return f.left>=r.left-1&&f.right<=r.right+1;});}));
  await p.selectOption('#cell-route','3');await p.selectOption('#cell-vehicle','2');await p.fill('#cell-note','司機提出變更');await save(p);
  check(`${width}px proposal does not update displayed saved run`,await p.locator('[data-run]').first().textContent()==='01'&&await p.evaluate(()=>mock143.calls.some(c=>c.fn==='dashboard_request_attendance_change')&&!mock143.calls.some(c=>c.fn==='dashboard_edit_run_direct')));
  await p.locator('[data-run]').first().click();check(`${width}px pending request is read-only`,await p.locator('#modal-save').isHidden()&&await p.locator('.approval-comparison').count()===1);
  if(width===390)await p.screenshot({path:out+'/driver-request-390.png',fullPage:true});await p.click('#modal-cancel');
  await p.evaluate(async()=>{mock143.role='dispatcher';currentProfile=mock143.tables.profiles[0];currentUser={id:currentProfile.id};await fetchBoard();});
  await p.click('#approval-open');await p.locator('[data-request-id]').first().click();if(width===1366)await p.screenshot({path:out+'/dispatcher-review-1366.png',fullPage:true});
  await save(p);check(`${width}px approval updates board values`,await p.locator('[data-run]').first().textContent()==='03');check(`${width}px no JavaScript errors`,errors.length===0);await ctx.close();
 }
 {
  const {ctx,p,errors}=await setup(390);await p.click('#close');check('cumulative close explains range',(await p.locator('#modal-fields').textContent()).includes('及之前所有尚未結案日期'));
  await save(p);check('closed board offers reasoned reopen',await p.locator('#close').textContent()==='重新開啟'&&await p.locator('[data-run]').count()===0);
  await p.click('#close');await p.click('#modal-save');check('reopen requires reason in UI',(await p.locator('#modal-error').textContent()).includes('原因'));
  await p.fill('#close-note','核對原始單據');await save(p);check('reopen sends selected date and reason',await p.evaluate(()=>mock143.calls.some(c=>c.fn==='dashboard_reopen_attendance_date'&&c.args.p_date==='2026-10-15'&&c.args.p_reason==='核對原始單據')));
  await p.evaluate(async()=>{mock143.tables.runs[0].status='completed';await fetchBoard();});check('open completed run stays editable',await p.locator('[data-run="1"]').count()===2);
  await p.screenshot({path:out+'/attendance-390.png',fullPage:true});check('closing flow no JS errors',errors.length===0);await ctx.close();
 }
 {
  const {ctx,p}=await setup(1366,'dispatcher','ui-attendance.html',false,'dashboard_get_attendance_day_state');check('unavailable closing service prevents edits and closing',await p.locator('#close').isDisabled()&&await p.locator('[data-run]').count()===0&&await p.locator('#new-run').isDisabled());await ctx.close();
 }
 for(const file of ['ui-attendance.html','ui-routes.html','ui-vehicles.html','ui-monthly.html','monthly.html']){
  const {ctx,p,errors}=await setup(1366,'dispatcher',file,false);check(`${file}: monthly links hidden for Karen`,await p.locator('a[href="ui-monthly.html"]:visible,a[href="monthly.html"]:visible').count()===0);
  if(file==='ui-monthly.html')check('new monthly direct URL blocked',await p.locator('#export').count()===0&&(await p.locator('#page').textContent()).includes('未被授權'));
  if(file==='monthly.html')await p.waitForSelector('#finance-blocked');if(file==='monthly.html')check('legacy monthly direct URL blocked',await p.locator('#finance-main').isHidden()&&await p.locator('#finance-blocked').isVisible());
  check(`${file}: no JS errors: ${errors.join(';')}`,errors.length===0);await ctx.close();
 }
 {
  const {ctx,p,errors}=await setup(1366,'dispatcher','ui-monthly.html',true);await p.waitForSelector('#monthly-body table');check('Brian monthly report and export remain available',await p.locator('#export').isVisible()&&await p.locator('a[href="ui-monthly.html"]:visible').count()>0);check('Brian monthly no JS errors',errors.length===0);await ctx.close();
 }
 console.log(`RESULT: ${count} browser assertions passed`);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
