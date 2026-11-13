import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';
const root = fileURLToPath(new URL('../', import.meta.url));
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server = createServer(async(req,res) => {
  try {
    let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path.startsWith('/stale/maternai/')) {
      if(path.endsWith('/reports/model-evidence.json')) {
        const report=JSON.parse(await readFile(resolve(root,'reports/model-evidence.json'),'utf8'));
        report.model.sha256='0'.repeat(64);
        res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(report)); return;
      }
      path=path.slice('/stale/maternai'.length);
    }
    if(path.startsWith('/unavailable/maternai/')) {
      if(path.endsWith('/vendor/jspdf.umd.min.js')) throw new Error('Simulated unavailable shell asset');
      path=path.slice('/unavailable/maternai'.length);
    }
    if(path.startsWith('/community/maternai/')) path=path.slice('/community/maternai'.length);
    if(path.endsWith('/')) path+='index.html';
    const target=resolve(root,'.'+path);
    if(!target.startsWith(resolve(root)+sep)) throw new Error('Outside app');
    res.writeHead(200,{'Content-Type':mime[extname(target)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
const channel=process.env.BROWSER_CHANNEL || (process.platform==='win32' ? 'msedge' : undefined);
const browser=await chromium.launch({channel,headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[]; const external=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=> { if(!request.url().startsWith(base)) external.push(request.url()); });
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
try {
  await page.goto(base+'/');
  await page.waitForFunction(()=>document.getElementById('offline-status').dataset.ready==='true');
  await page.waitForFunction(()=>document.getElementById('evidence-status').dataset.state==='matched');
  assert.equal(external.length,0,'The app must not require external assets');
  await page.selectOption('#language-select','hi');
  assert.equal(await page.locator('html').getAttribute('lang'),'hi');
  await page.click('#guided-toggle');
  assert.equal(await page.inputValue('#age'),'','Guided mode clears untouched example defaults');
  await page.click('#guided-unknown');
  assert.equal(await page.locator('#unknown-help').isVisible(),true);
  await page.click('#guided-next');
  assert.equal(await page.locator('#age').getAttribute('aria-invalid'),'true');
  assert.match(await page.textContent('#input-errors'),/उम्र/);
  const ids=['age','sbp','dbp','bs','temp','hr'];
  const values=['25','100','70','6.5','98','72'];
  for(let i=0;i<ids.length;i++) {
    if(i===2) {
      await page.selectOption('#language-select','en');
      assert.equal(await page.inputValue('#age'),'25');
      assert.match(await page.textContent('#guided-progress'),/Step 3/);
      await page.selectOption('#language-select','hi');
    }
    await page.fill('#'+ids[i],values[i]);
    await page.click('#guided-next');
  }
  assert.equal(await page.locator('#results-section').isVisible(),true);
  assert.equal(await page.textContent('#risk-label'),'कम जोखिम');
  assert.match(await page.textContent('#uncertainty-text'),/खारिज नहीं/);
  assert.equal(await page.locator('#compare-visit').isDisabled(),true);
  await page.screenshot({path:new URL('../test-results/hindi-result-mobile.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
  await page.click('#back-btn');
  await page.click('#guided-toggle');
  await page.click('[data-preset="high"]');
  await page.click('#predict-btn');
  assert.equal(await page.textContent('#risk-label'),'अधिक जोखिम');
  assert.equal(await page.locator('#comparison-rows tr').count(),6);
  assert.match(await page.textContent('#comparison-summary'),/कम जोखिम/);
  await page.click('#back-btn');
  await page.click('#unit-mgdl'); await page.click('#unit-c');
  await page.click('[data-preset="low"]');
  const sugar=Number(await page.inputValue('#bs'));
  await page.click('#unit-mgdl');
  assert.equal(Number(await page.inputValue('#bs')),sugar,'Repeated unit click must preserve values');
  await page.click('#predict-btn');
  assert.equal(await page.textContent('#risk-label'),'कम जोखिम');
  // Language changes must not alter the underlying assessment.
  await page.selectOption('#language-select','en');
  assert.equal(await page.textContent('#risk-label'),'Low Risk');
  await page.selectOption('#language-select','hi');
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>document.getElementById('offline-status').dataset.ready==='true');
  assert.match(await page.textContent('#offline-status'),/इंटरनेट बंद/);
  await page.waitForFunction(()=>document.getElementById('evidence-status').dataset.state==='matched');
  assert.equal(await page.inputValue('#language-select'),'hi');
  await page.click('[data-preset="mid"]'); await page.click('#predict-btn');
  assert.equal(await page.textContent('#risk-label'),'मध्यम जोखिम');
  assert.equal(await page.evaluate(()=>typeof Chart),'function');
  const downloadPromise=page.waitForEvent('download');
  await page.click('#download-pdf-btn');
  const download=await downloadPromise;
  assert.match(download.suggestedFilename(),/\.pdf$/);
  assert.equal(await download.failure(),null);
  // The same app must work under a GitHub Pages-style nested scope.
  await context.setOffline(false);
  const nested=await browser.newContext({viewport:{width:1280,height:900}});
  const nestedPage=await nested.newPage();
  nestedPage.on('pageerror',error=>errors.push(error.message));
  await nestedPage.goto(base+'/community/maternai/');
  await nestedPage.waitForFunction(()=>document.getElementById('offline-status').dataset.ready==='true');
  await nested.setOffline(true); await nestedPage.reload();
  await nestedPage.click('[data-preset="low"]'); await nestedPage.click('#predict-btn');
  assert.equal(await nestedPage.textContent('#risk-label'),'Low Risk');
  await nested.close();
  const blocked=await browser.newContext();
  await blocked.addInitScript(() => {
    Object.defineProperty(window,'localStorage',{get(){ throw new Error('Storage blocked'); }});
  });
  const blockedPage=await blocked.newPage();
  blockedPage.on('pageerror',error=>errors.push(error.message));
  await blockedPage.goto(base+'/');
  await blockedPage.click('[data-preset="low"]'); await blockedPage.click('#predict-btn');
  assert.equal(await blockedPage.textContent('#risk-label'),'Low Risk');
  await blockedPage.selectOption('#language-select','hi');
  assert.equal(await blockedPage.textContent('#risk-label'),'कम जोखिम');
  await blocked.close();
  const unavailable=await browser.newContext();
  const unavailablePage=await unavailable.newPage();
  await unavailablePage.goto(base+'/unavailable/maternai/');
  await unavailablePage.waitForFunction(()=>document.getElementById('offline-status').textContent.includes('failed'));
  assert.equal(await unavailablePage.getAttribute('#offline-status','data-ready'),'false');
  await unavailable.close();
  const stale=await browser.newContext();
  const stalePage=await stale.newPage();
  await stalePage.goto(base+'/stale/maternai/');
  await stalePage.waitForFunction(()=>document.getElementById('evidence-status').dataset.state==='stale');
  assert.equal(await stalePage.locator('#evidence-metrics').textContent(),'');
  await stale.close();
  // The layout should fit a small phone without horizontal page scrolling.
  const overflow = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth, elements:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(el).position!=='fixed').slice(0,25).map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:el.getBoundingClientRect().right}))}));
  if(overflow.scroll>overflow.width) console.log(JSON.stringify(overflow,null,2));
  await page.screenshot({path:new URL('../test-results/mobile-viewport.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  assert.equal(overflow.scroll<=overflow.width,true);
  await page.setViewportSize({width:320,height:740});
  await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth, null, {timeout:5000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('#tab-btn-history').isVisible(),true);
  await page.click('#tab-btn-stats');
  assert.match(await page.locator('#evidence-metrics').textContent(),/562/);
  assert.match(await page.locator('#evidence-findings').textContent(),/42 of 272/);
  assert.match(await page.locator('#evidence-status').textContent(),/not an independent test/);
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#model-evidence').scrollIntoViewIfNeeded();
  await page.screenshot({path:new URL('../test-results/model-evidence.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')});
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: Hindi guided flow, missing readings, language persistence, comparisons, unit conversion, offline reload/prediction/PDF, nested hosting, blocked storage, failed offline setup, checksum-gated evidence dashboard and mobile width.');
} finally {
  await browser.close(); await new Promise(done=>server.close(done));
}
