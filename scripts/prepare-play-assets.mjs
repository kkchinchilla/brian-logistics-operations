// Draft Play artwork only; final screenshots must come from the signed app.
// Requires sharp, Python/Pillow, and a local Traditional Chinese font (FONT_FILE).
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp')}catch{if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw Error('Install sharp to generate artwork');sharp=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp'));}
const font=process.env.FONT_FILE;if(!font||!fs.existsSync(font))throw Error('FONT_FILE must point to a local Traditional Chinese font');
const out=path.join(root,'docs/android/play-assets');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'assets/tangguanjia-logo.svg'),'utf8');
// Google Play applies the corner mask. Keep the original arrow and square background.
await sharp(Buffer.from(source.replace('rx="90" ry="90"','rx="0" ry="0"'))).resize(512,512).ensureAlpha().png().toFile(path.join(out,'store-icon-512.png'));
const logo=await sharp(Buffer.from(source)).resize(200,200).png().toBuffer();
const result=spawnSync(process.env.PYTHON||'python3',['-c',`
import sys,io
from PIL import Image,ImageDraw,ImageFont
font,out=sys.argv[1:]
im=Image.new('RGB',(1024,500),'#202226')
logo=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGBA')
im.paste(logo,(92,150),logo)
d=ImageDraw.Draw(im)
f=ImageFont.truetype(font,74)
try:f.set_variation_by_name('Bold')
except (ValueError,OSError):pass
d.text((356,132),'貨易通',font=f,fill='#ffffff')
f=ImageFont.truetype(font,26)
try:f.set_variation_by_name('Medium')
except (ValueError,OSError):pass
d.text((356,260),'配送排班・每日出勤',font=f,fill='#ffc533')
d.text((356,307),'團隊協作・月度對帳',font=f,fill='#ffc533')
im.save(out)
`,font,path.join(out,'feature-graphic-1024x500.png')],{input:logo});
if(result.status!==0)throw Error(result.stderr.toString());
for(const [name,width,height] of [['store-icon-512.png',512,512],['feature-graphic-1024x500.png',1024,500]]){
 const m=await sharp(path.join(out,name)).metadata();if(m.width!==width||m.height!==height)throw Error('Wrong asset dimensions');
}
console.log('Draft store icon and feature graphic generated. Final signed-app screenshots remain pending.');
