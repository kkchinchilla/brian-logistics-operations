// The fixed mobile bar can grow with text; page/footer clearance must follow it.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const code=fs.readFileSync('js/dashboard-layout.js','utf8');
for(const dashboard of ['attendance','routes','vehicles','monthly','accounts']){
 const html=fs.readFileSync(`ui-${dashboard}.html`,'utf8');
 const dom=new JSDOM(html,{runScripts:'outside-only'});
 const {window:w}=dom,body=w.document.body;
 assert(w.document.querySelector('script[src="js/dashboard-layout.js?v=1457"]'));
 const bar=w.document.querySelector('.mobilebar,.mobile-navbar');
 let height=58,notify;
 bar.getBoundingClientRect=()=>({height});
 w.ResizeObserver=class{constructor(fn){notify=fn}observe(el){assert.equal(el,bar)}};
 w.eval(code);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 assert.equal(body.style.getPropertyValue('--dashboard-nav-height'),'58px');
 height=93.5;notify();
 assert.equal(body.style.getPropertyValue('--dashboard-nav-height'),'94px');
 assert.equal(body.style.getPropertyValue('--dashboard-footer-safe-area'),'0px');
 // A role change/offline screen hides the bar; restore only safe-area clearance.
 height=0;notify();
 assert.equal(body.style.getPropertyValue('--dashboard-nav-height'),'0px');
 assert.equal(body.style.getPropertyValue('--dashboard-footer-safe-area'),'env(safe-area-inset-bottom,0px)');
 height=72;w.dispatchEvent(new w.Event('pageshow'));
 assert.equal(body.style.getPropertyValue('--dashboard-nav-height'),'72px');
 dom.window.close();
}
console.log('PASS: all five dashboard footers follow wrapped, hidden and restored navigation heights');
