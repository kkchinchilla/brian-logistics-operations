from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re
import threading
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'tests'/'_ui_qa_143';OUT.mkdir(exist_ok=True)
D='11111111-1111-4111-8111-111111111111';E='22222222-2222-4222-8222-222222222222';F='33333333-3333-4333-8333-333333333333'
SERVER=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(ROOT)))
threading.Thread(target=SERVER.serve_forever,daemon=True).start()
BASE=f'http://127.0.0.1:{SERVER.server_port}'
results=[]
def check(label,fn):
 try:fn();results.append({'test':label,'status':'PASS'});print('PASS',label,flush=True)
 except Exception as e:results.append({'test':label,'status':'FAIL','error':str(e)});print('FAIL',label,str(e)[:700],flush=True);raise

def setup(browser,width=1366,role='dispatcher',missing=False):
 c=browser.new_context(viewport={'width':width,'height':900 if width>767 else 844},device_scale_factor=1)
 p=c.new_page();p.set_default_timeout(7000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.add_init_script((ROOT/'tests/mock_supabase_143.js').read_text()+f"\nmock143.role='{role}';"+("mock143.fail='attendance_driver_days';" if missing else ''))
 p.route('**/cdn.jsdelivr.net/**',lambda r:r.fulfill(status=200,body='// isolated SDK mock',content_type='application/javascript'))
 p.route('**/js/config.js',lambda r:r.fulfill(status=200,body='const db=window._testDB143;',content_type='application/javascript'))
 html=(ROOT/'ui-attendance.html').read_text()
 html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m[1].split('?')[0]).read_text()+'</style>',html)
 def script(m):
  path=m[1].split('?')[0]
  if path.startswith('https:'):return '<script>'+(ROOT/'tests/mock_supabase_143.js').read_text()+f"\nmock143.role='{role}';"+("mock143.fail='attendance_driver_days';" if missing else '')+'</script>'
  return '<script>'+('const db=window._testDB143;' if path=='js/config.js' else (ROOT/path).read_text())+'</script>'
 html=re.sub(r'<script src="([^"]+)"></script>',script,html)
 p.set_content(html,wait_until='load');p.wait_for_selector('#attendance-table table')
 p.evaluate("async()=>{boardDate='2026-10-15';document.querySelector('#service-date').value=boardDate;await fetchBoard();}")
 return c,p,errors

def saved_template(p):
 p.click('#template-open');p.wait_for_selector('#plan-content [data-plan-action=import]');p.click('[data-plan-action=import]')
 p.click('[data-plan-action=save]');p.wait_for_function('plan143.saved?.revision===1')

with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 c,p,errors=setup(b)
 check('143-UI01 board loads with editable leave and template entry',lambda: (p.locator('[data-leave]').count()==3) or (_ for _ in []).throw(AssertionError('leave count')))
 p.click(f'[data-leave="{D}"]')
 check('143-UI02 leave option disabled for occupied row',lambda: p.locator('input[value=off]').is_disabled() or (_ for _ in []).throw(AssertionError()))
 p.click('#modal-cancel');p.click(f'[data-leave="{E}"]');p.check('input[value=off]');p.click('#modal-save');p.wait_for_function(f'onLeave143("{E}")')
 check('143-UI03 saving leave disables the driver run cells',lambda: p.locator(f'[data-add][data-driver="{E}"]').count()==0 or (_ for _ in []).throw(AssertionError()))
 p.click(f'[data-leave="{E}"]');p.check('input[value=none]');p.click('#modal-save');p.wait_for_function(f'!onLeave143("{E}")')
 check('143-UI04 clearing leave restores empty-cell scheduling',lambda: p.locator(f'[data-add][data-driver="{E}"]').count()>0 or (_ for _ in []).throw(AssertionError()))
 saved_template(p)
 check('143-UI05 imported template has no date-less rental flag',lambda: p.evaluate("mock143.calls.find(x=>x.fn==='dashboard_save_day_template').args.p_rows.every(x=>!Object.hasOwn(x,'is_rental'))") or (_ for _ in []).throw(AssertionError()))
 p.click('[data-plan-tab=apply]');p.wait_for_selector('[data-plan-date="2026-10-20"]');p.click('[data-plan-date="2026-10-20"]');p.click('[data-plan-action=next-month]');p.wait_for_function("plan143.month==='2026-11'&&!plan143.busy");p.click('[data-plan-date="2026-11-03"]');p.click('[data-plan-action=apply]');p.wait_for_function('!plan143.open')
 check('143-UI06 cross-month application sends only explicitly selected dates',lambda: p.evaluate("JSON.stringify(mock143.calls.find(x=>x.fn==='dashboard_apply_day_template').args.p_dates)===JSON.stringify(['2026-10-20','2026-11-03'])") or (_ for _ in []).throw(AssertionError()))
 check('143-UI07 successful application returns to scheduled attendance date',lambda: p.evaluate("boardDate==='2026-10-20'&&runs.length===2") or (_ for _ in []).throw(AssertionError()))
 p.locator('[data-run]').first.click();p.select_option('#cell-route','3');p.click('#modal-save');p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
 check('143-UI08 board cell edits use day/run revisions and do not change saved template',lambda: p.evaluate("mock143.tables.driver_day_templates[0].rows[0].route_id===1&&mock143.calls.some(c=>c.fn==='dashboard_edit_run_direct'&&c.args.p_expected_run_revision>0)") or (_ for _ in []).throw(AssertionError()))
 # In the unified cell editor, no planned/actual tab is presented.
 p.locator('[data-run]').first.click()
 check('143-UI09 occupied run has one route/vehicle/note form without mode tabs',lambda: (
  p.locator('#cell-route').count()==1 and p.locator('#cell-vehicle').count()==1 and
  p.locator('#cell-note').count()==1 and p.locator('#mode-actual,#mode-planned').count()==0
 ) or (_ for _ in []).throw(AssertionError()))
 p.click('#modal-cancel')
 # Driver edits use one revision-checked canonical run without a second mode.
 p.evaluate(f"currentProfile.role='driver';currentUser.id='{D}';paintBoard()")
 p.locator('[data-run]').first.click();p.select_option('#cell-vehicle','2');p.click('#modal-save');p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
 check('143-UI09b driver edit directly replaces route/vehicle on run',lambda: p.evaluate("mock143.calls.some(c=>c.fn==='dashboard_edit_run_direct'&&c.args.p_vehicle_id===2)") or (_ for _ in []).throw(AssertionError()))
 p.evaluate("currentProfile.role='dispatcher';currentUser.id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';paintBoard()")
 p.locator('[data-run]').first.click();p.evaluate("mock143.fail='dashboard_edit_run_direct'");p.click('#modal-save');p.wait_for_function("document.querySelector('#modal-error').textContent.length>0")
 check('143-UI10 stale/error response keeps unified editor open and shows error',lambda: p.locator('#modal.open').count()==1 or (_ for _ in []).throw(AssertionError()))
 p.click('#modal-cancel');p.click('#template-open');p.wait_for_function('!plan143.busy');p.click('[data-plan-tab=apply]');p.wait_for_function('!plan143.busy');p.click('[data-plan-date="2026-10-20"]');p.click('[data-plan-action=apply]');p.wait_for_function("document.querySelector('#plan-error').textContent.includes('保留單日調整')")
 check('143-UI11 preserving day exceptions shown without claiming scheduling success',lambda: p.locator('#plan-error').inner_text().find('未建立新排班')>=0 or (_ for _ in []).throw(AssertionError()))
 p.click('#plan-x');p.click('#adjust-slots');p.click('[data-slot-group="冷凍"] [data-slot-step="1"]');p.click('#modal-save');p.wait_for_function("slotCounts['冷凍']===5")
 check('143-UI12 daily dynamic columns preserved',lambda: p.locator('thead').inner_text().find('冷凍5')>=0 or (_ for _ in []).throw(AssertionError()))
 check('143-UI13 browser has no uncaught JS exceptions',lambda: not errors or (_ for _ in []).throw(AssertionError(errors)))
 c.close()
 c,p,errors=setup(b,390,'driver')
 check('143-UI14 driver cannot access template/leave editing controls',lambda: p.locator('#template-open').is_hidden() and p.locator('[data-leave]').count()==0 or (_ for _ in []).throw(AssertionError()))
 check('143-UI15 driver retains own actual edits; other rows are readonly',lambda: p.locator('[data-run]').count()>0 and p.locator(f'[data-add][data-driver="{E}"]').count()==0 or (_ for _ in []).throw(AssertionError()))
 c.close();c,p,errors=setup(b,390,missing=True)
 check('143-UI16 missing migration disables new writes with an installation notice',lambda: p.locator('#template-open').is_disabled() and p.locator('#attendance-note').inner_text().find('143 SQL')>=0 or (_ for _ in []).throw(AssertionError()))
 c.close()
 for width in [320,375,390,768,1024,1366,1920]:
  c,p,errors=setup(b,width);saved_template(p)
  geom=p.evaluate("""()=>({page:document.documentElement.scrollWidth<=innerWidth+1,panel:document.querySelector('#plan-panel').scrollWidth<=document.querySelector('#plan-panel').clientWidth+1,rows:[...document.querySelectorAll('.plan-route-row')].every(row=>{const r=row.getBoundingClientRect();return [...row.querySelectorAll('select,button')].every(el=>{const b=el.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;})})})""")
  check(f'143-RESP-{width} template card and page have no horizontal overflow',lambda g=geom:all(g.values()) or (_ for _ in []).throw(AssertionError(g)))
  p.screenshot(path=str(OUT/f'template-{width}.png'),full_page=True)
  p.click('[data-plan-tab=apply]');p.wait_for_function('!plan143.busy')
  check(f'143-CAL-{width} calendar fits viewport and no JS errors',lambda: p.evaluate("document.querySelector('.plan-calendar').scrollWidth<=document.querySelector('.plan-calendar').clientWidth+1") and not errors or (_ for _ in []).throw(AssertionError(errors)))
  if width in [390,1366]:p.screenshot(path=str(OUT/f'calendar-{width}.png'),full_page=True)
  c.close()
 b.close()
(OUT/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(f'ALL {len(results)} passed')
