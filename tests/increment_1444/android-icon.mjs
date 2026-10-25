import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {iconResources,installIcon} from '../../scripts/install-android-icon.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'huoyitong-icon-'));
const resources=iconResources();
try{
 for(const [file,xml] of Object.entries(resources)){
  const doc=new JSDOM(xml,{contentType:'application/xml'}).window.document;
  assert.ok(!doc.querySelector('parsererror'),file);
  for(const node of doc.querySelectorAll('[*|drawable]')){
   const ref=node.getAttribute('android:drawable');
   if(ref?.startsWith('@drawable/'))assert.ok(resources['drawable/'+ref.slice(10)+'.xml'],ref);
  }
 }
 assert.equal(Object.keys(resources).length,8);
 assert.match(resources['drawable/huoyitong_icon_background.xml'],/#ffc533/);
 const svg=fs.readFileSync('assets/tangguanjia-logo.svg','utf8');
 assert.ok(resources['drawable/huoyitong_icon_foreground.xml'].includes(svg.match(/<path\b[^>]*\bd="([^"]+)"/)[1]));
 assert.match(resources['mipmap-anydpi-v33/huoyitong_launcher.xml'],/<monochrome/);
 assert.doesNotMatch(resources['mipmap-anydpi-v26/huoyitong_launcher.xml'],/<monochrome/);
 assert.throws(()=>installIcon(path.join(temp,'missing')),/not found/);
 assert.equal(fs.existsSync(path.join(temp,'missing')),false);
 const main=path.join(temp,'app/src/main');fs.mkdirSync(main,{recursive:true});
 const original=`<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application android:icon="@mipmap/ic_launcher" android:label="貨易通"><activity android:name="MainActivity" android:exported="true" android:icon="@mipmap/activity_icon" /></application><uses-permission android:name="android.permission.INTERNET" /></manifest>`;
 const manifest=path.join(main,'AndroidManifest.xml');fs.writeFileSync(manifest,original);
 assert.equal(installIcon(temp),8);
 const installed=fs.readFileSync(manifest,'utf8');
 assert.match(installed,/android:icon="@mipmap\/huoyitong_launcher"/);
 assert.match(installed,/android:roundIcon="@mipmap\/huoyitong_launcher_round"/);
 assert.match(installed,/android:icon="@mipmap\/activity_icon"/);
 assert.match(installed,/android.permission.INTERNET/);
 assert.equal(fs.readFileSync(path.join(temp,'.huoyitong-icon-backup/AndroidManifest.xml'),'utf8'),original);
 assert.equal(installIcon(temp),8);
 assert.equal(fs.readFileSync(manifest,'utf8'),installed);
 assert.equal(fs.readFileSync(path.join(temp,'.huoyitong-icon-backup/AndroidManifest.xml'),'utf8'),original);
 for(const [file,content] of Object.entries(resources))assert.equal(fs.readFileSync(path.join(main,'res',file),'utf8'),content);
 assert.throws(()=>iconResources('<svg/>'),/format changed/);
 console.log('PASS: icon XML/resources, original logo paths, isolated manifest updates, backup, repeat install, and missing-project protection');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
