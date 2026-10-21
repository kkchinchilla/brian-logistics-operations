const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','js','attendance-board.js'),'utf8');
class El{constructor(){this.innerHTML='';this.textContent='';this.value='';this.hidden=false;this.dataset={};this.style={};this.classList={toggle(){}};this.ev={}} addEventListener(t,h){this.ev[t]=h}querySelector(){return {focus(){}}}replaceChildren(){}focus(){} }
const elements={};const get=id=>elements[id]||(elements[id]=new El());
const document={getElementById:get,querySelectorAll:()=>[],addEventListener:()=>{}};
const profile={id:'u1',display_name:'甲司機',role:'dispatcher',active:true};
const rows=[
  {id:101,service_date:'2026-10-17',scheduled_time:'08:00',driver_id:'u1',route_code_snapshot:'冷凍5',status:'assigned',profiles:{display_name:'甲司機'},vehicles:{plate_number:'5432'},routes:{route_code:'冷凍5',route_name:'第五趟'}},
  {id:102,service_date:'2026-10-17',scheduled_time:'13:00',driver_id:'u1',route_code_snapshot:'UAT-01',status:'assigned',profiles:{display_name:'甲司機'},vehicles:{plate_number:'7777'},routes:{route_code:'UAT-01',route_name:'非標準代碼'}}
];
const request=(table)=>({
 select(){return this},eq(){return this},order(){return this},range(){return this},single(){return Promise.resolve({data:profile,error:null})},
 then(done,fail){return Promise.resolve({data:table==='runs'?rows:[profile],error:null}).then(done,fail)}
});
const db={auth:{getUser:async()=>({data:{user:{id:'u1'}},error:null})},from:request};
const loc={search:'',replace:()=>{throw Error('unexpected login redirect')}};
vm.runInNewContext(src,{document,window:{location:loc},location:loc,db,console,URLSearchParams,setTimeout:()=>1,clearTimeout:()=>{},Date,structuredClone,Object});
setTimeout(()=>{
 try{
 assert.match(get('grid-head').innerHTML,/冷凍5/);
 assert.match(get('grid-head').innerHTML,/其他路線/);
 assert.match(get('grid-body').innerHTML,/5432/);
 assert.match(get('grid-body').innerHTML,/7777/);
 assert.equal(get('day-close').hidden,true);
 console.log('Read-only live projection: automatically detects 冷凍5, retains unmatched codes as 其他路線, keeps production closeout disabled.');
 }catch(e){console.error(e);process.exitCode=1}
},30);
