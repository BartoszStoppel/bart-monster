import asyncio,json,re
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parents[2];cfg=json.loads((ROOT/'backups/rust-migration-20260929/local-test.json').read_text());BASE='http://127.0.0.1:8080'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--no-sandbox']);ctx=await browser.new_context(viewport={'width':1280,'height':1100},color_scheme='dark');await ctx.add_cookies([{'name':'bart_session','value':cfg['session'],'url':BASE,'httpOnly':True}]);page=await ctx.new_page();page.set_default_timeout(20000)
  headers={'X-CSRF-Token':cfg['csrf_token'],'Origin':BASE};saved={};errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  data=await (await ctx.request.get(BASE+'/api/bootstrap')).json();games=[g for g in data['tables']['board_games'] if g['category']=='board'];gid=games[0]['bgg_id'];name=games[0]['name'];other=games[1]
  for metric in ('enjoyment','difficulty'):saved[metric]=await (await ctx.request.get(BASE+f'/api/rankings/{metric}/board')).json()
  async def restore():
   for metric,state in saved.items():
    current=await (await ctx.request.get(BASE+f'/api/rankings/{metric}/board')).json();r=await ctx.request.post(BASE+f'/api/rankings/{metric}/board',headers=headers,data={'revision':current['revision'],'entries':[{'id':p['id'],'tier':p['tier']} for p in state['placements']]});assert r.ok,await r.text()
  try:
   # Every completed move remains queued across a temporary failure, including browser Back.
   attempts=[]
   async def retry_route(route):
    req=route.request
    if req.method!='POST':return await route.continue_()
    assert req.headers.get('x-csrf-token')==cfg['csrf_token']
    attempts.append(req.post_data_json)
    if len(attempts)==1:return await route.fulfill(status=503,json={'error':'temporary test outage'})
    await route.continue_()
   await page.route('**/api/rankings/enjoyment/board',retry_route)
   await page.goto(BASE+'/tier-list');await expect(page.get_by_role('heading',name='Tier List',exact=True)).to_be_visible()
   assert await page.get_by_role('button',name='Save',exact=True).count()==0
   for tier in ['A','B','C']:
    await page.get_by_title(name,exact=True).press('Enter');await page.get_by_role('button',name=f'Move selected game to {tier}',exact=True).press('Enter')
    if tier=='A':
     await expect(page.get_by_text('Connection interrupted.',exact=False)).to_be_visible();await page.evaluate("history.pushState({},'', '/');history.pushState({},'', '/tier-list');history.back()");await page.wait_for_timeout(100);assert page.url.endswith('/tier-list')
   await expect(page.get_by_role('status',name='Ranking save status')).to_have_text('All changes saved',timeout=20000)
   state=await (await ctx.request.get(BASE+'/api/rankings/enjoyment/board')).json();assert next(p for p in state['placements'] if int(p['id'])==gid)['tier']=='C'
   moves=[next(e['tier'] for e in a['entries'] if int(e['id'])==gid) for a in attempts];assert moves==['A','A','B','C'],moves
   print('Keyboard autosave retries and serializes every move; browser Back preserves queue: PASS',flush=True)
   await page.unroute('**/api/rankings/enjoyment/board',retry_route)
   await page.goto(BASE+'/tier-list?metric=difficulty');await expect(page.get_by_role('button',name='Move selected game to Cuddly',exact=True)).to_be_visible()
   await page.get_by_title(name,exact=True).press('Enter')
   async with page.expect_response(lambda r:'/api/rankings/difficulty/board' in r.url and r.request.method=='POST') as response:
    await page.get_by_role('button',name='Move selected game to Cuddly',exact=True).press('Enter')
   assert (await response.value).ok
   await expect(page.get_by_role('status',name='Ranking save status')).to_have_text('All changes saved')
   state=await (await ctx.request.get(BASE+'/api/rankings/difficulty/board')).json();assert next(p for p in state['placements'] if int(p['id'])==gid)['score']==1
   await page.reload();await expect(page.get_by_role('button',name='Move selected game to Cuddly',exact=True)).to_be_visible();assert await page.get_by_role('button',name='Move selected game to Cuddly',exact=True).locator('..').get_by_title(name,exact=True).count()==1
   state=await (await ctx.request.get(BASE+'/api/rankings/enjoyment/board')).json();assert next(p for p in state['placements'] if int(p['id'])==gid)['tier']=='C'
   print('Difficulty score 1 persists after reload and leaves enjoyment unchanged: PASS',flush=True)
   # Same scope edits from another tab conflict instead of replacing its save.
   await page.goto(BASE+'/tier-list');await expect(page.get_by_role('heading',name='Tier List',exact=True)).to_be_visible()
   external=await (await ctx.request.get(BASE+'/api/rankings/enjoyment/board')).json();entries=[{'id':p['id'],'tier':p['tier']} for p in external['placements'] if int(p['id'])!=other['bgg_id']]+[{'id':str(other['bgg_id']),'tier':'S'}]
   result=await ctx.request.post(BASE+'/api/rankings/enjoyment/board',headers=headers,data={'revision':external['revision'],'entries':entries});assert result.ok
   await page.get_by_title(name,exact=True).press('Enter');await page.get_by_role('button',name='Move selected game to F',exact=True).press('Enter');await expect(page.get_by_text('These rankings changed in another tab.',exact=False)).to_be_visible()
   current=await (await ctx.request.get(BASE+'/api/rankings/enjoyment/board')).json();assert next(p for p in current['placements'] if int(p['id'])==gid)['tier']=='C';assert any(int(p['id'])==other['bgg_id'] for p in current['placements'])
   print('Stale browser saves retain unsaved moves and never overwrite another tab: PASS',flush=True)
   assert not errors,errors
  finally:
   await page.close();await asyncio.sleep(0.2);await restore();await browser.close()
asyncio.run(main())
