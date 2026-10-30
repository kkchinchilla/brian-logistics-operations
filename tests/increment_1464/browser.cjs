/* Actual app assets with fictional responses only; no connection to either backend. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'_screenshots');fs.mkdirSync(out,{recursive:true});
const fixture=fs.readFileSync(path.join(root,'tests/increment_1421/fixture.js'),'utf8').replaceAll('2026-10-25','2026-10-30');
function backend(actor){return fixture+`
 const f=attendanceFixture1421;f.state.actor=${JSON.stringify(actor)};
 f.tables.profiles.push({id:'owner',display_name:'展示管理員',role:'dispatcher',active:true});
 f.tables.delivery_regions=[{id:1,name:'北區'}];f.tables.delivery_temperature_zones=[{name:'常溫'},{name:'冷藏'}];
 f.tables.delivery_region_zone_rates=[];f.tables.duty_assignment_rates=[];
 for(const r of f.tables.routes)r.delivery_region_id=1;
 f.db.auth.getSession=async()=>({data:{session:{user:{id:f.state.actor}}}});
 const originalRPC=f.db.rpc;
 f.db.rpc=async(name,args)=>{
  if(name==='dashboard_get_capabilities')return {data:{increment:'1.4.6',can_manage_finance:f.state.actor==='owner'}};
  if(name==='dashboard_get_calculated_payroll'){
   f.state.calls.push({rpc:name,args});
   const finalized={version:147,month:args.p_month,deliveries:[],standby:[],special_work:[],attendance_records:[],original_runs:[],dates:[]};
   const summaries=f.tables.profiles.filter(p=>p.role==='driver').map(p=>({driverId:p.id,name:p.display_name,count:0,standbyCount:0,followAlongCount:0,learningCount:0,rentalCount:0,unknownRentalCount:0,variable:0,rentalDeduction:0,adjustment:0,standbyPay:0,followAlongPay:0,learningPay:0,basicSubtotal:0,salary:0,issues:[],knownItemsReady:true,salaryReady:true}));
   return {data:{version:1491,month:args.p_month,finalized,route_rates:[],supplements:[],adjustments:[],expenses:[],calculation:{version:1431,engine:'database',month:args.p_month.slice(0,7),summaries,lines:[],issues:[],expenses:[],dates:[]}}};
  }
  return originalRPC(name,args);
 };
 f.db.functions={invoke:async()=>({data:{actor_id:f.state.actor,users:f.tables.profiles.map(p=>({...p,is_owner:p.id==='owner',phone:'886900000001',phone_confirmed:true}))}})};
 const db=f.db;
`}
const cases=[['driver-one','attendance'],['supervisor','attendance'],['supervisor','routes'],['supervisor','vehicles'],...['attendance','routes','vehicles','monthly','accounts'].map(p=>['owner',p])];
const ready={attendance:'#driver-content .driver-card,#attendance-table table',routes:'#routes-body tr',vehicles:'#fleet-table table',monthly:'#monthly-body table',accounts:'#account-list table'};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});let checks=0;
 try{
  for(const prefix of ['', 'reviewer/'])for(const [actor,dashboard]of cases){
   const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Taipei'}),page=await context.newPage(),errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.clock.install({time:new Date('2026-10-30T04:00:00Z')});
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());if(url.hostname!=='huoyitong.test'){external.push(url.href);return route.abort();}
    const rel=decodeURIComponent(url.pathname).replace(/^\//,''),file=path.join(root,'dist',rel);
    if(!file.startsWith(path.join(root,'dist')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
    let body=fs.readFileSync(file);
    if(rel.endsWith('js/config.js'))body=Buffer.from(backend(actor));
    await route.fulfill({status:200,body,contentType:mime[path.extname(file)]||'application/octet-stream'});
   });
   await page.goto('http://huoyitong.test/'+prefix+'ui-'+dashboard+'.html');
   await page.waitForSelector(ready[dashboard]);
   await page.evaluate(async()=>{
    await Promise.all([document.fonts.load('600 20px Inter','2026'),document.fonts.load('500 20px "Noto Sans TC"','貨易通年月日')]);
    await document.fonts.ready;
   });
   assert.equal(errors.length,0,errors.join(';'));assert.equal(external.length,0,'Fixture must never contact external services');
   assert.equal(await page.locator('.reviewer-notice').count(),prefix?1:0);
   assert(await page.evaluate(()=>document.fonts.check('600 20px Inter','2026')&&document.fonts.check('500 20px "Noto Sans TC"','貨易通年月日')),'Bundled fonts load');
   for(const width of [320,390,844,1366]){
    await page.setViewportSize({width,height:width===844?390:900});
    await page.evaluate(()=>document.fonts.ready);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${prefix}${actor}/${dashboard} ${width}: no page overflow`);
    const style=await page.evaluate(()=>({font:getComputedStyle(document.body).fontFamily,links:[...document.querySelectorAll('.dashboard-footer .privacy-links a')].every(e=>getComputedStyle(e).textDecorationLine==='none')}));
    assert(style.font.startsWith('Inter'));assert(style.font.includes('Noto Sans TC'));assert(style.links);
    if(dashboard==='attendance'||dashboard==='monthly'){
     const layout=await page.evaluate(()=>{
      const label=document.querySelector('.compact-date-label'),input=document.querySelector('.compact-date-native'),nav=document.querySelector('.compact-date-navigation');
      const l=label.getBoundingClientRect(),r=nav.getBoundingClientRect(),buttons=[...nav.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
      return {size:getComputedStyle(label).fontSize,color:getComputedStyle(label).color,line:getComputedStyle(label).lineHeight,touch:buttons.every(b=>b.width>=44&&b.height>=44),inside:l.left>=r.left&&l.right<=r.right,sameRow:buttons.every(b=>b.top<l.bottom&&b.bottom>l.top),picker:input.getBoundingClientRect().width>0};
     });
     assert.deepEqual([layout.size,layout.color,layout.line],['20px','rgb(255, 255, 255)','24px']);
     assert(layout.touch&&layout.inside&&layout.sameRow&&layout.picker,JSON.stringify(layout));
    }
    if(actor==='driver-one')assert.equal(await page.locator('.mobilebar:visible,#new-run,#close').count(),0);
    if(dashboard==='routes')assert.equal(await page.locator('.compact-date-native').count(),0,'No new date navigator on routes');
    if(width===390||width===1366)await page.screenshot({path:path.join(out,`${prefix?'reviewer':'company'}-${actor}-${dashboard}-${width}.png`),fullPage:true});
    checks++;
   }
   // Approximate Android text enlargement by doubling computed font sizes.
   // This supplements, and does not replace, the actual phone acceptance check.
   await page.setViewportSize({width:390,height:844});
   await page.evaluate(()=>{
    const sizes=[...document.querySelectorAll('body,body *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);
    for(const [e,size]of sizes)if(Number.isFinite(size))e.style.fontSize=size*2+'px';
   });
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${dashboard}: enlarged text overflow`);
   if(dashboard==='attendance'||dashboard==='monthly'){
    assert(await page.evaluate(()=>{
     const r=document.querySelector('.compact-date-navigation').getBoundingClientRect();
     return [...document.querySelectorAll('.compact-date-label,.compact-date-arrows')].every(e=>{const x=e.getBoundingClientRect();return x.left>=r.left-1&&x.right<=r.right+1;});
    }),'Enlarged date label/arrow controls remain inside the navigator');
   }
   assert.equal(errors.length,0,errors.join(';'));assert.equal(external.length,0);
   await page.screenshot({path:path.join(out,`${prefix?'reviewer':'company'}-${actor}-${dashboard}-large-text.png`),fullPage:true});
   await context.close();console.log('PASS:',prefix||'company/',actor,dashboard);
  }
  console.log(`RESULT: ${checks} viewport checks plus 18 enlarged-text checks passed; screenshots in ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
