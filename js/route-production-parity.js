/* Production route layout: real viewport, no prototype device buttons. */
(()=>{
 const stage=document.getElementById('stage');
 const setViewport=()=>{const narrow=window.matchMedia('(max-width:800px)').matches;stage.classList.toggle('mobile',narrow);stage.classList.toggle('desktop',!narrow)};
 const init=()=>{setViewport();window.addEventListener('resize',setViewport,{passive:true});const btn=document.getElementById('route-logout');if(btn)btn.addEventListener('click',async()=>{try{if(typeof db!=='undefined')await db.auth.signOut()}finally{window.location.assign('index.html')}})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
