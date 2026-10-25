import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {configurePrivacy,privacyResources} from '../../scripts/configure-android-privacy.mjs';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'huoyitong-privacy-'));
const xml=text=>new JSDOM(text,{contentType:'application/xml'}).window.document;
const ns='http://schemas.android.com/apk/res/android';
const domains=['root','file','database','sharedpref','external','device_root','device_file','device_database','device_sharedpref'];
const original=`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="${ns}">
<!-- Example only: <application android:allowBackup="true"> -->
<application android:allowBackup="true" android:label="@string/app_name" android:icon="@mipmap/huoyitong_launcher" android:roundIcon="@mipmap/huoyitong_launcher_round" android:theme="@style/AppTheme">
 <activity android:name=".MainActivity" android:exported="true" android:launchMode="singleTask"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity>
 <provider android:name="androidx.core.content.FileProvider" android:authorities="\${applicationId}.fileprovider" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths"/></provider>
</application><uses-permission android:name="android.permission.INTERNET"/></manifest>`;
const oldPaths='<paths><external-path name="my_images" path="."/><cache-path name="my_cache_images" path="."/></paths>';
const main=path.join(temp,'app/src/main'),manifest=path.join(main,'AndroidManifest.xml'),paths=path.join(main,'res/xml/file_paths.xml');
try{
 for(const content of Object.values(privacyResources))assert.ok(!xml(content).querySelector('parsererror'));
 const legacy=xml(privacyResources['xml/huoyitong_backup_rules.xml']);
 const modern=xml(privacyResources['xml/huoyitong_data_extraction_rules.xml']);
 for(const scope of [legacy.documentElement,modern.querySelector('cloud-backup'),modern.querySelector('device-transfer')]){
  assert.ok(scope);assert.equal(scope.querySelectorAll('include').length,0);
  assert.deepEqual([...scope.querySelectorAll('exclude')].map(n=>n.getAttribute('domain')).sort(),domains.toSorted());
  assert.ok([...scope.querySelectorAll('exclude')].every(n=>n.getAttribute('path')==='.'));
 }
 console.log('PASS: legacy backup, modern cloud backup and device transfer exclude all local storage domains');
 const share=xml(privacyResources['xml/file_paths.xml']);
 assert.equal(share.documentElement.children.length,1);
 const allowed=share.querySelector('cache-path');assert.equal(allowed.getAttribute('path'),'payroll-exports/');
 assert.equal(share.querySelectorAll('external-path,root-path,files-path,external-files-path').length,0);
 // Exercise the REAL export helper and check both output types fall in the
 // declared cache subtree; no simulated exporter with a duplicated path string.
 const writes=[],uris=[];
 const ctx={Date,Capacitor:{getPlatform:()=> 'android',isPluginAvailable:()=>true,registerPlugin:name=>name==='Filesystem'?{
  async writeFile(options){writes.push(options);return {uri:'file:///cache/'+options.path};}
 }:{async share(options){uris.push(...options.files);}}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/report-export.js','utf8'),ctx);
 for(const filename of ['月度出勤_2026-10.csv','計薪對帳_2026-10.csv'])await ctx.ReportExport.csv(filename,'\ufeff司機,金額\r\n測試,400');
 const folder=path.resolve('/cache',allowed.getAttribute('path'))+path.sep;
 for(const [i,write] of writes.entries()){
  assert.equal(write.directory,'CACHE');assert.ok(path.resolve('/cache',write.path).startsWith(folder));assert.equal(uris[i],'file:///cache/'+write.path);
 }
 console.log('PASS: both real CSV exports remain inside the only shareable cache subtree');
 assert.throws(()=>configurePrivacy(path.join(temp,'missing')),/not found/);assert.equal(fs.existsSync(path.join(temp,'missing')),false);
 fs.mkdirSync(path.dirname(paths),{recursive:true});fs.writeFileSync(manifest,original);fs.writeFileSync(paths,oldPaths);
 assert.throws(()=>configurePrivacy(temp,{checkOnly:true}),/not applied/);assert.equal(fs.readFileSync(manifest,'utf8'),original);
 assert.equal(configurePrivacy(temp),4);
 const updated=fs.readFileSync(manifest,'utf8'),app=xml(updated).querySelector('application');
 assert.equal(app.getAttributeNS(ns,'allowBackup'),'false');
 assert.equal(app.getAttributeNS(ns,'fullBackupContent'),'@xml/huoyitong_backup_rules');
 assert.equal(app.getAttributeNS(ns,'dataExtractionRules'),'@xml/huoyitong_data_extraction_rules');
 for(const attr of ['label','icon','roundIcon','theme'])assert.equal(app.getAttributeNS(ns,attr),xml(original).querySelector('application').getAttributeNS(ns,attr));
 assert.ok(updated.includes('<!-- Example only: <application android:allowBackup="true"> -->'));
 for(const selector of ['activity','provider','uses-permission'])assert.equal(xml(updated).querySelector(selector).outerHTML,xml(original).querySelector(selector).outerHTML);
 const backup=path.join(temp,'.huoyitong-privacy-backup');
 assert.equal(fs.readFileSync(path.join(backup,'AndroidManifest.xml'),'utf8'),original);assert.equal(fs.readFileSync(path.join(backup,'res/xml/file_paths.xml'),'utf8'),oldPaths);
 assert.equal(configurePrivacy(temp),0);assert.equal(configurePrivacy(temp,{checkOnly:true}),0);assert.equal(fs.readFileSync(path.join(backup,'AndroidManifest.xml'),'utf8'),original);
 console.log('PASS: manifest references, icons, activity, provider permissions, backups and repeat installation');
 for(const invalid of [original.replace('android:allowBackup="true" android:label','android:backupAgent=".CustomBackup" android:label'),original.replace('android:exported="false"','android:exported="true"'),original.replace('@xml/file_paths','@xml/other_paths')]){
  fs.writeFileSync(manifest,invalid);assert.throws(()=>configurePrivacy(temp),/Nothing changed/);assert.equal(fs.readFileSync(manifest,'utf8'),invalid);
 }
 fs.writeFileSync(manifest,updated);fs.writeFileSync(paths,oldPaths);
 assert.throws(()=>configurePrivacy(temp,{checkOnly:true}),/not applied/);assert.equal(fs.readFileSync(paths,'utf8'),oldPaths);
 console.log('PASS: unexpected custom configuration is rejected; verification detects reverted sharing rules without writing');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
