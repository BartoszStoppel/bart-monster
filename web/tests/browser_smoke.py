import json,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
root=Path(__file__).resolve().parents[2]
config=json.loads((root/'backups/rust-migration-20260929/local-test.json').read_text())
base='http://127.0.0.1:8080';errors=[];failed=[]
with sync_playwright() as p:
 browser=p.chromium.launch(args=['--no-sandbox']);context=browser.new_context(viewport={'width':1280,'height':1000},color_scheme='dark')
 context.add_cookies([{'name':'bart_session','value':config['session'],'url':base,'httpOnly':True}]);page=context.new_page();page.set_default_timeout(20000)
 page.on('pageerror',lambda error:errors.append(str(error)))
 response=context.request.get(base+'/api/bootstrap');assert response.ok,response.status
 data=response.json();games=data['tables']['board_games'];gid=games[0]['bgg_id'];uid=config['user_id']
 print('Bootstrap tables:',', '.join(data['tables']),flush=True)
 for viewport in [(1280,1000),(390,844)]:
  page.set_viewport_size({'width':viewport[0],'height':viewport[1]})
  for path in ['/','/tier-list','/tier-list?metric=difficulty','/community','/community?metric=difficulty','/statistics','/statistics?metric=difficulty','/picker','/wishlist','/achievements','/furtch','/feedback','/admin','/admin/rules','/search','/chat',f'/users/{uid}',f'/games/{gid}']:
   page.goto(base+path);page.wait_for_timeout(1200)
   text=page.locator('body').inner_text()
   if 'Try again' in text or 'Page Not Found' in text:failed.append((viewport,path,text[:240]))
   if page.locator('main').count()==0:failed.append((viewport,path,'No application main element'))
   overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth+1')
   if overflow:failed.append((viewport,path,'horizontal overflow'))
   print(viewport[0],path,'FAIL' if failed and failed[-1][1]==path else 'ok',flush=True)
  page.goto(base+'/');page.wait_for_timeout(1500);page.screenshot(path=f'/tmp/bart-rust-brown-{viewport[0]}.png',full_page=False)
 print('ERRORS',json.dumps(errors));print('FAILURES',json.dumps(failed));browser.close()
 assert not errors and not failed
