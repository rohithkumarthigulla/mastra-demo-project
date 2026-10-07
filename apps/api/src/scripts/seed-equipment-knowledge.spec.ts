import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import { InMemoryEquipmentKnowledgeRepository } from '../modules/equipment-knowledge/testing/in-memory-equipment-knowledge.repository';
import { systemClock } from '../platform/auth';
import { seedEquipmentKnowledge } from './seed-equipment-knowledge';

describe('seedEquipmentKnowledge', () => {
  it('meets the minimum reference data and is idempotent', async () => {
    const service = new EquipmentKnowledgeService(
      new InMemoryEquipmentKnowledgeRepository(),
      systemClock,
    );

    const first = await seedEquipmentKnowledge(service);
    assert.ok(first.categories >= 6);
    assert.ok(first.manufacturers >= 8);
    assert.ok(first.models >= 15);
    assert.ok(first.definitions >= 10);
    assert.ok(first.specifications > 0);

    const second = await seedEquipmentKnowledge(service);
    assert.deepEqual(second, {
      categories: 0,
      manufacturers: 0,
      definitions: 0,
      models: 0,
      specifications: 0,
    });
    const page = await service.listModels({ limit: 200, offset: 0 });
    assert.equal(page.total, first.models);
  });
});
