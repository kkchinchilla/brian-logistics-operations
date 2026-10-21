"""Isolated Chromium UI acceptance for driver-vehicle auto-selection & multi-driver binding."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json
ROOT=Path(__file__).resolve().parents[1]
RESULT=[]
D='11111111-1111-4111-8111-111111111111'
E='22222222-2222-4222-8222-222222222222'
F='33333333-3333-4333-8333-333333333333'

def check(label,ok):
    if not ok:raise AssertionError(label)
    RESULT.append(label);print('PASS',label,flush=True)

def open_mock(browser,page_file,width):
    ctx=browser.new_context(viewport={'width':width,'height':850})
    p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
    p.add_init_script((ROOT/'tests/mock_supabase_143.js').read_text())
    html=(ROOT/page_file).read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m[1].split('?')[0]).read_text()+'</style>',html)
    def script(m):
        name=m.group(1).split('?')[0]
        if name.startswith('https:'):return '<script>'+(ROOT/'tests/mock_supabase_143.js').read_text()+'</script>'
        if name=='js/config.js':return '<script>const db=window._testDB143;</script>'
        return '<script>'+ (ROOT/name).read_text()+'</script>'
    html=re.sub(r'<script src="([^"]+)"></script>',script,html)
    p.set_content(html,wait_until='load');return ctx,p,errors

with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [320,390,768,1366]:
  c,p,errs=open_mock(b,'ui-attendance.html',width)
  p.wait_for_selector('#attendance-table table');p.evaluate("async()=>{boardDate='2026-10-15';document.querySelector('#service-date').value=boardDate;await fetchBoard();}")
  check(f'144-{width} shared vehicle 1 belongs to both D/E',p.evaluate(f"FleetBinding144.rental(ownerBindings,'{D}',1,'2026-10-15')===false&&FleetBinding144.rental(ownerBindings,'{E}',1,'2026-10-15')===false"))
  check(f'144-{width} latest binding 2 preselected for D',p.evaluate(f"FleetBinding144.preferred(ownerBindings,'{D}','2026-10-15',vehicles)===2"))
  check(f'144-{width} earlier effective date chooses vehicle 1',p.evaluate(f"FleetBinding144.preferred(ownerBindings,'{D}','2026-10-01',vehicles)===1"))
  p.click('#new-run');p.select_option('#plan-driver',D)
  check(f'144-{width} new-run auto selects latest bound vehicle 2',p.locator('#plan-vehicle').input_value()=='2')
  p.select_option('#plan-driver',E)
  check(f'144-{width} another driver preselects same shared vehicle 1',p.locator('#plan-vehicle').input_value()=='1')
  check(f'144-{width} shared vehicle shown as non-rental', '非租車' in p.locator('#plan-rental-hint').inner_text())
  p.select_option('#plan-vehicle','2')
  check(f'144-{width} manual override vehicle 2 shown as rental','租車' in p.locator('#plan-rental-hint').inner_text())
  check(f'144-{width} rental dropdown removed in new run',p.locator('#plan-rental').count()==0)
  p.click('#modal-cancel')
  p.click(f'[data-add][data-driver="{E}"]',timeout=9000);p.wait_for_selector('#cell-vehicle')
  check(f'144-{width} empty attendance cell preselects bound vehicle 1',p.locator('#cell-vehicle').input_value()=='1')
  check(f'144-{width} rental dropdown removed in cell',p.locator('#cell-rental').count()==0)
  p.click('#modal-cancel')
  p.click('#template-open');p.wait_for_selector('[data-plan-action=add]');p.click('[data-plan-action=add]')
  check(f'144-{width} template new row preselects latest vehicle',p.locator('[data-template-field=vehicle_id]').first.input_value()=='2')
  check(f'144-{width} template stores only routes/vehicles','is_rental' not in p.evaluate('JSON.stringify(plan143.draft)'))
  check(f'144-{width} no horizontal overflow',p.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
  check(f'144-{width} no browser exceptions',not errs)
  c.close()
 c,p,errs=open_mock(b,'ui-vehicles.html',1366)
 p.wait_for_selector('#fleet-table table')
 check('144 vehicle dashboard displays multiple bound drivers on same vehicle',p.evaluate("(()=>{const row=[...document.querySelectorAll('#fleet-table tr')].find(x=>x.textContent.includes('1001'));return !!row&&row.textContent.includes('測試司機 A')&&row.textContent.includes('測試司機 B')})()"))
 p.click('#new-binding')
 p.select_option('#bvehicle','1');p.select_option('#bdriver',F)
 check('144 binding form allows other driver on same vehicle',p.locator('#modal').is_visible() and '可同時綁定多位' in p.locator('#modal-fields').inner_text())
 check('144 vehicle dashboard no browser exceptions',not errs)
 c.close();b.close()
Path('/mnt/data/inc144_browser-results.json').write_text(json.dumps(RESULT,ensure_ascii=False,indent=2))
print('ALL',len(RESULT),'passed')
