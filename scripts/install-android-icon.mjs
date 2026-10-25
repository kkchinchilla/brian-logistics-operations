import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const header='<?xml version="1.0" encoding="utf-8"?>\n';
const ns='xmlns:android="http://schemas.android.com/apk/res/android"';

// Preserve the approved SVG paths instead of approximating or redrawing the logo.
export function iconResources(svg=fs.readFileSync(path.join(root,'assets/tangguanjia-logo.svg'),'utf8')){
 const arrow=svg.match(/<path\b[^>]*\bd="([^"]+)"/);
 const dot=svg.match(/<circle\b[^>]*\bcx="([\d.]+)"[^>]*\bcy="([\d.]+)"[^>]*\br="([\d.]+)"/);
 const yellow=svg.match(/\.st0\s*\{\s*fill:\s*(#[\da-f]{6})/i);
 if(!arrow||!dot||!yellow||!svg.includes('viewBox="0 0 360 360"'))throw Error('Logo SVG format changed; review the icon conversion before installing.');
 const [x,y,r]=dot.slice(1).map(Number);
 const circle=`M${x-r},${y}a${r},${r} 0,1 0,${2*r},0a${r},${r} 0,1 0,-${2*r},0Z`;
 const mark=`    <path android:fillColor="#FFFFFF" android:pathData="${arrow[1]}" />\n    <path android:fillColor="#FFFFFF" android:pathData="${circle}" />`;
 const vector=(size,body)=>`${header}<vector ${ns} android:width="${size}dp" android:height="${size}dp" android:viewportWidth="360" android:viewportHeight="360">\n${body}\n</vector>\n`;
 // Center the mark in the adaptive layer; keep its dot and arrow inside the
 // central 66dp safe circle on a 108dp canvas, including circular OEM masks.
 const foreground=vector(108,`  <group android:pivotX="180" android:pivotY="193" android:scaleX="0.96" android:scaleY="0.96" android:translateY="-13">\n${mark}\n  </group>`);
 const adaptive=monochrome=>`${header}<adaptive-icon ${ns}>\n  <background android:drawable="@drawable/huoyitong_icon_background" />\n  <foreground android:drawable="@drawable/huoyitong_icon_foreground" />\n${monochrome?'  <monochrome android:drawable="@drawable/huoyitong_icon_foreground" />\n':''}</adaptive-icon>\n`;
 const resources={
  'drawable/huoyitong_icon_background.xml':`${header}<shape ${ns} android:shape="rectangle"><solid android:color="${yellow[1]}" /></shape>\n`,
  'drawable/huoyitong_icon_foreground.xml':foreground
 };
 for(const round of [false,true]){
  const name='huoyitong_launcher'+(round?'_round':'');
  const background=round?'M0,180a180,180 0,1 0,360,0a180,180 0,1 0,-360,0Z':'M90,0H270a90,90 0,0 1,90,90V270a90,90 0,0 1,-90,90H90a90,90 0,0 1,-90,-90V90a90,90 0,0 1,90,-90Z';
  resources[`mipmap-anydpi-v21/${name}.xml`]=vector(48,`  <path android:fillColor="${yellow[1]}" android:pathData="${background}" />\n${mark}`);
  resources[`mipmap-anydpi-v26/${name}.xml`]=adaptive(false);
  resources[`mipmap-anydpi-v33/${name}.xml`]=adaptive(true);
 }
 return resources;
}

export function installIcon(androidDir){
 const manifestPath=path.join(androidDir,'app/src/main/AndroidManifest.xml');
 if(!fs.existsSync(manifestPath))throw Error(`Android project not found at ${androidDir}. Run this from your existing project folder.`);
 const manifest=fs.readFileSync(manifestPath,'utf8');
 const app=manifest.match(/<application\b[^>]*>/);
 if(!app||!manifest.includes('xmlns:android="http://schemas.android.com/apk/res/android"'))throw Error('Unrecognized Android manifest. Nothing changed.');
 let tag=app[0];
 for(const [attribute,value] of [['icon','@mipmap/huoyitong_launcher'],['roundIcon','@mipmap/huoyitong_launcher_round']]){
  const re=new RegExp(`android:${attribute}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
  tag=re.test(tag)?tag.replace(re,`android:${attribute}="${value}"`):tag.replace(/>$/,` android:${attribute}="${value}">`);
 }
 const updated=manifest.replace(app[0],tag);
 const resources=iconResources(); // Validate all source assets before writing anything.
 const backupRoot=path.join(androidDir,'.huoyitong-icon-backup');
 const backup=(file,relative)=>{
  const dest=path.join(backupRoot,relative);
  if(fs.existsSync(file)&&!fs.existsSync(dest)){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);}
 };
 if(updated!==manifest)backup(manifestPath,'AndroidManifest.xml');
 for(const [relative,content] of Object.entries(resources)){
  const target=path.join(androidDir,'app/src/main/res',relative);
  if(fs.existsSync(target)&&fs.readFileSync(target,'utf8')===content)continue;
  backup(target,path.join('res',relative));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);
 }
 if(updated!==manifest)fs.writeFileSync(manifestPath,updated);
 return Object.keys(resources).length;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const count=installIcon(path.resolve(process.argv[2]||path.join(root,'android')));
  console.log(`Installed 貨易通 launcher icon (${count} resources). Open Android Studio and Run the app on your phone.`);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
