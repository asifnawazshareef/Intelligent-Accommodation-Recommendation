import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { collectedCatalog, collectedCatalogStatus } from '../services/seed/pakistanCatalog.js';
import { getSeedPresets } from '../services/seed/config.js';
import { buildDataset } from '../services/seed/generator.js';
import { initialize, models, validateDataset } from '../services/seed/store.js';
import { createDataset, previewGeneration, startJob } from '../services/seed/management.js';
import { runNextJob } from '../services/seed/jobs.js';

test('installed snapshot generates actual property references with matching photos', { skip: !collectedCatalogStatus().available }, () => {
 const config=getSeedPresets().pakistanCollected;
 const catalog=collectedCatalog(config.catalogDigest);
 assert.equal(catalog.properties.length,collectedCatalogStatus().available);
 const items=buildDataset('real_collected_preview',config);
 assert.equal(items.length,500+catalog.properties.length*9);
 const properties=items.filter(i=>i.entity==='properties');assert.equal(properties.length,catalog.properties.length);
 for(let i=0;i<properties.length;i++){
  assert.equal(properties[i].payload.title,catalog.properties[i].title);
  assert.equal(properties[i].payload.location.address,catalog.properties[i].address);
  assert.deepEqual(properties[i].payload.images.map(x=>x.url),catalog.properties[i].images.map(x=>x.url));
 }
});

test('installed property collection imports through the transactional worker and validates', { skip: process.env.SEED_COLLECTED_LOAD!=='1' || !collectedCatalogStatus().available, timeout: 300000 }, async () => {
 let repl;
 try {
  process.env.NODE_ENV='test';process.env.SEED_DASHBOARD_ENABLED='true';process.env.SEED_DATABASE_NAME='collected_load';process.env.SEED_DEMO_PASSWORD='OnlyDemoAccounts123!';
  repl=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},instanceOpts:[{launchTimeout:60000}],replSet:{count:1,args:['--nounixsocket','--setParameter','diagnosticDataCollectionEnabled=false']}});
  await mongoose.connect(repl.getUri('collected_load'));await initialize();
  const actor=await models.users.create({name:'Test operator',email:'operator@example.test',password:'DemoOperator123!',role:'admin',isSuperAdmin:true});
  const config=getSeedPresets().pakistanCollected;
  const count=config.properties;
  const dataset=await createDataset({name:`${count} actual property references`,namespace:'collected_load',recipe:config},actor._id);
  const preview=await previewGeneration(dataset._id,{},actor._id);assert.equal(preview.total,500+count*9);
  const job=await startJob(dataset._id,{kind:'generate',requestKey:crypto.randomUUID(),confirmation:preview.confirmation,recipe:config},actor._id);
  const result=await runNextJob({jobId:job._id,batchSize:100});assert.equal(result.state,'completed',result.error);
  assert.equal(await models.properties.countDocuments(),count);
  assert.equal(await models.bookings.countDocuments(),config.reviews);assert.equal(await models.reviews.countDocuments(),config.reviews);
  const check=await validateDataset(dataset._id);assert.equal(check.valid,true,JSON.stringify(check.issues?.slice(0,5)));
  assert.equal(await models.users.countDocuments({role:'admin'}),1);
 } finally {await mongoose.disconnect();if(repl)await repl.stop();}
});
