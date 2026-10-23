import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presets, presetDescriptions, recipe } from '../services/seed/config.js';
import { buildDataset } from '../services/seed/generator.js';

test('all 15 presets produce complete deterministic related records', () => {
  assert.equal(Object.keys(presets).length, 15);
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
