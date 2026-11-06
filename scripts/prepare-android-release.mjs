// Update only the existing native project's release version; no signing secrets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function prepareAndroidRelease(root=process.cwd(),check=false){
 const file=path.join(root,'android/app/build.gradle');
 if(!fs.existsSync(file))throw Error('Use the existing Android project on your Mac. Do not recreate it.');
 const before=fs.readFileSync(file,'utf8');
 if(!/applicationId\s+["']io\.github\.kkchinchilla\.huoyitong["']/.test(before))throw Error('Unexpected applicationId; no changes made.');
 const codes=[...before.matchAll(/\bversionCode\s+(\d+)/g)],names=[...before.matchAll(/\bversionName\s+(["'])([^"']+)\1/g)];
 if(codes.length!==1||names.length!==1)throw Error('Unexpected Gradle version configuration; no changes made.');
 if(![1,2].includes(Number(codes[0][1]))||!['1.0','1.0.1'].includes(names[0][2]))throw Error('Native version has moved on; review the next unused Play version code.');
 const after=before.replace(/\bversionCode\s+\d+/,'versionCode 2').replace(/\bversionName\s+(["'])[^"']+\1/,'versionName "1.0.1"');
 if(check&&before!==after)throw Error('Expected versionCode 2 and versionName 1.0.1. Run this script without --check first.');
 if(before!==after){
  const backup=path.join(root,'android/.huoyitong-release-backup/build.gradle.before-1468');
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  if(!fs.existsSync(backup))fs.writeFileSync(backup,before,{flag:'wx'});
  fs.writeFileSync(file,after);
 }
 return {applicationId:'io.github.kkchinchilla.huoyitong',versionCode:2,versionName:'1.0.1'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.slice(2).some(x=>x!=='--check'))throw Error('Only --check is supported.');console.log(prepareAndroidRelease(process.cwd(),process.argv.includes('--check')));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
