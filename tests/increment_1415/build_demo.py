"""Build four offline, fictional previews from the actual application source."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
out=root/'examples'/'offline-1.4.15'
out.mkdir(parents=True,exist_ok=True)
fixtures=['mock_supabase_143.js','mock_increment_146.js','mock_increment_147.js','mock_increment_148.js','mock_increment_1491.js','mock_increment_1410.js','mock_increment_1411.js','mock_increment_14111.js','mock_increment_1415.js']
fixture='\n'.join((root/'tests'/f).read_text() for f in fixtures)
def inline_script(match):
 src=match[1].split('?')[0]
 if src.startswith('https://'):return '<script>'+fixture+'</script>' if 'supabase' in src else ''
 if src=='js/config.js':return '<script>const db=window._testDB143;window.db=db;</script>'
 code=(root/src).read_text()
 if src=='js/production-common.js':code=code.replace("const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});","const today=()=> '2026-10-20';")
 return '<script>'+code.replace('</script','<\\/script')+'</script>'
for page in ['ui-attendance.html','ui-routes.html','ui-vehicles.html','ui-monthly.html']:
 html=(root/page).read_text()
 html=html.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'">')
 html=re.sub(r'<link rel="stylesheet" href="([^\"]+)"[^>]*>',lambda m:'<style>'+(root/m[1].split('?')[0]).read_text()+'</style>',html)
 html=re.sub(r'<script src="([^\"]+)"[^>]*></script>',inline_script,html)
 html=html.replace('</head>','<style>.demo-banner{position:relative;z-index:100;background:#f7da4c;color:#17191c;padding:10px 16px;font:12px/1.6 sans-serif}.demo-banner a{color:#17191c;font-weight:bold}</style></head>')
 html=re.sub(r'(<body[^>]*>)',r'\1<div class="demo-banner">隔離展示 · 虛構資料及金額 · 值班、跟車與學習可試填，營運儲存請至開發系統驗收　<a href="index.html">說明／切換角色</a></div>',html,count=1)
 html=html.replace('href="dispatcher.html"','href="index.html"')
 (out/page).write_text(html)
(out/'index.html').write_text("""<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1.4.15 隔離展示</title><style>body{background:#202328;color:#eee;font:16px/1.8 sans-serif;max-width:760px;padding:40px;margin:auto}a{color:#ffdb41}li{margin:12px 0}</style><h1>Increment 1.4.15 隔離展示</h1><p>所有姓名、金額與勤務均為虛構。四頁共用同一份初始資料，完全不連接 Supabase。重新整理或切換頁面會還原。</p><p>應計薪資＝配送計酬－租車費用＋加給／獎懲。值班、跟車與學習只統計出勤。司機名單保留上方編輯司機按鈕。</p><p>10/15 有 7 筆已結案配送及值班、跟車、學習紀錄；10/20 有 7 筆未結案配送，其中司機 A 在同類有 5 趟。另有租車、加給及懲處。租車費用設定可在目前頁面的記憶體試填；營運資料修改請至開發系統驗收。</p><ul><li><a href="ui-attendance.html">每日出勤</a></li><li><a href="ui-routes.html">路線管理</a></li><li><a href="ui-vehicles.html">車輛管理</a></li><li><a href="ui-monthly.html">月度報表：Brian</a></li><li><a href="ui-monthly.html?actor=karen">月度權限拒絕示範：其他調度員</a></li><li><a href="ui-attendance.html?actor=driver">司機檢視</a></li></ul><p>月報表格不隨溫層增加欄位。本離線展示模擬伺服器回傳，正式系統由 Supabase 計算。展示不是正式薪資資料或營運驗收證據。</p></html>""")
print('Built four network-disabled previews:',out)
