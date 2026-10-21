"""Increment 1.4.4.1: isolated Chromium checks for one cell-edit form (no tabs)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re

ROOT=Path(__file__).resolve().parents[1]
D='11111111-1111-4111-8111-111111111111'
E='22222222-2222-4222-8222-222222222222'
M='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
results=[]
SCREEN_DIR=ROOT/'tests'/'_ui_qa_1441';SCREEN_DIR.mkdir(exist_ok=True)

def check(text,ok):
    if not ok:raise AssertionError(text)
    results.append(text);print('PASS',text,flush=True)

def setup(b,width,role='dispatcher'):
    ctx=b.new_context(viewport={'width':width,'height':844 if width<=767 else 900})
    p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
    p.add_init_script((ROOT/'tests/mock_supabase_143.js').read_text()+f'\nmock143.role="{role}";')
    html=(ROOT/'ui-attendance.html').read_text()
    html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/m[1].split('?')[0]).read_text()+'</style>',html)
    def inline(m):
        name=m.group(1).split('?')[0]
        if name.startswith('https:'):return '<script>'+ (ROOT/'tests/mock_supabase_143.js').read_text()+f'\nmock143.role="{role}";</script>'
        if name=='js/config.js':return '<script>const db=window._testDB143;</script>'
        return '<script>'+(ROOT/name).read_text()+'</script>'
    html=re.sub(r'<script src="([^"]+)"></script>',inline,html)
    p.set_content(html,wait_until='load');p.wait_for_selector('#attendance-table table')
    p.evaluate("async()=>{boardDate='2026-10-15';document.querySelector('#service-date').value=boardDate;await fetchBoard();}")
    return ctx,p,errors

def assert_one_form(p,width):
    check(f'{width} single route/vehicle/notes editor',all(p.locator('#'+id).count()==1 for id in ('cell-route','cell-vehicle','cell-note')))
    check(f'{width} no planned/actual toggle',p.locator('#mode-planned,#mode-actual,.attendance-edit-modes').count()==0)
    check(f'{width} modal does not label separate write modes',not any(s in p.locator('#modal-fields').inner_text() for s in ('當日預排','實際出勤')))
    check(f'{width} editable bound vehicle hint','非租車' in p.locator('#cell-rental-hint').inner_text())
    geometry=p.evaluate("""()=>{
      const modal=document.querySelector('#modal .dialog').getBoundingClientRect();
      const inputs=[...document.querySelectorAll('#modal-fields select,#modal-fields input,#modal .actions button')];
      return {page:document.documentElement.scrollWidth<=innerWidth+1,
       fieldFit:inputs.every(el=>{let r=el.getBoundingClientRect();return r.left>=modal.left-2&&r.right<=modal.right+2}),
       footerFit:document.querySelector('#modal .actions').getBoundingClientRect().right<=modal.right+2};
    }""")
    check(f'{width} dialog fields and actions fit viewport',all(geometry.values()))

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    for width in (320,375,390,768,1366,1920):
        ctx,p,errs=setup(b,width)
        p.locator('[data-run]').first.click()
        assert_one_form(p,width)
        if width in (390,1366):p.screenshot(path=str(SCREEN_DIR/f'occupied-unified-{width}.png'),full_page=True)
        p.select_option('#cell-route','3')
        p.fill('#cell-note','單日路線修改')
        p.click('#modal-save')
        p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
        check(f'{width} dispatcher occupied cell updates existing run',p.evaluate("mock143.calls.some(c=>c.fn==='dashboard_edit_run_direct'&&c.args.p_route_id===3&&c.args.p_note==='單日路線修改')"))
        check(f'{width} edit remains visible after saving',p.locator('[data-run]').first.inner_text().find('03')>=0)
        p.locator('[data-run]').first.click()
        check(f'{width} same form when reopening occupied cell',p.locator('#cell-route').input_value()=='3' and p.locator('#mode-actual,#mode-planned').count()==0)
        p.click('#modal-cancel')
        p.click(f'[data-add][data-driver="{E}"]')
        assert_one_form(p,width)
        check(f'{width} empty cell preselects driver binding',p.locator('#cell-vehicle').input_value()=='1')
        if width==390:p.screenshot(path=str(SCREEN_DIR/'empty-unified-390.png'),full_page=True)
        p.select_option('#cell-route','2')
        p.click('#modal-save')
        p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
        check(f'{width} empty dispatcher cell writes one scheduled run',p.evaluate(f"mock143.calls.some(c=>c.fn==='dashboard_save_day_plan'&&c.args.p_driver_id==='{E}'&&c.args.p_route_id===2)"))
        check(f'{width} no JS errors',not errs)
        ctx.close()
    ctx,p,errs=setup(b,390,'driver')
    p.locator('[data-run]').first.click()
    assert_one_form(p,'driver')
    check('driver cannot cancel assigned run',p.locator('#cell-cancel-run').count()==0)
    check('driver can edit own run without a supervisor approval field',p.locator('#modal-save').inner_text()=='儲存' and p.locator('#modal-fields').get_by_text('無須主管核准').count()==1)
    p.select_option('#cell-vehicle','2')
    p.fill('#cell-note','車輛更改')
    p.click('#modal-save');p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
    check('driver overwrites canonical run directly',p.evaluate("mock143.calls.some(c=>c.fn==='dashboard_edit_run_direct'&&c.args.p_vehicle_id===2&&c.args.p_note==='車輛更改')"))
    check('driver revised run visible in the table',p.locator('[data-run]').nth(1).inner_text()=='1002')
    check('other driver rows remain read-only',p.locator(f'[data-add][data-driver="{E}"]').count()==0)
    check('driver cannot open another driver run editor',p.locator(f'[data-run]').count()>0 and p.locator(f'tr:not(.mine) [data-run]').count()==0)
    check('driver path has no uncaught JS errors',not errs)
    check('no new observation is created by a direct edit',p.evaluate('mock143.tables.daily_run_observations.length===0'))
    ctx.close()
    ctx,p,errs=setup(b,390,'dispatcher')
    p.evaluate(f"mock143.tables.daily_run_observations.push({{id:88,run_id:1,driver_id:'{D}',actual_route_id:3,actual_vehicle_id:2,actual_note:'已更動',revision:3}})")
    p.evaluate('fetchBoard()')
    p.locator('[data-run]').first.click()
    check('record with existing observation opens same unified form',p.locator('#cell-route').input_value()=='3' and p.locator('#cell-vehicle').input_value()=='2' and p.locator('#mode-actual,#mode-planned').count()==0)
    p.select_option('#cell-vehicle','1')
    p.click('#modal-save');p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
    check('old observation consolidated into canonical run',p.evaluate("mock143.calls.some(c=>c.fn==='dashboard_edit_run_direct'&&c.args.p_run_id===1&&c.args.p_vehicle_id===1&&c.args.p_expected_observation_revision===3)"))
    check('existing route stays visible and the observation is removed',p.locator('[data-run]').first.inner_text()=='03' and p.evaluate('mock143.tables.daily_run_observations.length===0'))
    check('same form for observed run no JS errors',not errs)
    ctx.close()
    ctx,p,errs=setup(b,390,'dispatcher')
    p.evaluate(f"mock143.tables.daily_attendance_extra_trips.push({{id:50,service_date:'2026-10-15',driver_id:'{E}',attendance_category:'OC',attendance_slot_index:1,actual_route_id:1,actual_vehicle_id:1,actual_note:'臨時',is_rental:false,status:'active',revision:2}})")
    p.evaluate('fetchBoard()')
    p.click('[data-extra]');assert_one_form(p,'extra')
    check('extra trip retains void affordance',p.locator('#cell-void-trip').count()==1)
    check('extra trip does not present second mode tab',p.locator('#mode-actual,#mode-planned').count()==0)
    ctx.close()
    ctx,p,errs=setup(b,390,'dispatcher')
    p.locator('[data-run]').first.click()
    p.click('#cell-cancel-run')
    check('unified editor supports guarded run cancellation',p.locator('#cell-route').is_disabled() and p.locator('#cell-vehicle').is_disabled() and p.locator('#modal-save').inner_text()=='確認取消趟次')
    p.click('#modal-save');p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
    check('cancellation updates existing run directly',p.evaluate("mock143.calls.some(c=>c.fn==='dashboard_edit_run_direct'&&c.args.p_cancel===true)"))
    ctx.close()
    ctx,p,errs=setup(b,390,'dispatcher')
    p.evaluate("mock143.tables.daily_attendance_closeouts.push({service_date:'2026-10-15',closed_at:'2026-10-15T18:00:00Z',supervisor_note:''})")
    p.evaluate('fetchBoard()')
    check('closed date disables editing through attendance cells',p.locator('#attendance-table [data-run]').count()==0 and p.locator('#attendance-table [data-add]').count()==0)
    ctx.close()
    ctx,p,errs=setup(b,390,'dispatcher')
    p.evaluate(f"mock143.tables.daily_attendance_extra_trips.push({{id:50,service_date:'2026-10-15',driver_id:'{E}',attendance_category:'OC',attendance_slot_index:1,actual_route_id:1,actual_vehicle_id:1,actual_note:'臨時',is_rental:false,status:'active',revision:2}})")
    p.evaluate('fetchBoard()')
    p.click('[data-extra]')
    p.click('#cell-void-trip')
    p.fill('#cell-note','取消原因')
    p.click('#modal-save');p.wait_for_function("!document.querySelector('#modal').classList.contains('open')")
    check('voiding extra trip uses existing guarded RPC with reason',p.evaluate("mock143.calls.some(c=>c.fn==='dashboard_save_extra_actual_trip'&&c.args.p_void===true&&c.args.p_note==='取消原因'&&c.args.p_expected_revision===2)"))
    check('no browser JS errors in guarded flows',not errs)
    ctx.close();b.close()
(SCREEN_DIR/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('ALL',len(results),'passed')
