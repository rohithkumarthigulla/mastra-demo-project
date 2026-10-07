import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import { InMemoryEquipmentKnowledgeRepository } from '../modules/equipment-knowledge/testing/in-memory-equipment-knowledge.repository';
import { systemClock } from '../platform/auth';
import { seedEquipmentKnowledge } from './seed-equipment-knowledge';
import { seedTaxonomy } from './seed-taxonomy';

describe('seedTaxonomy', () => {
  it('meets the minimums, links every kind and is idempotent', async () => {
    const service = new EquipmentKnowledgeService(
      new InMemoryEquipmentKnowledgeRepository(),
      systemClock,
    );
    await seedEquipmentKnowledge(service);

    const first = await seedTaxonomy(service);
    assert.ok(first.capabilities >= 10);
    assert.ok(first.constructionTasks >= 8);
    assert.ok(first.taskCapabilities > 0);
    assert.ok(first.taskCategories > 0);
    assert.ok(first.categoryCapabilities > 0);
    assert.ok(first.modelCapabilities > 0);
    assert.equal((await service.listCapabilities()).length, first.capabilities);
    assert.equal((await service.listConstructionTasks()).length, first.constructionTasks);

    const [source] = await service.listSources();
    const excavator = await service.findCategoryByCode('EXCAVATOR');
    assert.ok(excavator && source);
    for (const link of await service.listCategoryCapabilities(excavator.id)) {
      assert.equal(link.verificationStatus, 'REVIEW_REQUIRED');
      assert.equal(link.source?.sourceType, 'TEST_FIXTURE');
      assert.equal(link.verifiedAt, null);
    }
    for (const link of await service.listCapabilityModels('LOADING')) {
      assert.equal(link.verificationStatus, 'REVIEW_REQUIRED');
      assert.equal(link.sourceId, source.id);
    }

    assert.deepEqual(await seedTaxonomy(service), {
      capabilities: 0,
      constructionTasks: 0,
      taskCapabilities: 0,
      taskCategories: 0,
      categoryCapabilities: 0,
      modelCapabilities: 0,
    });
    assert.equal((await service.listCapabilities()).length, first.capabilities);
  });
});
