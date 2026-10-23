// Run after npm run build. These fictional QA pages stay inside ignored dist/.
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fixture=read('tests/increment_1421/fixture.js');
for(const actor of ['driver-one','supervisor']){
 let html=read('ui-attendance.html').replace(/<script src="https:[^"]+"[^>]*><\/script>/g,'');
 html=html.replace('<script src="js/config.js"></script>',`<script>${fixture}\nattendanceFixture1421.state.actor=${JSON.stringify(actor)};const db=attendanceFixture1421.db;</script>`);
 html=html.replace(/<script src="js\/production-common.js[^>]+><\/script>/,`<script>${read('js/production-common.js').replace("const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});","const today=()=> '2026-10-25';")}</script>`);
 html=html.replace('</head>','<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; connect-src \'none\'"></head>');
 fs.writeFileSync('dist/__qa-'+actor+'.html',html);
}
const controls=`<label>Viewport <select id="size" onchange="document.getElementById('preview').style.width=this.value+'px'"><option>320</option><option selected>390</option><option>430</option><option>768</option><option>1024</option><option>1280</option></select></label> <label>Role <select id="role" onchange="document.getElementById('preview').src='__qa-'+this.value+'.html'"><option value="driver-one">Driver</option><option value="supervisor">Supervisor</option></select></label>`;
fs.writeFileSync('dist/__qa-responsive.html',`<!doctype html><html><head><meta charset="utf-8"><title>Increment 1.4.21 responsive QA</title><style>body{margin:0;background:#e8e8e8;font:14px sans-serif}header{padding:12px 20px;background:#fff;display:flex;gap:20px;align-items:center}select{padding:6px}iframe{display:block;border:0;margin:16px auto;background:#202328;height:850px;max-width:none}</style></head><body><header><strong>Local QA · fictional records</strong>${controls}</header><iframe id="preview" title="Responsive attendance preview" src="__qa-driver-one.html" style="width:390px"></iframe></body></html>`);
console.log('Local fictional responsive preview: /__qa-responsive.html');
