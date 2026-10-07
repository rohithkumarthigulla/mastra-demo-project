import type { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import {
  seedCategories,
  seedDefinitions,
  seedManufacturers,
  seedModels,
} from './equipment-knowledge-seed-data';

export const SEED_SOURCE_NAME = 'Seed reference data';

export interface SeedSummary {
  sources: number;
  categories: number;
  manufacturers: number;
  definitions: number;
  models: number;
  specifications: number;
}

/** Find-or-create by natural key, so running it again only adds what is missing. */
export async function seedEquipmentKnowledge(
  knowledge: EquipmentKnowledgeService,
): Promise<SeedSummary> {
  const created: SeedSummary = {
    sources: 0,
    categories: 0,
    manufacturers: 0,
    definitions: 0,
    models: 0,
    specifications: 0,
  };

  // Seeded values are illustrative: they cite a TEST_FIXTURE source, which can never be VERIFIED,
  // so they default to REVIEW_REQUIRED (or UNKNOWN when deliberately empty).
  let source = (await knowledge.listSources()).find(
    (s) => s.sourceType === 'TEST_FIXTURE' && s.sourceName === SEED_SOURCE_NAME,
  );
  if (!source) {
    source = await knowledge.createSource({
      sourceType: 'TEST_FIXTURE',
      sourceName: SEED_SOURCE_NAME,
      notes: 'Illustrative values for development; not verified against manufacturer data.',
    });
    created.sources++;
  }

  const categoryIds = new Map<string, string>();
  for (const input of seedCategories) {
    let category = await knowledge.findCategoryByCode(input.code);
    if (!category) {
      category = await knowledge.createCategory(input);
      created.categories++;
    }
    categoryIds.set(input.code, category.id);
  }

  const manufacturerIds = new Map<string, string>();
  for (const name of seedManufacturers) {
    let manufacturer = await knowledge.findManufacturerByName(name);
    if (!manufacturer) {
      manufacturer = await knowledge.createManufacturer({ name });
      created.manufacturers++;
    }
    manufacturerIds.set(name, manufacturer.id);
  }

  for (const input of seedDefinitions) {
    if (!(await knowledge.findDefinitionByCode(input.code))) {
      await knowledge.createDefinition(input);
      created.definitions++;
    }
  }

  for (const seed of seedModels) {
    const manufacturerId = manufacturerIds.get(seed.manufacturer);
    const categoryId = categoryIds.get(seed.category);
    if (!manufacturerId || !categoryId) {
      throw new Error(`Seed model ${seed.modelName} references unknown seed data`);
    }
    let model = await knowledge.findModelByName(manufacturerId, seed.modelName);
    if (!model) {
      model = await knowledge.createModel({
        manufacturerId,
        categoryId,
        modelName: seed.modelName,
      });
      created.models++;
    }
    const existing = new Map(
      (await knowledge.getModel(model.id)).specifications.map((s) => [s.definitionCode, s]),
    );
    for (const spec of seed.specifications) {
      const current = existing.get(spec.definitionCode);
      if (!current) {
        await knowledge.addSpecification(model.id, { ...spec, sourceId: source.id });
        created.specifications++;
      } else if (current.sourceId === null) {
        // Rows seeded before sources existed were backfilled without one.
        await knowledge.updateSpecification(model.id, current.id, { sourceId: source.id });
      }
    }
  }

  return created;
}
