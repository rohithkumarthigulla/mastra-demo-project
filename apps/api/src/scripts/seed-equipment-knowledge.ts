import type { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import {
  seedCategories,
  seedDefinitions,
  seedManufacturers,
  seedModels,
} from './equipment-knowledge-seed-data';

export interface SeedSummary {
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
    categories: 0,
    manufacturers: 0,
    definitions: 0,
    models: 0,
    specifications: 0,
  };

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
    const existing = new Set(
      (await knowledge.getModel(model.id)).specifications.map((s) => s.definitionCode),
    );
    for (const spec of seed.specifications) {
      if (existing.has(spec.definitionCode)) continue;
      await knowledge.addSpecification(model.id, spec);
      created.specifications++;
    }
  }

  return created;
}
