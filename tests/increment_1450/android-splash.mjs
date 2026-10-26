import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installIcon} from '../../scripts/install-android-icon.mjs';
import {configureSplash,splashXml} from '../../scripts/configure-android-splash.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'huoyitong-splash-'));
const template=Buffer.from(fs.readFileSync(new URL('./template-splash.base64',import.meta.url),'utf8'),'base64');
function fixture(name){
 const dir=path.join(tmp,name),main=path.join(dir,'app/src/main');
 const put=(relative,text)=>{const f=path.join(main,relative);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text);};
 put('AndroidManifest.xml','<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/><application android:allowBackup="false"><activity android:theme="@style/AppTheme.NoActionBarLaunch"/></application></manifest>');
 put('res/values/styles.xml','<resources><style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen"><item name="android:background">@drawable/splash</item></style></resources>');
 put('res/drawable/splash.png',template);
 put('res/drawable-land-mdpi/splash.png',template);
 put('res/drawable/keep.png','unrelated resource');
 put('res/xml/file_paths.xml','<paths><cache-path name="payroll_exports" path="payroll-exports/"/></paths>');
 installIcon(dir);
 return {dir,main,put};
}
function snapshot(dir){
 const files={};
 const walk=p=>{for(const entry of fs.readdirSync(p,{withFileTypes:true})){const file=path.join(p,entry.name);if(entry.isDirectory())walk(file);else files[path.relative(dir,file)]=fs.readFileSync(file).toString('base64');}};
 walk(dir);return files;
}
try{
 const f=fixture('normal'),before=snapshot(f.dir);
 assert.throws(()=>configureSplash(f.dir,{checkOnly:true}),/not applied/);
 assert.deepEqual(snapshot(f.dir),before,'check-only must not write');
 assert.deepEqual(configureSplash(f.dir),{written:1,removed:2});
 assert.equal(fs.readFileSync(path.join(f.main,'res/drawable/splash.xml'),'utf8'),splashXml);
 for(const relative of ['drawable/splash.png','drawable-land-mdpi/splash.png']){
  assert(!fs.existsSync(path.join(f.main,'res',relative)));
  assert.deepEqual(fs.readFileSync(path.join(f.dir,'.huoyitong-splash-backup/res',relative)),template);
 }
 const after=snapshot(f.dir);
 for(const [name,bytes] of Object.entries(before)){
  if(!['app/src/main/res/drawable/splash.png','app/src/main/res/drawable-land-mdpi/splash.png'].includes(name))assert.equal(after[name],bytes,'unrelated file changed: '+name);
 }
 assert.deepEqual(configureSplash(f.dir),{written:0,removed:0});
 assert.deepEqual(configureSplash(f.dir,{checkOnly:true}),{written:0,removed:0});
 assert.deepEqual(snapshot(f.dir),after,'rerun must preserve backups and resources');
 for(const [name,alter,expected] of [
  ['modified',f=>f.put('res/drawable-land-mdpi/splash.png','custom image'),/modified splash/],
  ['new-variant',f=>f.put('res/drawable-night/splash.xml','<shape/>'),/Unrecognized/],
  ['custom-xml',f=>f.put('res/drawable/splash.xml','<shape/>'),/Custom splash/],
  ['missing-icon',f=>fs.unlinkSync(path.join(f.main,'res/mipmap-anydpi-v33/huoyitong_launcher.xml')),/launcher icon first/],
  ['different-theme',f=>f.put('res/values/styles.xml','<resources/>'),/Launch theme differs/],
  ['conflicting-backup',f=>{const p=path.join(f.dir,'.huoyitong-splash-backup/res/drawable');fs.mkdirSync(p,{recursive:true});fs.writeFileSync(path.join(p,'splash.png'),'custom backup');},/backup differs/]
 ]){
  const f=fixture(name);alter(f);const before=snapshot(f.dir);
  assert.throws(()=>configureSplash(f.dir),expected);
  assert.deepEqual(snapshot(f.dir),before,name+' must fail before any modification');
 }
 assert.throws(()=>configureSplash(path.join(tmp,'missing')),/project not found/);
 console.log('Android splash safety, backup, idempotence and preservation checks passed.');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
