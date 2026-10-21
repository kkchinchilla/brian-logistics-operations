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
 await p.clock.setFixedTime(new Date('2026-10-20T05:00:00Z'));
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
 for(const width of [320,390,768,1366]){
  const {ctx,p,errors}=await setup(width,'driver');
  const driver=await p.evaluate(()=>currentUser.id);
  const slot=p.locator(`[data-add][data-driver="${driver}"]`).first();
  const original=await slot.textContent();await slot.click();
  check(`${width}px new trip uses request button`,await p.locator('#modal-save').textContent()==='送出審核');
  await p.selectOption('#cell-route','3');await p.selectOption('#cell-vehicle','2');await p.fill('#cell-note','新增趟次申請');await save(p);
  check(`${width}px addition leaves saved attendance untouched`,await p.evaluate(()=>mock143.tables.daily_attendance_extra_trips.length===0&&mock143.tables.runs.length===2&&mock143.tables.attendance_change_requests[0].request_kind==='add'&&!mock143.calls.some(c=>c.fn==='dashboard_save_extra_actual_trip')));
  check(`${width}px pending addition keeps original empty cell`,await slot.textContent()===original);await slot.click();
  check(`${width}px pending addition opens request detail`,await p.locator('#modal-save').isHidden()&&(await p.locator('#modal-fields').textContent()).includes('尚未新增'));
  if(width===390)await p.screenshot({path:out+'/pending-add-390.png',fullPage:true});await p.click('#modal-cancel');
  await p.evaluate(async()=>{mock143.role='dispatcher';currentProfile=mock143.tables.profiles[0];currentUser={id:currentProfile.id};await fetchBoard()});
  await p.click('#approval-open');await p.locator('[data-request-id]').first().click();
  check(`${width}px dispatcher sees addition type and target slot`,(await p.locator('#modal-fields').textContent()).includes('新增趟次')&&(await p.locator('#modal-fields').textContent()).includes('申請新增'));
  if(width===1366)await p.screenshot({path:out+'/approve-add-1366.png',fullPage:true});await save(p);
  check(`${width}px only approval creates saved extra`,await p.evaluate(()=>mock143.tables.daily_attendance_extra_trips.length===1&&mock143.tables.attendance_change_requests[0].status==='approved')&&await p.locator('[data-extra]').first().textContent()==='03');
  await p.evaluate(async()=>{mock143.role='driver';currentProfile=mock143.tables.profiles[1];currentUser={id:currentProfile.id};await fetchBoard()});
  await p.locator('[data-run="1"]').first().click();await p.click('#cell-cancel-run');await p.click('#modal-save');
  check(`${width}px deletion requires reason before submission`,(await p.locator('#modal-error').textContent()).includes('原因'));await p.fill('#cell-note','請刪除此趟');await save(p);
  check(`${width}px deletion request leaves scheduled run active`,await p.evaluate(()=>mock143.tables.runs[0].status==='assigned'&&mock143.tables.attendance_change_requests.some(q=>q.run_id===1&&q.proposed_void&&q.status==='pending')));
  await p.evaluate(async()=>{mock143.role='dispatcher';currentProfile=mock143.tables.profiles[0];currentUser={id:currentProfile.id};await fetchBoard()});await p.click('#approval-open');await p.locator('[data-request-id]').first().click();await save(p);
  check(`${width}px approved deletion cancels saved run once`,await p.evaluate(()=>mock143.tables.runs[0].status==='cancelled'&&mock143.tables.runs.length===2));
  check(`${width}px no JS error and no page overflow`,errors.length===0&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await ctx.close();
 }
 {
  const {ctx,p}=await setup(390,'driver');const driver=await p.evaluate(()=>currentUser.id);await p.locator(`[data-add][data-driver="${driver}"]`).first().click();await p.selectOption('#cell-route','3');await p.selectOption('#cell-vehicle','2');await save(p);
  await p.evaluate(async()=>{mock143.role='dispatcher';currentProfile=mock143.tables.profiles[0];currentUser={id:currentProfile.id};await fetchBoard()});await p.click('#approval-open');await p.locator('[data-request-id]').first().click();await p.selectOption('#approval-decision','reject');await p.click('#modal-save');check('addition rejection requires reason',(await p.locator('#modal-error').textContent()).includes('原因'));await p.fill('#approval-reason','不需要新增');await save(p);check('rejected addition never creates attendance',await p.evaluate(()=>mock143.tables.daily_attendance_extra_trips.length===0&&mock143.tables.attendance_change_requests[0].status==='rejected'));await ctx.close();
 }
 console.log(`RESULT: ${count} new browser assertions passed`);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
