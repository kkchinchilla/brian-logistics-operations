// Package the same app under a separate path. Only public client configuration
// differs; all roles and writes remain enforced by the selected backend.
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT} from './create-review-accounts.mjs';

export function buildReviewer(out,pages){
 const review=path.join(out,'reviewer');
 fs.mkdirSync(review);
 for(const dir of ['css','js','assets'])fs.cpSync(path.join(out,dir),path.join(review,dir),{recursive:true});
 const banner='<aside class="reviewer-notice" aria-label="目前使用展示環境"><strong>展示環境 · 虛構資料</strong><span>範例日期：2026/10/27–29 · 報表月份：2026/10</span></aside>';
 for(const page of pages){
  let html=fs.readFileSync(path.join(out,page),'utf8');
  html=html.replace('</head>','<link rel="stylesheet" href="css/reviewer-environment.css?v=1461"></head>');
  if(page==='index.html'){
   html=html.replace('<p>登入以使用每日出勤及管理系統</p>',banner);
   html=html.replace('href="reviewer/index.html"','href="../index.html"').replace('展示環境登入','返回公司登入');
   html=html.replace('台灣手機可直接輸入 09 開頭號碼。','請輸入提供給你的展示帳號（包含 + 國碼）及密碼。').replace('placeholder="09xxxxxxxx"','placeholder="+國碼及手機號碼"');
  }else if(/^ui-(attendance|routes|vehicles|monthly|accounts)\.html$/.test(page)){
   html=html.replace('<main class="main">','<main class="main">'+banner);
  }
  fs.writeFileSync(path.join(review,page),html);
 }
 fs.writeFileSync(path.join(review,'js/config.js'),`// Public demonstration configuration. No passwords or administrative keys.\nconst SUPABASE_URL = ${JSON.stringify('https://'+PROJECT+'.supabase.co')};\nconst SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_VFhyCnpVRaLk2_pryTAIlQ_74gwx22F';\nconst { createClient } = supabase;\nconst db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {auth:{storageKey:${JSON.stringify('sb-'+PROJECT+'-auth-token')},detectSessionInUrl:false}});\n`);
}
