import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import chromium from '@sparticuz/chromium';
import {chromium as pw} from 'playwright';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..'),out=path.resolve(here,'_screenshots');fs.mkdirSync(out,{recursive:true});
const fixture=fs.readFileSync(root+'/tests/mock_supabase_143.js','utf8').replace('gte(k,v){','lt(k,v){this.filters.push(x=>x[k]<v);return this;}gte(k,v){')+'\n'+fs.readFileSync(root+'/tests/mock_increment_146.js','utf8')+'\n'+fs.readFileSync(root+'/tests/mock_increment_147.js','utf8');
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
 for(const width of [320,390,768,1366,1920]){
  const {ctx,p,errors}=await setup(width,'dispatcher','ui-monthly.html',true);
  await p.waitForSelector('#monthly-body table');
  check(`${width}px closing-only totals, rental and standby`,await p.locator('#stats strong').allTextContents().then(x=>x.join('|')==='3|1|1|100'));
  check(`${width}px no live execution or standby reads`,await p.evaluate(()=>!mock143.reads.some(x=>['trip_executions','runs','v055_standby_shifts','daily_attendance_extra_trips'].includes(x))));
  check(`${width}px page does not overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.locator('[data-person]').first().click();await p.click('#detail-daily');
  check(`${width}px detail uses frozen route and closing label`,(await p.locator('#detail-daily-panel').textContent()).includes('FROZEN-01')&&(await p.locator('#detail-daily-panel').textContent()).includes('結案'));
  if(width===390||width===1366)await p.screenshot({path:out+`/monthly-detail-${width}.png`,fullPage:true});
  await p.click('#close-detail');
  await p.evaluate(()=>{window.savedBlobs=[];URL.createObjectURL=b=>{savedBlobs.push(b);return 'blob:test'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};});
  await p.click('#export');await p.waitForFunction(()=>savedBlobs.length===1);
  const csv=await p.evaluate(()=>savedBlobs[0].text());check(`${width}px CSV matches displayed closing counts`,csv.includes('已結案總趟次')&&csv.includes('"2026-10","測試司機 A","2"')&&csv.includes('"2026-10","測試司機 B","1"'));
  check(`${width}px no JavaScript errors: ${errors}`,errors.length===0);await ctx.close();
 }
 {
  const {ctx,p}=await setup(1366,'dispatcher','ui-monthly.html',true);await p.waitForSelector('#monthly-body table');
  await p.evaluate(()=>{window.savedBlobs=[];URL.createObjectURL=b=>{savedBlobs.push(b);return 'blob:test'};URL.revokeObjectURL=()=>{};HTMLAnchorElement.prototype.click=function(){};mock143.finalized.deliveries=mock143.finalized.deliveries.filter(x=>x.service_date!=='2026-10-19');});
  await p.click('#export');await p.waitForFunction(()=>savedBlobs.length===1);
  check('export reloads authoritative source after another dispatcher reopens a date',await p.locator('#stats strong').first().textContent()==='1'&&(await p.evaluate(()=>savedBlobs[0].text())).includes('"2026-10","測試司機 A","1"'));
  await p.evaluate(()=>{mock143.fail='dashboard_get_finalized_monthly'});await p.click('#export');await p.waitForSelector('#monthly-body .empty');
  check('failed refresh clears totals and blocks stale CSV',await p.locator('#export').isDisabled()&&await p.locator('#stats strong').count()===0&&await p.evaluate(()=>savedBlobs.length)===1);
  await p.evaluate(async()=>{mock143.fail=null;month='2026-11';document.querySelector('#month').value=month;await loadMonth()});
  check('empty month has zero closed deliveries',await p.locator('#stats strong').first().textContent()==='0');
  await p.evaluate(async()=>{mock143.reportDelay=100;month='2026-10';const first=loadMonth();month='2026-12';document.querySelector('#month').value=month;await Promise.all([first,loadMonth()]);});
  check('month race cannot restore earlier month data',await p.locator('#stats strong').first().textContent()==='0'&&await p.locator('#month').inputValue()==='2026-12');
  await p.evaluate(async()=>{mock143.reportDelay=0;mock143.finalized.deliveries[0].finalized=false;month='2026-10';await loadMonth()});
  check('malformed/unfinalized payload fails closed',await p.locator('#export').isDisabled());await ctx.close();
 }
 for(const file of ['ui-monthly.html','monthly.html']){
  const {ctx,p,errors}=await setup(1366,'dispatcher',file,false);
  if(file==='ui-monthly.html')check('Karen blocked from current monthly URL',await p.locator('#export').count()===0);
  else {await p.waitForSelector('#finance-blocked');check('Karen blocked from legacy monthly URL',await p.locator('#finance-main').isHidden());}
  check(`${file} does not request financial records when unauthorized`,await p.evaluate(()=>!mock143.calls.some(c=>c.fn==='dashboard_get_finalized_monthly')));check(`${file} no JS errors`,errors.length===0);await ctx.close();
 }
 {
  const {ctx,p,errors}=await setup(1366,'dispatcher','monthly.html',true);await p.waitForFunction(()=>mock143.calls.some(c=>c.fn==='dashboard_get_finalized_monthly'));await p.waitForFunction(()=>document.querySelector('#finance-message')?.textContent.includes('資料已更新')||document.querySelector('#finance-feedback')?.textContent.includes('資料已更新'));
  check('legacy monthly uses finalized RPC without raw execution query',await p.evaluate(()=>!mock143.reads.includes('trip_executions')));check('legacy monthly no JavaScript errors: '+errors.join(';'),errors.length===0);await ctx.close();
 }
 console.log(`RESULT: ${count} Increment 1.4.7 browser assertions passed`);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
