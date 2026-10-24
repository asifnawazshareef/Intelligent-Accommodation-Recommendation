import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { parseProperty, discoverPages } from '../services/seed/collection/parsers.js';
import { allowedUrl, robotsAllowed, PublicClient } from '../services/seed/collection/network.js';
import { collect } from '../services/seed/collection/collector.js';
import { packageCatalog } from '../services/seed/collection/package.js';

const image = id => `https://q-xx.bstatic.com/xdata/images/hotel/max500/${id}.jpg?k=test`;
const url = 'https://www.sleepzon.com/alpha-123-en';
const hotelHtml = ({ country = 'Pakistan', name = 'Alpha Hotel', extra = '' } = {}) => `<script type="application/ld+json">${JSON.stringify({ '@type':'Hotel',name,address:{addressLocality:'Lahore',streetAddress:'10 Main Road',addressCountry:country}})}</script><img src="${image(1)}" alt="${name}, Lahore"><img src="${image(1).replace('max500','max350')}" alt="${name}, Lahore"><img src="${image(2)}" alt="${name}, Lahore (photo 2)"><img src="${image(3)}" alt="Different Hotel">${extra}`;

test('collector parses source matched Pakistan properties and excludes other galleries and image sizes', () => {
 const p=parseProperty(hotelHtml(),url);
 assert.equal(parseProperty(hotelHtml({extra:`<img src="${image(9)}" alt="Alpha Hotel Annex, Lahore">`}),url).images.length,2);
 assert.equal(p.title,'Alpha Hotel'); assert.equal(p.city,'Lahore'); assert.equal(p.images.length,2);
 assert.equal(parseProperty(hotelHtml({country:'India'}),url),null);
 assert.equal(parseProperty('<h1>No explicit property location</h1>',url),null);
 const links=discoverPages('<a href="/lahore-hotels-pk--123-2-en">Next</a><a href="/alpha-123-en">Alpha</a><a href="https://127.0.0.1/private">Other</a>','https://www.sleepzon.com/en-pk-pakistan');
 assert.deepEqual(links.details,[url]); assert.equal(links.lists.length,1);
});

test('network guard rejects private or arbitrary hosts and honors published robots paths', async () => {
 for(const u of ['http://www.sleepzon.com/test','https://127.0.0.1/','https://www.sleepzon.com@127.0.0.1/','https://www.sleepzon.com:8443/','https://example.com/']) assert.equal(allowedUrl(u),false);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /*?*\nUser-agent: Other\nDisallow: /','/alpha-123-en'),true);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /*?*','/alpha-123-en?sort=x'),false);
 assert.equal(robotsAllowed('User-agent: *\nAllow: /\nUser-agent: IARS-FYP-Collector\nDisallow: /','/alpha'),false);
 let calls=0;
 const c=new PublicClient({intervalMs:0,fetcher:async()=>{calls++;return{status:302,headers:{location:'https://127.0.0.1/'},data:Buffer.from('redirect')}}});
 await assert.rejects(()=>c.request(url,{robots:true}),/Redirect/); assert.equal(calls,1);
 const notImage=new PublicClient({intervalMs:0,fetcher:async()=>({status:200,headers:{'content-type':'image/jpeg'},data:Buffer.alloc(3000,65)})});
 await assert.rejects(()=>notImage.request(image(1),{image:true}),/photograph/);
});

test('collection checkpoints survive resume and never fabricate records to meet the requested target', async () => {
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'iars-collection-'));
 const client={request:async(u,{image:photo=false}={})=>{
   if(photo)return{body:Buffer.from(u),type:'image/jpeg'};
   if(u==='https://www.sleepzon.com/en-pk-pakistan')return{body:Buffer.from('<a href="/alpha-123-en">Alpha</a>')};
   if(u===url)return{body:Buffer.from(hotelHtml())};
   return{body:Buffer.from('<html></html>')};
 }};
 try {
  const first=await collect({directory,target:2,maxImages:2,client,log:()=>{}});
  assert.equal(first.status,'shortfall');assert.equal(first.collected,1);assert.equal(first.remaining,1);
  const second=await collect({directory,target:2,maxImages:2,client,log:()=>{}});
  assert.equal(second.collected,1);
  const catalog=JSON.parse(await fs.readFile(path.join(directory,'catalog.json'),'utf8'));
  assert.equal(catalog.properties[0].images.length,2);
  assert.ok(catalog.properties.every(p=>p.images.length<=2));
  assert.ok(catalog.properties[0].images.every(x=>x.credit.sourceUrl===url));
  await assert.rejects(()=>packageCatalog(catalog,path.join(directory,'bundle')),/Exactly 1500/);
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});

test('packaged catalogs require 1500 unique properties from multiple sites and preserve the exact digest', async () => {
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'iars-package-'));
 const properties=Array.from({length:1500},(_,i)=>({id:`fixture_${i}`,title:`Test fixture ${i}`,city:'Lahore',address:`${i} Example Road`,country:'Pakistan',
   sourceUrl:i===0?'https://porterpakistan.com/hotel/test':'https://www.sleepzon.com/test-'+i+'-en',
   images:[0,1].map(n=>({url:image(i*2+n),caption:'Test fixture photo',sha256:crypto.createHash('sha256').update(`${i}:${n}`).digest('hex'),credit:{sourceUrl:i===0?'https://porterpakistan.com/hotel/test':'https://www.sleepzon.com/test-'+i+'-en'}}))}));
 try {
  const packed=await packageCatalog({properties},directory);
  const bytes=gunzipSync(await fs.readFile(path.join(directory,packed.digest+'.json.gz')));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),packed.digest);assert.equal(packed.photos,3000);
  const duplicate=structuredClone(properties);duplicate[1].images[0].sha256=duplicate[0].images[0].sha256;
  await assert.rejects(()=>packageCatalog({properties:duplicate},directory),/duplicate/);
  const cache=path.join(directory,'sources');await fs.mkdir(cache);
  const key=crypto.createHash('sha256').update(properties[0].sourceUrl).digest('hex');
  await fs.writeFile(path.join(cache,key+'.html'),'<html>No matching property gallery</html>');
  await assert.rejects(()=>packageCatalog({properties},directory,cache),/Cached source/);

 } finally {await fs.rm(directory,{recursive:true,force:true});}
});

test('interruption preserves in flight property work and releases the collection lock', async () => {
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'iars-paused-'));
 const controller=new AbortController();let begin;
 const started=new Promise(r=>{begin=r;});
 const pages=async(u,{image:photo=false,signal}={})=>{
  if(photo){begin();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('Paused')),{once:true}));}
  return{body:Buffer.from(u.includes('en-pk-pakistan')?'<a href="/alpha-123-en">Alpha</a>':u===url?hotelHtml():'<html></html>')};
 };
 try {
  const running=collect({directory,target:2,maxImages:2,client:{request:pages},signal:controller.signal,log:()=>{}});
  await started;controller.abort();assert.equal((await running).status,'paused');
  const state=JSON.parse(await fs.readFile(path.join(directory,'checkpoint.json'),'utf8'));
  assert.ok(state.pending.some(x=>x.url===url));assert.equal(state.seen.includes(url),false);
  await assert.rejects(()=>fs.access(path.join(directory,'collector.lock')));
  const client={request:async(u,{image:photo=false}={})=>({body:photo?Buffer.from(u):Buffer.from(hotelHtml())})};
  assert.equal((await collect({directory,target:2,maxImages:2,client,log:()=>{}})).collected,1);
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});

test('gallery fallbacks keep the requested image cap when one photograph is unavailable', async () => {
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'iars-photo-cap-'));
 const more=`<img src="${image(4)}" alt="Alpha Hotel, Lahore (photo 4)"><img src="${image(5)}" alt="Alpha Hotel, Lahore (photo 5)">`;
 const client={request:async(u,{image:photo=false}={})=>{
  if(photo){if(u===image(1))throw new Error('Unavailable');return{body:Buffer.from(u)};}
  return{body:Buffer.from(u.includes('en-pk-pakistan')?'<a href="/alpha-123-en">Alpha</a>':u===url?hotelHtml({extra:more}):'<html></html>')};
 }};
 try {
  const report=await collect({directory,target:1,maxImages:2,client,log:()=>{}});assert.equal(report.collected,1);
  const catalog=JSON.parse(await fs.readFile(path.join(directory,'catalog.json'),'utf8'));assert.equal(catalog.properties[0].images.length,2);
 } finally {await fs.rm(directory,{recursive:true,force:true});}
});

test('retry after pauses the source and retries respect the full requested delay', async () => {
 let clock=0,calls=0;const times=[];
 const c=new PublicClient({intervalMs:0,now:()=>clock,wait:async ms=>{clock+=ms;},fetcher:async()=>{
  times.push(clock);calls++;
  return calls===1?{status:429,headers:{'retry-after':'30'},data:Buffer.from('Slow down')}:{status:200,headers:{'content-type':'text/plain'},data:Buffer.from('User-agent: *\nAllow: /')};
 }});
 await c.request('https://www.sleepzon.com/robots.txt',{robots:true});
 assert.equal(calls,2);assert.ok(times[1]-times[0]>=30000);
});
