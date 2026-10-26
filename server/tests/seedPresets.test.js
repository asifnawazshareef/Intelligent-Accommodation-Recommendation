import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presets, presetDescriptions, recipe, getSeedPresets } from '../services/seed/config.js';
import { buildDataset } from '../services/seed/generator.js';

test('all 16 presets produce complete deterministic related records', () => {
  assert.equal(Object.keys(presets).length, 16);
  for (const [key, values] of Object.entries(presets)) {
    assert.ok(presetDescriptions[key]);
    const config = recipe({ ...values, referenceDate: '2026-10-01' });
    const items = buildDataset(`preset_${key}`, config);
    assert.equal(items.length, config.owners + config.guests + config.properties + 2 * config.reviews);
    assert.deepEqual(items, buildDataset(`preset_${key}`, config));
    const records = new Map(items.map(i => [i.payload._id, i]));
    assert.equal(records.size, items.length);
    const emails = items.filter(i => i.entity === 'users').map(i => i.payload.email);
    assert.equal(new Set(emails).size, emails.length);
    for (const { entity, payload: p } of items) {
      if (entity === 'users') assert.ok(['guest', 'owner'].includes(p.role));
      if (entity === 'properties') {
        assert.equal(records.get(p.owner).payload.role, 'owner');
        assert.ok(p.price >= config.minPrice && p.price <= config.maxPrice);
        assert.ok(config.cities.includes(p.location.city));
      }
      if (entity === 'bookings') {
        assert.equal(records.get(p.guest).payload.role, 'guest');
        assert.equal(records.get(p.property).payload.status, 'approved');
        assert.ok(p.startDate < p.endDate);
        assert.ok(p.endDate < config.referenceDate);
      }
      if (entity === 'reviews') {
        assert.equal(records.get(p.booking).entity, 'bookings');
        if (['positive', 'negative', 'neutral', 'mixed'].includes(key)) assert.equal(p.sentiment, key);
      }
    }
  }
});

test('real catalog recipes reject invented properties, unavailable cities and unknown sources', () => {
  assert.throws(() => recipe({ ...presets.pakistan, properties: 7 }), /selected cities/);
  assert.throws(() => recipe({ ...presets.pakistan, cities: ['Karachi'] }), /selected cities/);
  assert.throws(() => recipe({ ...presets.pakistan, propertySource: 'random_photos' }), /catalog/);
  const config = recipe({ ...presets.pakistan, cities: ['Lahore'], properties: 1 });
  const properties = buildDataset('lahore_catalog', config).filter(i => i.entity === 'properties');
  assert.equal(properties.length, 1);
  assert.equal(properties[0].payload.title, "Faletti's Hotel Lahore");
});

test('every real property has distinct bundled photos, credits and demo labels', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const { pakistanCatalog } = await import('../services/seed/pakistanCatalog.js');
  const hashes = new Set();
  const generated = buildDataset('real_catalog', presets.pakistan);
  for (const p of pakistanCatalog) {
    assert.ok(p.images.length >= 2 && p.images.length <= 5);
    assert.ok(p.sourceUrl.startsWith('https://'));
    for (const image of p.images) {
      const bytes = await readFile(new URL(`../public${image.url}`, import.meta.url));
      const hash = createHash('sha256').update(bytes).digest('hex');
      assert.equal(hash, image.sha256);
      assert.equal(hashes.has(hash), false, 'No repeated or renamed photos');
      hashes.add(hash);
      assert.ok(image.credit.author);
      assert.ok(image.credit.title);
      assert.ok(image.credit.sourceUrl.startsWith('https://commons.wikimedia.org/'));
      assert.ok(image.credit.licenseUrl.startsWith('https://creativecommons.org/'));
    }
  }
  for (const { entity, payload } of generated) {
    if (entity === 'properties') {
      assert.ok(payload.description.length > 0);
      assert.doesNotMatch(payload.description, /FYP DEMO/);
      assert.ok(payload.seedCatalog.sourceUrl);
      assert.ok(payload.images.length >= 2 && payload.images.length <= 5);
    }
    if (entity === 'reviews') assert.match(payload.text, /^Demo review, not a real guest experience/);
  }
});
test('supervisor demo has 200 unique hotel names across cities and all review tones', () => {
  const selected = getSeedPresets().supervisor;
  assert.ok(selected, 'The packaged catalog must contain at least 200 distinct hotels');
  const items = buildDataset('supervisor_demo', { ...selected, referenceDate: '2026-10-01' });
  const hotels = items.filter(item => item.entity === 'properties');
  const reviews = items.filter(item => item.entity === 'reviews');
  assert.equal(hotels.length, 200);
  assert.ok(hotels.every(item => item.payload.availabilityCalendar[0].endDate === '2027-02-28'));
  assert.ok(hotels.every(item => /\bhotel\b/i.test(item.payload.title)));
  assert.equal(new Set(hotels.map(item => item.payload.title.toLocaleLowerCase('en'))).size, 200);
  assert.ok(new Set(hotels.map(item => item.payload.location.city)).size >= 10);
  assert.equal(reviews.length, 800);
  const perProperty = new Map();
  for (const review of reviews) perProperty.set(String(review.payload.property), (perProperty.get(String(review.payload.property)) || 0) + 1);
  assert.equal(perProperty.size, 200);
  assert.equal([...perProperty.values()].reduce((sum, count) => sum + count, 0), 800);
  assert.ok([...perProperty.values()].some(count => count < 4));
  assert.ok([...perProperty.values()].some(count => count > 4));
  assert.ok(Math.max(...perProperty.values()) <= 8);
  const bookings = items.filter(item => item.entity === 'bookings');
  for (const property of hotels) {
    const stays = bookings.filter(item => String(item.payload.property) === String(property.payload._id))
      .sort((a, b) => a.payload.startDate.localeCompare(b.payload.startDate));
    for (let i = 1; i < stays.length; i++) assert.ok(stays[i - 1].payload.endDate < stays[i].payload.startDate);
  }
  for (const sentiment of ['positive', 'negative', 'neutral', 'mixed'])
    assert.ok(reviews.filter(item => item.payload.sentiment === sentiment).length >= 50);
  assert.ok(reviews.every(item => item.payload.text.startsWith('Demo review, not a real guest experience.')));
});
test('new collected property datasets also vary reviews across properties', () => {
  const collected = getSeedPresets().pakistanCollected;
  const values = { ...collected, properties: 20, reviews: 80, referenceDate: '2026-10-01' };
  const reviews = buildDataset('collected_varied', values).filter(item => item.entity === 'reviews');
  const counts = new Map();
  for (const review of reviews) counts.set(String(review.payload.property), (counts.get(String(review.payload.property)) || 0) + 1);
  assert.equal(counts.size, 20);
  assert.ok([...counts.values()].some(count => count < 4));
  assert.ok([...counts.values()].some(count => count > 4));
});
