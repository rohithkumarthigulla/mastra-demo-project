import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import { hasSpecificationValue } from '../modules/equipment-knowledge/domain';
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
    assert.equal(first.sources, 1);

    const [source] = await service.listSources();
    assert.ok(source);
    assert.equal(source.sourceType, 'TEST_FIXTURE');
    for (const model of (await service.listModels({ limit: 200, offset: 0 })).items) {
      for (const spec of (await service.getModel(model.id)).specifications) {
        assert.equal(
          spec.verificationStatus,
          hasSpecificationValue(spec) ? 'REVIEW_REQUIRED' : 'UNKNOWN',
        );
        assert.equal(spec.sourceId, source.id);
        assert.equal(spec.verifiedAt, null);
      }
    }

    const second = await seedEquipmentKnowledge(service);
    assert.deepEqual(second, {
      sources: 0,
      categories: 0,
      manufacturers: 0,
      definitions: 0,
      models: 0,
      specifications: 0,
    });
    const page = await service.listModels({ limit: 200, offset: 0 });
    assert.equal(page.total, first.models);
    assert.equal((await service.listSources()).length, 1);
  });

  it('attaches the fixture source to rows seeded before sources existed', async () => {
    const repo = new InMemoryEquipmentKnowledgeRepository();
    const service = new EquipmentKnowledgeService(repo, systemClock);
    await seedEquipmentKnowledge(service);
    const [model] = (await service.listModels({ limit: 1, offset: 0 })).items;
    assert.ok(model);
    const [spec] = (await service.getModel(model.id)).specifications;
    assert.ok(spec);
    await service.updateSpecification(model.id, spec.id, { sourceId: null });

    const again = await seedEquipmentKnowledge(service);
    assert.equal(again.specifications, 0);
    const [reattached] = (await service.getModel(model.id)).specifications;
    const [source] = await service.listSources();
    assert.equal(reattached?.sourceId, source?.id);
    assert.ok(source);
    assert.equal(reattached?.verificationStatus, 'REVIEW_REQUIRED');
  });
});
