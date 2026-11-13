import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const {messages}=await import('../js/i18n.js');
test('Hindi covers every core message and preserves interpolation parameters',()=>{
  assert.deepEqual(Object.keys(messages.hi).sort(),Object.keys(messages.en).sort());
  for(const key of Object.keys(messages.en)) {
    const params=text=>[...text.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
    assert.deepEqual(params(messages.hi[key]),params(messages.en[key]),key);
  }
  for(const match of read('index.html').matchAll(/data-i18n="([^"]+)"/g)) assert.ok(messages.en[match[1]],match[1]);
});
test('every precached shell file exists and runtime assets are local',()=>{
  const sw=read('sw.js');
  const files=Function('return '+sw.match(/const FILES = (\[[\s\S]*?\]);/)[1])();
  for(const file of files) assert.ok(existsSync(new URL('../'+(file==='./'?'index.html':file),import.meta.url)),file);
  assert.ok(!/https?:\/\//.test(read('css/style.css')));
  const html=read('index.html');
  for(const match of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)) assert.ok(!/^https?:/.test(match[1]),match[1]);
});
test('install manifest works at a nested hosting path',()=>{
  const manifest=JSON.parse(read('manifest.webmanifest'));
  const scope='https://example.org/community/maternai/';
  for(const value of [manifest.start_url,manifest.scope,manifest.id,...manifest.icons.map(icon=>icon.src)])
    assert.ok(new URL(value,scope).href.startsWith(scope));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'));
});
