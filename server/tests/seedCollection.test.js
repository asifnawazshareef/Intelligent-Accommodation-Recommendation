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
import { collectedCatalog, collectedCatalogStatus } from '../services/seed/pakistanCatalog.js';

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
 const cache=path.join(directory,'sources');await fs.mkdir(cache);
 const properties=await Promise.all(Array.from({length:1500},async(_,i)=>{
   const sourceUrl=i===0?'https://porterpakistan.com/hotel/test':'https://www.sleepzon.com/test-'+i+'-en';
   const title=`Test fixture ${i}`;
   const pics=[image(i*2),image(i*2+1)];
   const html=i===0?`<h1>${title}</h1><span itemprop="addressLocality">Lahore</span><span itemprop="streetAddress">${i} Example Road</span>${pics.map(u=>`<a data-lightbox="brand-slider"><img src="${u}"></a>`).join('')}`
     :`<script type="application/ld+json">${JSON.stringify({'@type':'Hotel',name:title,address:{addressLocality:'Lahore',streetAddress:`${i} Example Road`,addressCountry:'Pakistan'}})}</script>${pics.map(u=>`<img src="${u}" alt="${title}, Lahore">`).join('')}`;
   await fs.writeFile(path.join(cache,crypto.createHash('sha256').update(sourceUrl).digest('hex')+'.html'),html);
   const p=parseProperty(html,sourceUrl);p.images=p.images.map((photo,n)=>({...photo,sha256:crypto.createHash('sha256').update(`${i}:${n}`).digest('hex'),credit:{sourceUrl}}));return p;
 }));
 try {
  const packed=await packageCatalog({properties},directory,cache);
  const bytes=gunzipSync(await fs.readFile(path.join(directory,packed.digest+'.json.gz')));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),packed.digest);assert.equal(packed.photos,3000);
  const duplicate=structuredClone(properties);duplicate[1].images[0].sha256=duplicate[0].images[0].sha256;
  await assert.rejects(()=>packageCatalog({properties:duplicate},directory,cache),/duplicate/);
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

test('an access restriction also stops requests already waiting in the source queue', async()=>{
 let clock=0,calls=0,release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const client=new PublicClient({intervalMs:1000,now:()=>clock,wait:async ms=>{await waiting;clock+=ms;},fetcher:async()=>{
   calls++;return{status:403,headers:{},data:Buffer.from('Access denied')};
 }});
 const first=client.request(url,{robots:true});
 const queued=client.request(url,{robots:true});
 await assert.rejects(()=>first,/restriction/);release();
 await assert.rejects(()=>queued,/restriction/);assert.equal(calls,1);
});


test('bundled partial collection resumes without fetching saved records and rejects tampered trusted data', {skip:!collectedCatalogStatus().available}, async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'iars-bootstrap-'));
 const controller=new AbortController();controller.abort();
 try {
  const bundle=collectedCatalog();
  const report=await collect({directory,bootstrap:true,signal:controller.signal,client:{request:async()=>{throw new Error('Must not fetch');}},log:()=>{}});
  assert.equal(report.collected,bundle.properties.length);
  const state=JSON.parse(await fs.readFile(path.join(directory,'checkpoint.json'),'utf8'));
  assert.equal(state.trustedCatalogDigest,bundle.digest);assert.deepEqual(state.properties,bundle.properties);
  assert.ok(state.pending.length>0);
  const packaged=await packageCatalog(state,path.join(directory,'bundle'),path.join(directory,'cache'),{partial:true,resume:state});
  assert.equal(packaged.properties,bundle.properties.length);assert.equal(packaged.remaining,1500-bundle.properties.length);
  state.properties[0].title='Tampered property';
  await assert.rejects(()=>packageCatalog(state,path.join(directory,'bundle'),path.join(directory,'cache'),{partial:true}),/no unchanged trusted record/);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('collecting a new record cannot mutate the trusted bundled snapshot', {skip:!collectedCatalogStatus().available || collectedCatalogStatus().ready}, async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'iars-trust-'));
 try {
  const bundled=collectedCatalog(), count=bundled.properties.length;
  const client={request:async(u,{image:photo=false}={})=>({body:Buffer.from(photo?u:hotelHtml({name:'Isolated Fixture Hotel'}))})};
  const report=await collect({directory,bootstrap:true,target:count+1,concurrency:1,maxImages:2,client,log:()=>{}});
  assert.equal(report.collected,count+1);assert.equal(collectedCatalog().properties.length,count);
  const input=JSON.parse(await fs.readFile(path.join(directory,'catalog.json'),'utf8'));
  // Removing the new page must prevent it from inheriting the bundled digest's trust.
  await fs.rm(path.join(directory,'cache'),{recursive:true});
  await assert.rejects(()=>packageCatalog(input,path.join(directory,'bundle'),undefined,{partial:true}),/no unchanged trusted record/);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
