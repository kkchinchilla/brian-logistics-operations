import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const header='<?xml version="1.0" encoding="utf-8"?>\n';
// Exclude local state in every Android backup domain. Operational records live
// on the server; WebView sessions must not be restored onto another installation.
const domains=['root','file','database','sharedpref','external','device_root','device_file','device_database','device_sharedpref'];
const exclusions=indent=>domains.map(domain=>`${indent}<exclude domain="${domain}" path="." />`).join('\n');
export const privacyResources={
 'xml/huoyitong_backup_rules.xml':`${header}<full-backup-content>\n${exclusions('  ')}\n</full-backup-content>\n`,
 'xml/huoyitong_data_extraction_rules.xml':`${header}<data-extraction-rules>\n  <cloud-backup>\n${exclusions('    ')}\n  </cloud-backup>\n  <device-transfer>\n${exclusions('    ')}\n  </device-transfer>\n</data-extraction-rules>\n`,
 'xml/file_paths.xml':`${header}<paths xmlns:android="http://schemas.android.com/apk/res/android">\n  <cache-path name="payroll_exports" path="payroll-exports/" />\n</paths>\n`
};
function attribute(tag,name){return tag.match(new RegExp(`\\bandroid:${name}\\s*=\\s*(["'])(.*?)\\1`))?.[2];}
function setAttribute(tag,name,value){
 const re=new RegExp(`\\bandroid:${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`);
 return re.test(tag)?tag.replace(re,`android:${name}="${value}"`):tag.replace(/>$/,`\n        android:${name}="${value}">`);
}
export function configurePrivacy(androidDir,{checkOnly=false}={}){
 const main=path.join(androidDir,'app/src/main'),manifestPath=path.join(main,'AndroidManifest.xml');
 if(!fs.existsSync(manifestPath))throw Error(`Android project not found at ${androidDir}. Nothing changed.`);
 const original=fs.readFileSync(manifestPath,'utf8');
 // Mask comments without shifting offsets, so examples in comments are never edited.
 const masked=original.replace(/<!--[\s\S]*?-->/g,comment=>' '.repeat(comment.length));
 const apps=[...masked.matchAll(/<application\b[^>]*>/g)];
 if(apps.length!==1||!masked.includes('http://schemas.android.com/apk/res/android'))throw Error('Unrecognized Android manifest. Nothing changed.');
 const app=apps[0],tag=original.slice(app.index,app.index+app[0].length);
 if(attribute(tag,'backupAgent'))throw Error('Custom BackupAgent found; review its behavior before applying this policy. Nothing changed.');
 const providers=[...masked.matchAll(/<provider\b[^>]*>[\s\S]*?<\/provider>/g)].filter(p=>attribute(p[0].split('>')[0],'name')==='androidx.core.content.FileProvider');
 if(providers.length!==1)throw Error('Expected one AndroidX FileProvider. Nothing changed.');
 const provider=providers[0][0],providerTag=provider.slice(0,provider.indexOf('>')+1);
 const metadata=[...provider.matchAll(/<meta-data\b[^>]*>/g)].find(m=>attribute(m[0],'name')==='android.support.FILE_PROVIDER_PATHS');
 if(attribute(providerTag,'exported')!=='false'||attribute(providerTag,'grantUriPermissions')!=='true'||
    attribute(providerTag,'authorities')!=='${applicationId}.fileprovider'||!metadata||attribute(metadata[0],'resource')!=='@xml/file_paths'){
  throw Error('FileProvider configuration differs from the inspected project. Nothing changed.');
 }
 let updatedTag=tag;
 for(const [key,value] of Object.entries({allowBackup:'false',fullBackupContent:'@xml/huoyitong_backup_rules',dataExtractionRules:'@xml/huoyitong_data_extraction_rules'}))updatedTag=setAttribute(updatedTag,key,value);
 const manifest=original.slice(0,app.index)+updatedTag+original.slice(app.index+tag.length);
 const files=Object.entries(privacyResources).map(([relative,content])=>({relative:'res/'+relative,file:path.join(main,'res',relative),content}));
 // Install referenced resources first and the manifest last.
 files.push({relative:'AndroidManifest.xml',file:manifestPath,content:manifest});
 const changed=files.filter(({file,content})=>!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==content);
 if(checkOnly){
  if(changed.length)throw Error('Privacy configuration is not applied: '+changed.map(f=>f.relative).join(', '));
  return 0;
 }
 const backupRoot=path.join(androidDir,'.huoyitong-privacy-backup');
 // Back up all existing target files before starting any modification.
 for(const {relative,file} of changed){
  const backup=path.join(backupRoot,relative);
  if(fs.existsSync(file)&&!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(file,backup);}
 }
 for(const {file,content} of changed){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file+'.huoyitong-tmp',content);fs.renameSync(file+'.huoyitong-tmp',file);
 }
 return changed.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),checkOnly=args.includes('--check');
  const positional=args.filter(arg=>arg!=='--check');
  if(positional.length>1||positional.some(arg=>arg.startsWith('--')))throw Error('Usage: node scripts/configure-android-privacy.mjs [android-directory] [--check]');
  const androidDir=path.resolve(positional[0]||path.join(root,'android'));
  const count=configurePrivacy(androidDir,{checkOnly});
  console.log(checkOnly?'Verified Android backup exclusions and CSV-only sharing.':`Applied Android privacy settings (${count} files changed). Original files backed up in android/.huoyitong-privacy-backup/.`);
  if(!checkOnly)console.log('Next: build/sync, then Run in Android Studio. Keep the installed app and its data.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
