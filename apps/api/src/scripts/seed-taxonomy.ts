import type { EquipmentKnowledgeService } from '../modules/equipment-knowledge/application';
import { SEED_SOURCE_NAME } from './seed-equipment-knowledge';
import {
  seedCapabilities,
  seedCategoryCapabilities,
  seedConstructionTasks,
  seedModelCapabilities,
  seedTaskCapabilities,
  seedTaskCategories,
} from './taxonomy-seed-data';

export interface TaxonomySeedSummary {
  capabilities: number;
  constructionTasks: number;
  taskCapabilities: number;
  taskCategories: number;
  categoryCapabilities: number;
  modelCapabilities: number;
}

/**
 * Find-or-create by natural key; existing rows and links are never changed. Runs after
 * `seedEquipmentKnowledge`, whose categories, models and TEST_FIXTURE source it links to.
 */
export async function seedTaxonomy(
  knowledge: EquipmentKnowledgeService,
): Promise<TaxonomySeedSummary> {
  const created: TaxonomySeedSummary = {
    capabilities: 0,
    constructionTasks: 0,
    taskCapabilities: 0,
    taskCategories: 0,
    categoryCapabilities: 0,
    modelCapabilities: 0,
  };

  const source = (await knowledge.listSources()).find(
    (s) => s.sourceType === 'TEST_FIXTURE' && s.sourceName === SEED_SOURCE_NAME,
  );
  if (!source) throw new Error('Seed equipment knowledge before the taxonomy');

  for (const input of seedCapabilities) {
    if (!(await knowledge.findCapabilityByCode(input.code))) {
      await knowledge.createCapability(input);
      created.capabilities++;
    }
  }

  const taskIds = new Map<string, string>();
  for (const input of seedConstructionTasks) {
    let task = await knowledge.findConstructionTaskByCode(input.code);
    if (!task) {
      task = await knowledge.createConstructionTask(input);
      created.constructionTasks++;
    }
    taskIds.set(input.code, task.id);
  }
  const taskId = (code: string) => {
    const id = taskIds.get(code);
    if (!id) throw new Error(`Seed link references unknown task ${code}`);
    return id;
  };

  for (const [task, capabilityCode, importance] of seedTaskCapabilities) {
    const existing = await knowledge.listTaskCapabilities(taskId(task));
    if (!existing.some((l) => l.capability.code === capabilityCode)) {
      await knowledge.addTaskCapability(taskId(task), { capabilityCode, importance });
      created.taskCapabilities++;
    }
  }

  for (const [task, categoryCode, suitability] of seedTaskCategories) {
    const existing = await knowledge.listTaskCategories(taskId(task));
    if (!existing.some((l) => l.category.code === categoryCode)) {
      await knowledge.addTaskCategory(taskId(task), { categoryCode, suitability });
      created.taskCategories++;
    }
  }

  for (const [categoryCode, capabilityCode] of seedCategoryCapabilities) {
    const category = await knowledge.findCategoryByCode(categoryCode);
    if (!category) throw new Error(`Seed link references unknown category ${categoryCode}`);
    const existing = await knowledge.listCategoryCapabilities(category.id);
    if (!existing.some((l) => l.capability.code === capabilityCode)) {
      await knowledge.addCategoryCapability(category.id, { capabilityCode, sourceId: source.id });
      created.categoryCapabilities++;
    }
  }

  for (const [manufacturerName, modelName, capabilityCode] of seedModelCapabilities) {
    const manufacturer = await knowledge.findManufacturerByName(manufacturerName);
    const model = manufacturer && (await knowledge.findModelByName(manufacturer.id, modelName));
    if (!model) throw new Error(`Seed link references unknown model ${modelName}`);
    const existing = await knowledge.listModelCapabilities(model.id);
    if (!existing.some((l) => l.capability.code === capabilityCode)) {
      await knowledge.addModelCapability(model.id, { capabilityCode, sourceId: source.id });
      created.modelCapabilities++;
    }
  }

  return created;
}
