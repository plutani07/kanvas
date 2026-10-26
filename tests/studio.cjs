/* Browser integration tests: real canvas pixels, persistence, downloads, and responsive UI. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../web');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
let browser;
const errors = [];
function monitor(page) { page.on('pageerror', error => errors.push(error.stack)); }
async function settle(page) { await page.waitForTimeout(180); }
async function check(name, fn) { await fn(); console.log('PASS ' + name); }
async function pixel(page, x, y) { return page.evaluate(([x,y]) => [...activeL().ctx.getImageData(x,y,1,1).data], [x,y]); }
async function stroke(page, points) {
  const coords = await page.evaluate(points => { const r=view.getBoundingClientRect();return points.map(([x,y])=>{const p=toScr(x,y);return {x:p.x+r.left,y:p.y+r.top}}) }, points);
  await page.mouse.move(coords[0].x,coords[0].y);await page.mouse.down();
  for(const p of coords.slice(1))await page.mouse.move(p.x,p.y,{steps:12});
  await page.mouse.up();await settle(page);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true, ...(process.env.KANVAS_BROWSER_PATH ? {executablePath:process.env.KANVAS_BROWSER_PATH,args:['--no-sandbox','--no-zygote','--single-process','--disable-gpu','--disable-software-rasterizer']} : {})});
  fs.mkdirSync(path.resolve(__dirname,'artifacts'),{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  const p=await context.newPage();monitor(p);await p.goto(url);await p.waitForFunction(()=>document.body.classList.contains('gal')&&S.brushes.length>0);
  await check('desktop gallery opens and custom canvas can be created', async()=>{
    await p.click('#heroNew');await p.fill('#nw','400');await p.fill('#nh','400');await p.click('#ncust');
    await p.waitForFunction(()=>!inGallery&&S.W===400&&S.H===400&&!dirty);
    if(await p.locator('#tips').count())await p.click('#tips button');
    assert.equal(await p.locator('.studio-layer').count(),2);
    assert.equal(await p.locator('.studio-inspector').isVisible(),true);
  });
  await check('brush draws actual pixels; keyboard undo and redo restore them', async()=>{
    await p.locator('#studioHex').fill('#e34b69');await p.locator('#studioHex').press('Enter');await p.locator('#studioHex').blur();
    await p.evaluate(()=>{brushFor('brush').size=35;brushFor('brush').taperStart=0;brushFor('brush').taperEnd=0;brushFor('brush').smooth=0;renderOpts()});
    await stroke(p,[[80,100],[150,100],[230,100]]);assert.ok((await pixel(p,150,100))[3]>0);
    await p.keyboard.press('Control+z');assert.equal((await pixel(p,150,100))[3],0);
    await p.keyboard.press('Control+Shift+z');assert.ok((await pixel(p,150,100))[3]>0);
  });
  await check('persistent layers support add, duplicate, visibility, opacity and reorder', async()=>{
    await p.click('[data-slact="dup"]');await settle(p);assert.equal(await p.evaluate(()=>S.layers.length),3);
    await p.click('[data-seye="2"]');await settle(p);assert.equal(await p.evaluate(()=>activeL().visible),false);
    await p.click('[data-seye="2"]');await settle(p);
    await p.locator('#studioOpacity').evaluate(el=>{el.value='0.4';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))});await settle(p);
    assert.equal(await p.evaluate(()=>activeL().opacity),.4);
    await p.click('[data-slact="down"]');await settle(p);assert.equal(await p.evaluate(()=>S.active),1);
    await p.click('[data-slact="add"]');await settle(p);assert.equal(await p.evaluate(()=>S.layers.length),4);
  });
  await check('fill and rectangular selection constrain painting to selected pixels',async()=>{
    await p.evaluate(()=>{S.selMode='rect';S.selOp='new';setTool('select')});
    await stroke(p,[[100,180],[200,280]]);
    assert.ok(await p.evaluate(()=>!!S.sel));
    await p.evaluate(()=>{setHex('#34b199');selFill()});
    assert.ok((await pixel(p,150,220))[3]>0);assert.equal((await pixel(p,50,50))[3],0);
    await p.keyboard.press('Control+d');assert.equal(await p.evaluate(()=>!!S.sel),false);
  });
  await check('space drag pans without painting and zoom shortcuts preserve a usable canvas',async()=>{
    await p.evaluate(()=>setTool('brush'));const old=await p.evaluate(()=>({x:S.view.x,y:S.view.y,n:S.undo.length}));
    await p.mouse.move(600,500);await p.keyboard.down('Space');await p.mouse.down();await p.mouse.move(650,525);await p.mouse.up();await p.keyboard.up('Space');
    const next=await p.evaluate(()=>({x:S.view.x,y:S.view.y,n:S.undo.length}));assert.equal(next.n,old.n);assert.equal(next.x-old.x,50);assert.equal(next.y-old.y,25);
    await p.keyboard.press('Control+1');assert.equal(await p.evaluate(()=>S.view.s),1);await p.keyboard.press('Control+0');
  });
  await check('command search runs a real command; history jumps undo and redo',async()=>{
    await p.keyboard.press('Control+k');await p.fill('#commandSearch','New layer');await p.keyboard.press('Enter');await settle(p);
    assert.equal(await p.evaluate(()=>S.layers.length),5);
    await p.click('[data-panel="history"]');await settle(p);await p.click('[data-history="0"]');await settle(p);assert.equal(await p.evaluate(()=>S.undo.length),0);
    const n=await p.evaluate(()=>S.redo.length);await p.locator(`[data-history="${n}"]`).click();await settle(p);assert.equal(await p.evaluate(()=>S.redo.length),0);
    await p.click('[data-panel="navigator"]');await settle(p);assert.ok(await p.locator('#studioNav').isVisible());await p.click('#nav100');assert.equal(await p.evaluate(()=>S.view.s),1);await p.click('#navFit');
    await p.click('[data-panel="layers"]');
  });
  await check('brush library, editable text, transform and adjustments remain functional',async()=>{
    await p.click('[data-panel="brushes"]');await settle(p);await p.locator('[data-sbrush="pen"]').click();await settle(p);assert.equal(await p.evaluate(()=>S.brushSel.brush),'pen');await p.click('[data-panel="layers"]');
    const oldActive=await p.evaluate(()=>S.active);
    await p.evaluate(()=>{lastText.family='sans-serif';lastText.size=32;setTool('text')});
    const at=await p.evaluate(()=>{const r=view.getBoundingClientRect(),q=toScr(200,330);return {x:r.left+q.x,y:r.top+q.y}});await p.mouse.click(at.x,at.y);await p.fill('#tstr','Kanvas');await p.click('#tok');await p.waitForFunction(()=>activeL()?.text?.str==='Kanvas');
    await p.evaluate(async()=>{await setTool('move');if(!FL)await startTransform()});await p.waitForFunction(()=>!!FL);const x=await p.evaluate(()=>activeL().text.x);await p.evaluate(async()=>{FL.t.tx+=10;await applyTransform()});assert.equal(await p.evaluate(()=>activeL().text.x),x+10);
    await p.evaluate(()=>{undo();undo()});await p.evaluate(i=>{S.active=i;setTool('brush')},oldActive);assert.equal(await p.evaluate(()=>S.layers.length),5);
    await p.evaluate(()=>{S.active=S.layers.findIndex(l=>l.name!=='Paper'&&l.ctx.getImageData(150,100,1,1).data[3]>0)});
    const before=await pixel(p,150,100);await p.click('#railFilter');await p.click('#fxQuick');await p.click('#ainv');await settle(p);await p.click('#aapply');assert.notDeepEqual(await pixel(p,150,100),before);await p.evaluate(()=>undo());assert.deepEqual(await pixel(p,150,100),before);
    await p.evaluate(i=>{S.active=i;renderLayers()},oldActive);
    assert.equal(await p.evaluate(()=>ensureJsQR()),true);
  });
  await check('FX browser previews, compares, searches and cancels without changing layer pixels',async()=>{
    await p.evaluate(()=>{const L=newLayer('FX fixture');L.ctx.fillStyle='#285078';L.ctx.fillRect(60,60,240,240);addLayerAt(L,S.active+1,'FX test layer')});
    const before=await pixel(p,120,120),n=await p.evaluate(()=>S.undo.length);
    await p.click('#railFilter');await p.waitForFunction(()=>!!FX_UI.session?.result);assert.equal(await p.locator('[data-fx]').count(),70);await p.locator('#fxApply').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'shClose');
    await p.fill('#fxSearch','invert');await p.click('[data-fx="invert"]');await p.waitForFunction(()=>FX_UI.session?.filter.id==='invert'&&!!FX_UI.session.result);
    assert.deepEqual(await pixel(p,120,120),before);assert.notDeepEqual(await p.evaluate(()=>[...pc.getImageData(120,120,1,1).data]),before);
    await p.click('#fxCompare');assert.deepEqual(await p.evaluate(()=>[...pc.getImageData(120,120,1,1).data]),before);
    await p.click('#fxCancel');assert.deepEqual(await pixel(p,120,120),before);assert.equal(await p.evaluate(()=>S.undo.length),n);assert.equal(await p.evaluate(()=>previewOn),false);
  });
  await check('FX applies only inside selections, preserves alpha lock, and supports undo/redo',async()=>{
    await p.evaluate(()=>{selChange('FX test selection',m=>m.fillRect(80,80,80,80),'new');activeL().alphaLock=true});
    const outside=await pixel(p,200,200),inside=await pixel(p,120,120),n=await p.evaluate(()=>S.undo.length);
    await p.click('#railFilter');await p.waitForFunction(()=>!!FX_UI.session?.result);await p.click('[data-fx="invert"]');await p.waitForFunction(()=>!!FX_UI.session?.result);
    await p.click('#fxApply');await p.waitForFunction(()=>FX_UI.session===null);assert.equal(await p.evaluate(()=>S.undo.length),n+1);
    assert.deepEqual(await pixel(p,120,120),[215,175,135,255]);assert.deepEqual(await pixel(p,200,200),outside);assert.equal((await pixel(p,10,10))[3],0);
    await p.evaluate(()=>undo());assert.deepEqual(await pixel(p,120,120),inside);await p.evaluate(()=>redo());assert.deepEqual(await pixel(p,120,120),[215,175,135,255]);await p.evaluate(()=>undo());
    await p.evaluate(()=>{deselect();activeL().alphaLock=false});
  });
  await check('FX rendering cancellation ignores late worker results and autosave excludes preview',async()=>{
    const before=await pixel(p,120,120),n=await p.evaluate(()=>S.undo.length);
    await p.evaluate(()=>{window.RealFXWorker=window.Worker;window.Worker=class extends RealFXWorker{set onmessage(fn){super.onmessage=e=>setTimeout(()=>fn(e),300)}}});
    await p.click('#railFilter');await p.waitForFunction(()=>!!FX_UI.session?.result);
    const saved=await p.evaluate(async()=>{markDirty();await saveDoc();const a=ARTS.find(a=>a.id===S.artId),im=await createImageBitmap(a.thumb),c=mkC(im.width,im.height);c.getContext('2d').drawImage(im,0,0);im.close();return [...c.getContext('2d').getImageData(Math.round(120*c.width/S.W),Math.round(120*c.height/S.H),1,1).data]});assert.deepEqual(saved,before);
    await p.click('#fxApply');await p.click('#fxCancel');await p.waitForTimeout(500);assert.deepEqual(await pixel(p,120,120),before);assert.equal(await p.evaluate(()=>S.undo.length),n);assert.equal(await p.evaluate(()=>previewOn),false);
    await p.evaluate(()=>{window.Worker=window.RealFXWorker;delete window.RealFXWorker});
  });
  await check('FX falls back when Workers are unavailable and is reachable on phones',async()=>{
    await p.evaluate(()=>{window.RealFXWorker=window.Worker;window.Worker=class{constructor(){throw new Error('Workers blocked')}}});
    await p.click('#railFilter');await p.waitForFunction(()=>!!FX_UI.session?.result);assert.equal(await p.evaluate(()=>FX_UI.workerAvailable),false);await p.fill('#fxSearch','noise');await p.click('[data-fx="noise"]');await p.waitForFunction(()=>FX_UI.session?.filter.id==='noise'&&!!FX_UI.session.result);await p.locator('#fxSearch').focus();await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>FX_UI.session),null);
    await p.evaluate(()=>{window.Worker=window.RealFXWorker;delete window.RealFXWorker;FX_UI.workerAvailable=true;FX_UI.query='';FX_UI.group='all';FX_UI.last='brightness'});
    await p.setViewportSize({width:390,height:844});await settle(p);await p.click('#bTool');await p.click('[data-tk="filter"]');await p.waitForFunction(()=>!!FX_UI.session?.result);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.screenshot({path:path.resolve(__dirname,'artifacts/fx-phone.png')});await p.click('#fxCancel');await p.setViewportSize({width:1440,height:1000});await settle(p);
    await p.click('#railFilter');await p.waitForFunction(()=>!!FX_UI.session?.result);await p.screenshot({path:path.resolve(__dirname,'artifacts/fx-desktop.png')});await p.click('#fxCancel');
    await p.evaluate(()=>{layerAct('del');setTool('brush')});assert.equal(await p.evaluate(()=>S.layers.length),5);
  });
  let projectPath;
  await check('PNG, JPEG, and editable projects produce browser downloads',async()=>{
    await p.click('#exportAction');
    for(const [id,ext] of [['exportPNG','.png'],['exportJPG','.jpg'],['exportProject','.json']]){
      const pending=p.waitForEvent('download');await p.click('#'+id);const dl=await pending;assert.ok(dl.suggestedFilename().endsWith(ext));
      assert.equal(await dl.failure(),null);if(ext==='.json'){projectPath=await dl.path();const d=JSON.parse(fs.readFileSync(projectPath,'utf8'));assert.equal(d.layers.length,5);assert.equal(d.W,400)}
    }
    await p.click('#shClose');
  });
  await check('save/reload preserves layers and painted pixels; project import round-trips',async()=>{
    const id=await p.evaluate(async()=>{await saveDoc();return S.artId});await p.reload();await p.waitForFunction(()=>inGallery&&ARTS.length===1);await p.evaluate(id=>openArt(id),id);await settle(p);
    assert.equal(await p.evaluate(()=>S.layers.length),5);assert.ok(await p.evaluate(()=>S.layers.some(l=>l.ctx.getImageData(150,100,1,1).data[3]>0&&l.name!=='Paper')));
    await p.setInputFiles('#fileProj',projectPath);await p.waitForFunction(()=>ARTS.length===2);const imported=await p.evaluate(()=>gPick);await p.evaluate(id=>openArt(id),imported);assert.equal(await p.evaluate(()=>S.layers.length),5);
  });
  await check('malformed projects cannot allocate an invalid document or load remote images',async()=>{
    const n=await p.evaluate(()=>ARTS.length);await p.setInputFiles('#fileProj',{name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({app:'kanvas',W:999999,H:999999,layers:[{png:'https://example.com/image.png'}]}))});await settle(p);assert.equal(await p.evaluate(()=>ARTS.length),n);assert.equal(await p.evaluate(()=>S.W),400);
  });
  await check('edits during async save are flushed; failed saves retain dirty document',async()=>{
    const result=await p.evaluate(async()=>{const orig=DB.batch.bind(DB);let first=true;DB.batch=async e=>{if(first){first=false;S.docName='Changed during save';markDirty()}return orig(e)};markDirty();await saveDoc();DB.batch=orig;const rec=await DB.get('art:'+S.artId);return {name:rec.name,dirty}});assert.equal(result.name,'Changed during save');assert.equal(result.dirty,false);
    const result2=await p.evaluate(async()=>{const orig=DB.batch;DB.batch=async()=>{throw new Error('storage full')};markDirty();await saveDoc();const id=S.artId;await createArt(100,100);const out={dirty,saveState,same:S.artId===id};DB.batch=orig;await saveDoc();return out});assert.deepEqual(result2,{dirty:true,saveState:'error',same:true});
  });
  await check('gallery search, rename, delete and restore work',async()=>{
    await p.evaluate(()=>goGallery());await p.fill('#gallerySearch','no-such-art');assert.equal(await p.locator('[data-art]').count(),0);assert.ok(await p.locator('.search-empty').isVisible());await p.fill('#gallerySearch','Changed');assert.equal(await p.locator('[data-art]').count(),1);await p.fill('#gallerySearch','');
    await p.evaluate(()=>deleteArts([gPick]));assert.equal(await p.evaluate(()=>TRASH.length),1);await p.click('#sideTrash');await p.locator('[data-tr]').click();await p.waitForFunction(()=>TRASH.length===0);await p.click('#shClose');
  });
  fs.mkdirSync(path.resolve(__dirname,'artifacts'),{recursive:true});
  await p.screenshot({path:path.resolve(__dirname,'artifacts/gallery-desktop.png')});
  await p.evaluate(()=>openArt(ARTS[0].id));await settle(p);await p.screenshot({path:path.resolve(__dirname,'artifacts/editor-desktop.png')});
  await check('phone workspace keeps controls visible and paints with touch input',async()=>{
    await p.setViewportSize({width:390,height:844});await settle(p);assert.equal(await p.locator('.studio-inspector').isVisible(),false);assert.equal(await p.locator('#bar').isVisible(),true);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await p.click('#bBack');await p.click('[data-mn="commands"]');await p.fill('#commandSearch','Fit canvas');await p.keyboard.press('Enter');await p.click('#bLayer');await p.waitForSelector('#lyList');assert.ok(await p.locator('#sheet').isVisible());await p.click('#shClose');
    await p.evaluate(()=>{setTool('brush');fitView()});const n=await p.evaluate(()=>S.undo.length);const cdp=await context.newCDPSession(p);const coords=await p.evaluate(()=>{const r=view.getBoundingClientRect();return [toScr(120,140),toScr(250,140)].map(q=>({x:q.x+r.left,y:q.y+r.top}))});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[coords[0]]});for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:coords[0].x+(coords[1].x-coords[0].x)*i/10,y:coords[0].y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(p);await cdp.detach();assert.equal(await p.evaluate(()=>S.undo.length),n+1);
    await p.screenshot({path:path.resolve(__dirname,'artifacts/editor-phone.png')});
    await p.evaluate(()=>goGallery());await p.screenshot({path:path.resolve(__dirname,'artifacts/gallery-phone.png')});
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  });
  assert.deepEqual(errors,[],'Uncaught browser errors');console.log('All integration checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close()});
