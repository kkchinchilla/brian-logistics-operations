import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Exact Capacitor template images inspected in the user's native project.
// Never delete a replacement image or a newly introduced resource variant.
const templates={
 'drawable-land-hdpi/splash.png':'08cc34ad7713fe7ed58bceaa37b2387b670c53cd60264b4bd6442db3098e75dc',
 'drawable-land-mdpi/splash.png':'5cf98b4451bd99b20df26f9e608a46946118be6b0ae90762f9ca1786a30c76ff',
 'drawable-land-xhdpi/splash.png':'22f87e1e3bc89aa01a7dbc39c9a4db058cd0bf4ad3fe9f55712bf69eb997f4bf',
 'drawable-land-xxhdpi/splash.png':'42aa26392546fcdee1b8d3ac6d4b41bfcceb41dc6a4f3a3c30c24a8a8f4db862',
 'drawable-land-xxxhdpi/splash.png':'60393ce8636fd263e4e1fea3fd4ab2de948c6295e898fda9b50ac4e5283be809',
 'drawable-port-hdpi/splash.png':'c5015f4ba3628392b538386c5e210f0b94f352a3160adab934fd0311972137ca',
 'drawable-port-mdpi/splash.png':'07fa579e1c83e04ba7f9cbcbfcf41b68e15fe3638f2c44a04e58b809103e6b69',
 'drawable-port-xhdpi/splash.png':'b73049cb37fe76d6c11b87a796766bf6af0c85483b31eb6a921657b0d764a4b9',
 'drawable-port-xxhdpi/splash.png':'0c7f1212f25b7b90e9a6e1d320013e4ff3d3e03e634cbb07b7b7981cac51627f',
 'drawable-port-xxxhdpi/splash.png':'3db071a03b2f8ffe0dfd4170fc59842d53cd15bba5e88af59401d58efabf7827',
 'drawable/splash.png':'5cf98b4451bd99b20df26f9e608a46946118be6b0ae90762f9ca1786a30c76ff'
};

// Explicit dp size keeps the logo centered without stretching in either orientation.
// Reference the installed icon so a future icon update is also reflected here.
export const splashXml=`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item><shape android:shape="rectangle"><solid android:color="#FFFFFF" /></shape></item>
  <item android:width="96dp" android:height="96dp" android:gravity="center"
        android:drawable="@mipmap/huoyitong_launcher" />
</layer-list>
`;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const withoutComments=text=>text.replace(/<!--[\s\S]*?-->/g,'');

export function configureSplash(androidDir,{checkOnly=false}={}){
 const main=path.join(androidDir,'app/src/main'),res=path.join(main,'res');
 const read=relative=>fs.readFileSync(path.join(main,relative),'utf8');
 if(!fs.existsSync(path.join(main,'AndroidManifest.xml')))throw Error('Android project not found. Nothing changed.');
 const manifest=withoutComments(read('AndroidManifest.xml'));
 const styles=withoutComments(read('res/values/styles.xml'));
 const launch=styles.match(/<style\b[^>]*name=["']AppTheme.NoActionBarLaunch["'][^>]*>[\s\S]*?<\/style>/)?.[0];
 if(!manifest.includes('@style/AppTheme.NoActionBarLaunch')||!launch?.match(/<item\s+name=["']android:background["']\s*>\s*@drawable\/splash\s*<\/item>/))throw Error('Launch theme differs from the inspected project. Nothing changed.');
 // Require the branded icon resources this drawable depends on, on all supported APIs.
 for(const relative of ['drawable/huoyitong_icon_background.xml','drawable/huoyitong_icon_foreground.xml',...['v21','v26','v33'].map(v=>`mipmap-anydpi-${v}/huoyitong_launcher.xml`)]){
  if(!fs.existsSync(path.join(res,relative)))throw Error('Install the 貨易通 launcher icon first. Missing '+relative+'. Nothing changed.');
 }
 const target=path.join(res,'drawable/splash.xml'),remove=[];
 // Preflight every variant and backup before any changes, including check-only mode.
 for(const dir of fs.readdirSync(res,{withFileTypes:true})){
  if(!dir.isDirectory()||!/^drawable(?:-|$)/.test(dir.name))continue;
  for(const name of fs.readdirSync(path.join(res,dir.name))){
   if(!/^splash\./.test(name))continue;
   const relative=dir.name+'/'+name,file=path.join(res,relative);
   if(fs.lstatSync(file).isSymbolicLink())throw Error('Symbolic splash resource needs review: '+relative+'. Nothing changed.');
   if(file===target){
    if(fs.readFileSync(file,'utf8')!==splashXml)throw Error('Custom splash.xml found. Nothing changed.');
   }else{
    const bytes=fs.readFileSync(file);
    if(!templates[relative]||digest(bytes)!==templates[relative])throw Error('Unrecognized or modified splash resource: '+relative+'. Nothing changed.');
    const backup=path.join(androidDir,'.huoyitong-splash-backup/res',relative);
    if(fs.existsSync(backup)&&digest(fs.readFileSync(backup))!==digest(bytes))throw Error('Existing backup differs: '+relative+'. Nothing changed.');
    remove.push({file,backup});
   }
  }
 }
 if(checkOnly){
  if(remove.length||!fs.existsSync(target))throw Error('Splash cleanup is not applied. Run without --check first.');
  return {removed:0,written:0};
 }
 for(const {file,backup} of remove){
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  if(!fs.existsSync(backup))fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
 }
 let written=0;
 if(!fs.existsSync(target)){
  fs.writeFileSync(target+'.huoyitong-tmp',splashXml);
  fs.renameSync(target+'.huoyitong-tmp',target);written=1;
 }
 for(const {file} of remove)fs.unlinkSync(file);
 return {removed:remove.length,written};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),checkOnly=args.includes('--check'),positional=args.filter(a=>a!=='--check');
  if(positional.length>1||positional.some(a=>a.startsWith('--')))throw Error('Usage: node scripts/configure-android-splash.mjs [android-directory] [--check]');
  const result=configureSplash(path.resolve(positional[0]||path.join(root,'android')),{checkOnly});
  console.log(checkOnly?'Verified scalable 貨易通 splash resource.':`Configured 貨易通 splash (${result.written} XML written; ${result.removed} template images removed).`);
  if(!checkOnly)console.log('Original images backed up in android/.huoyitong-splash-backup/. Next: run release lint and build in Android Studio.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
