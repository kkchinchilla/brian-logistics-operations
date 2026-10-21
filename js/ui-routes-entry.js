/* Explicit mode split. ?demo=1 is entirely local, otherwise authenticated Supabase data. */
(()=>{'use strict';
 const demo=new URLSearchParams(location.search).get('demo')==='1';
 const next=urls=>new Promise((resolve,reject)=>{const add=(i)=>{
  if(i>=urls.length)return resolve();const s=document.createElement('script');s.src=urls[i];s.onload=()=>add(i+1);s.onerror=()=>reject(Error(`無法載入 ${urls[i]}`));document.body.appendChild(s);
 };add(0)});
 if(demo){document.querySelector('.inc-demo').textContent='展示模式 · 所有資料均為虛構範例，操作不會寫入 Supabase。';
  const l=document.querySelector('#demo-route-link');if(l){l.href='ui-routes.html';l.textContent='切換正式資料 ↗'}
  next(['js/route-demo-data.js','js/ui-routes.js']).then(()=>{if(window.matchMedia('(max-width: 900px)').matches)document.querySelector('#device-mobile')?.click()}).catch(e=>document.querySelector('.inc-demo').textContent=e.message);return;
 }
 next(['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','js/config.js','js/ui-routes-live.js']).catch(e=>document.querySelector('.inc-demo').textContent='正式模式載入失敗：'+e.message);
})();
