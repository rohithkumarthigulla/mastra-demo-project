import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, exists, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { DB, isUniqueViolation, type Database } from '../../../platform/database';
import {
  capabilities,
  constructionTaskCapabilities,
  constructionTaskCategories,
  constructionTasks,
  equipmentCategories,
  equipmentCategoryCapabilities,
  equipmentModelCapabilities,
  equipmentModels,
  equipmentSpecifications,
  manufacturers,
  specificationDefinitions,
  specificationSources,
} from '../../../platform/database/schema';
import {
  CapabilityExistsError,
  CategoryExistsError,
  ConstructionTaskExistsError,
  DefinitionExistsError,
  LinkExistsError,
  ManufacturerExistsError,
  ModelExistsError,
  SpecificationExistsError,
  type Capability,
  type CapabilityImportance,
  type CapabilityLink,
  type CapabilityModel,
  type CapabilityTask,
  type CategoryTask,
  type ConstructionTask,
  type EquipmentCategory,
  type EquipmentKnowledgeRepository,
  type EquipmentModel,
  type EquipmentModelStatus,
  type EquipmentSpecification,
  type LinkVerification,
  type LinkVerificationStatus,
  type Manufacturer,
  type ModelSearchCriteria,
  type SpecificationDefinition,
  type SpecificationSource,
  type SpecificationValue,
  type SpecificationValueType,
  type SpecificationVerification,
  type TaskCapability,
  type TaskCategory,
  type TaskSuitability,
  type Unit,
} from '../domain';

const modelColumns = {
  id: equipmentModels.id,
  manufacturerId: equipmentModels.manufacturerId,
  categoryId: equipmentModels.categoryId,
  modelName: equipmentModels.modelName,
  modelCode: equipmentModels.modelCode,
  status: equipmentModels.status,
  createdAt: equipmentModels.createdAt,
  updatedAt: equipmentModels.updatedAt,
};

const specificationColumns = {
  id: equipmentSpecifications.id,
  modelId: equipmentSpecifications.modelId,
  definitionId: equipmentSpecifications.definitionId,
  definitionCode: specificationDefinitions.code,
  numericValue: equipmentSpecifications.numericValue,
  minValue: equipmentSpecifications.minValue,
  maxValue: equipmentSpecifications.maxValue,
  unit: equipmentSpecifications.unit,
  textValue: equipmentSpecifications.textValue,
  normalizedMin: equipmentSpecifications.normalizedMin,
  normalizedMax: equipmentSpecifications.normalizedMax,
  verificationStatus: equipmentSpecifications.verificationStatus,
  sourceId: equipmentSpecifications.sourceId,
  verifiedAt: equipmentSpecifications.verifiedAt,
  source: {
    id: specificationSources.id,
    sourceType: specificationSources.sourceType,
    sourceName: specificationSources.sourceName,
    referenceUrl: specificationSources.referenceUrl,
  },
  createdAt: equipmentSpecifications.createdAt,
  updatedAt: equipmentSpecifications.updatedAt,
};

const sourceSummaryColumns = {
  id: specificationSources.id,
  sourceType: specificationSources.sourceType,
  sourceName: specificationSources.sourceName,
  referenceUrl: specificationSources.referenceUrl,
};

type LinkTable = typeof equipmentModelCapabilities | typeof equipmentCategoryCapabilities;

function provenanceColumns(link: LinkTable) {
  return {
    verificationStatus: sql<LinkVerificationStatus>`${link.verificationStatus}`,
    sourceId: link.sourceId,
    verifiedAt: link.verifiedAt,
    source: sourceSummaryColumns,
  };
}

/** ILIKE pattern matching `text` literally anywhere in the value. */
function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function insertOrConflict<T>(insert: Promise<T>, conflict: () => Error): Promise<T> {
  try {
    return await insert;
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict();
    throw error;
  }
}

@Injectable()
export class DrizzleEquipmentKnowledgeRepository implements EquipmentKnowledgeRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async createCategory(input: { code: string; displayName: string }): Promise<EquipmentCategory> {
    const [row] = await insertOrConflict(
      this.db.insert(equipmentCategories).values(input).returning(),
      () => new CategoryExistsError(),
    );
    return row!;
  }

  listCategories(): Promise<EquipmentCategory[]> {
    return this.db.select().from(equipmentCategories).orderBy(asc(equipmentCategories.code));
  }

  async findCategoryById(id: string): Promise<EquipmentCategory | null> {
    const [row] = await this.db
      .select()
      .from(equipmentCategories)
      .where(eq(equipmentCategories.id, id))
      .limit(1);
    return row ?? null;
  }

  async findCategoryByCode(code: string): Promise<EquipmentCategory | null> {
    const [row] = await this.db
      .select()
      .from(equipmentCategories)
      .where(eq(equipmentCategories.code, code))
      .limit(1);
    return row ?? null;
  }

  async createSource(
    input: Omit<SpecificationSource, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SpecificationSource> {
    const [row] = await this.db.insert(specificationSources).values(input).returning();
    return row!;
  }

  listSources(): Promise<SpecificationSource[]> {
    return this.db
      .select()
      .from(specificationSources)
      .orderBy(
        asc(specificationSources.sourceType),
        asc(sql`lower(${specificationSources.sourceName})`),
        asc(specificationSources.id),
      );
  }

  async findSourceById(id: string): Promise<SpecificationSource | null> {
    const [row] = await this.db
      .select()
      .from(specificationSources)
      .where(eq(specificationSources.id, id))
      .limit(1);
    return row ?? null;
  }

  async createManufacturer(input: { name: string }): Promise<Manufacturer> {
    const [row] = await insertOrConflict(
      this.db.insert(manufacturers).values(input).returning(),
      () => new ManufacturerExistsError(),
    );
    return row!;
  }

  listManufacturers(): Promise<Manufacturer[]> {
    return this.db
      .select()
      .from(manufacturers)
      .orderBy(asc(sql`lower(${manufacturers.name})`), asc(manufacturers.id));
  }

  async findManufacturerById(id: string): Promise<Manufacturer | null> {
    const [row] = await this.db
      .select()
      .from(manufacturers)
      .where(eq(manufacturers.id, id))
      .limit(1);
    return row ?? null;
  }

  async findManufacturerByName(name: string): Promise<Manufacturer | null> {
    const [row] = await this.db
      .select()
      .from(manufacturers)
      .where(sql`lower(${manufacturers.name}) = lower(${name})`)
      .limit(1);
    return row ?? null;
  }

  async createDefinition(input: {
    code: string;
    displayName: string;
    valueType: SpecificationValueType;
    canonicalUnit: Unit | null;
  }): Promise<SpecificationDefinition> {
    const [row] = await insertOrConflict(
      this.db.insert(specificationDefinitions).values(input).returning(),
      () => new DefinitionExistsError(),
    );
    return row!;
  }

  listDefinitions(): Promise<SpecificationDefinition[]> {
    return this.db
      .select()
      .from(specificationDefinitions)
      .orderBy(asc(specificationDefinitions.code));
  }

  async findDefinitionByCode(code: string): Promise<SpecificationDefinition | null> {
    const [row] = await this.db
      .select()
      .from(specificationDefinitions)
      .where(eq(specificationDefinitions.code, code))
      .limit(1);
    return row ?? null;
  }

  async createModel(input: {
    manufacturerId: string;
    categoryId: string;
    modelName: string;
    modelCode: string | null;
    status: EquipmentModelStatus;
  }): Promise<EquipmentModel> {
    const [row] = await insertOrConflict(
      this.db.insert(equipmentModels).values(input).returning(),
      () => new ModelExistsError(),
    );
    return row!;
  }

  async searchModels(criteria: ModelSearchCriteria): Promise<{
    items: EquipmentModel[];
    total: number;
  }> {
    const where = and(
      eq(equipmentModels.status, criteria.status),
      criteria.categoryId === undefined
        ? undefined
        : eq(equipmentModels.categoryId, criteria.categoryId),
      criteria.manufacturer === undefined
        ? undefined
        : eq(sql`lower(${manufacturers.name})`, criteria.manufacturer.toLowerCase()),
      criteria.model === undefined
        ? undefined
        : or(
            ilike(equipmentModels.modelName, containsPattern(criteria.model)),
            ilike(equipmentModels.modelCode, containsPattern(criteria.model)),
          ),
      ...criteria.specs.map((spec) =>
        exists(
          this.db
            .select({ one: sql`1` })
            .from(equipmentSpecifications)
            .where(
              and(
                eq(equipmentSpecifications.modelId, equipmentModels.id),
                eq(equipmentSpecifications.definitionId, spec.definitionId),
                spec.bound === 'min'
                  ? gte(equipmentSpecifications.normalizedMax, spec.value)
                  : lte(equipmentSpecifications.normalizedMin, spec.value),
                criteria.verificationStatus === undefined
                  ? undefined
                  : eq(equipmentSpecifications.verificationStatus, criteria.verificationStatus),
              ),
            ),
        ),
      ),
    );
    const [items, [totals]] = await Promise.all([
      this.db
        .select(modelColumns)
        .from(equipmentModels)
        .innerJoin(manufacturers, eq(manufacturers.id, equipmentModels.manufacturerId))
        .where(where)
        .orderBy(
          asc(sql`lower(${manufacturers.name})`),
          asc(sql`lower(${equipmentModels.modelName})`),
          asc(equipmentModels.id),
        )
        .limit(criteria.limit)
        .offset(criteria.offset),
      this.db
        .select({ total: count() })
        .from(equipmentModels)
        .innerJoin(manufacturers, eq(manufacturers.id, equipmentModels.manufacturerId))
        .where(where),
    ]);
    return { items, total: totals?.total ?? 0 };
  }

  async findModelById(id: string): Promise<EquipmentModel | null> {
    const [row] = await this.db
      .select(modelColumns)
      .from(equipmentModels)
      .where(eq(equipmentModels.id, id))
      .limit(1);
    return row ?? null;
  }

  async findModelByName(manufacturerId: string, modelName: string): Promise<EquipmentModel | null> {
    const [row] = await this.db
      .select(modelColumns)
      .from(equipmentModels)
      .where(
        and(
          eq(equipmentModels.manufacturerId, manufacturerId),
          sql`lower(${equipmentModels.modelName}) = lower(${modelName})`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createSpecification(
    input: { modelId: string; definitionId: string } & SpecificationValue &
      SpecificationVerification,
  ): Promise<EquipmentSpecification> {
    const [row] = await insertOrConflict(
      this.db
        .insert(equipmentSpecifications)
        .values(input)
        .returning({ id: equipmentSpecifications.id }),
      () => new SpecificationExistsError(),
    );
    return (await this.findSpecification(input.modelId, row!.id))!;
  }

  async findSpecification(
    modelId: string,
    specificationId: string,
  ): Promise<EquipmentSpecification | null> {
    const [row] = await this.selectSpecifications()
      .where(
        and(
          eq(equipmentSpecifications.modelId, modelId),
          eq(equipmentSpecifications.id, specificationId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async updateSpecification(
    specificationId: string,
    value: SpecificationValue & SpecificationVerification,
    updatedAt: Date,
  ): Promise<EquipmentSpecification | null> {
    const [row] = await this.db
      .update(equipmentSpecifications)
      .set({ ...value, updatedAt })
      .where(eq(equipmentSpecifications.id, specificationId))
      .returning({ modelId: equipmentSpecifications.modelId });
    return row ? this.findSpecification(row.modelId, specificationId) : null;
  }

  listSpecifications(modelId: string): Promise<EquipmentSpecification[]> {
    return this.selectSpecifications()
      .where(eq(equipmentSpecifications.modelId, modelId))
      .orderBy(asc(specificationDefinitions.code));
  }

  private selectSpecifications() {
    return this.db
      .select(specificationColumns)
      .from(equipmentSpecifications)
      .innerJoin(
        specificationDefinitions,
        eq(specificationDefinitions.id, equipmentSpecifications.definitionId),
      )
      .leftJoin(specificationSources, eq(specificationSources.id, equipmentSpecifications.sourceId))
      .$dynamic();
  }

  async createCapability(input: { code: string; displayName: string }): Promise<Capability> {
    const [row] = await insertOrConflict(
      this.db.insert(capabilities).values(input).returning(),
      () => new CapabilityExistsError(),
    );
    return row!;
  }

  listCapabilities(): Promise<Capability[]> {
    return this.db.select().from(capabilities).orderBy(asc(capabilities.code));
  }

  async findCapabilityByCode(code: string): Promise<Capability | null> {
    const [row] = await this.db
      .select()
      .from(capabilities)
      .where(eq(capabilities.code, code))
      .limit(1);
    return row ?? null;
  }

  async createConstructionTask(input: {
    code: string;
    displayName: string;
  }): Promise<ConstructionTask> {
    const [row] = await insertOrConflict(
      this.db.insert(constructionTasks).values(input).returning(),
      () => new ConstructionTaskExistsError(),
    );
    return row!;
  }

  listConstructionTasks(): Promise<ConstructionTask[]> {
    return this.db.select().from(constructionTasks).orderBy(asc(constructionTasks.code));
  }

  async findConstructionTaskById(id: string): Promise<ConstructionTask | null> {
    const [row] = await this.db
      .select()
      .from(constructionTasks)
      .where(eq(constructionTasks.id, id))
      .limit(1);
    return row ?? null;
  }

  async findConstructionTaskByCode(code: string): Promise<ConstructionTask | null> {
    const [row] = await this.db
      .select()
      .from(constructionTasks)
      .where(eq(constructionTasks.code, code))
      .limit(1);
    return row ?? null;
  }

  async addModelCapability(
    input: { modelId: string; capabilityId: string } & LinkVerification,
  ): Promise<CapabilityLink> {
    await insertOrConflict(
      this.db.insert(equipmentModelCapabilities).values(input),
      () => new LinkExistsError(),
    );
    const links = await this.selectCapabilityLinks(
      equipmentModelCapabilities,
      and(
        eq(equipmentModelCapabilities.modelId, input.modelId),
        eq(equipmentModelCapabilities.capabilityId, input.capabilityId),
      ),
    );
    return links[0]!;
  }

  listModelCapabilities(modelId: string): Promise<CapabilityLink[]> {
    return this.selectCapabilityLinks(
      equipmentModelCapabilities,
      eq(equipmentModelCapabilities.modelId, modelId),
    );
  }

  listCapabilityModels(capabilityId: string): Promise<CapabilityModel[]> {
    return this.db
      .select({ model: modelColumns, ...provenanceColumns(equipmentModelCapabilities) })
      .from(equipmentModelCapabilities)
      .innerJoin(equipmentModels, eq(equipmentModels.id, equipmentModelCapabilities.modelId))
      .innerJoin(manufacturers, eq(manufacturers.id, equipmentModels.manufacturerId))
      .leftJoin(
        specificationSources,
        eq(specificationSources.id, equipmentModelCapabilities.sourceId),
      )
      .where(eq(equipmentModelCapabilities.capabilityId, capabilityId))
      .orderBy(
        sql`lower(${manufacturers.name})`,
        sql`lower(${equipmentModels.modelName})`,
        asc(equipmentModels.id),
      );
  }

  async addCategoryCapability(
    input: { categoryId: string; capabilityId: string } & LinkVerification,
  ): Promise<CapabilityLink> {
    await insertOrConflict(
      this.db.insert(equipmentCategoryCapabilities).values(input),
      () => new LinkExistsError(),
    );
    const links = await this.selectCapabilityLinks(
      equipmentCategoryCapabilities,
      and(
        eq(equipmentCategoryCapabilities.categoryId, input.categoryId),
        eq(equipmentCategoryCapabilities.capabilityId, input.capabilityId),
      ),
    );
    return links[0]!;
  }

  listCategoryCapabilities(categoryId: string): Promise<CapabilityLink[]> {
    return this.selectCapabilityLinks(
      equipmentCategoryCapabilities,
      eq(equipmentCategoryCapabilities.categoryId, categoryId),
    );
  }

  async addTaskCapability(input: {
    taskId: string;
    capabilityId: string;
    importance: CapabilityImportance;
  }): Promise<TaskCapability> {
    await insertOrConflict(
      this.db.insert(constructionTaskCapabilities).values(input),
      () => new LinkExistsError(),
    );
    const capability = await this.db
      .select()
      .from(capabilities)
      .where(eq(capabilities.id, input.capabilityId));
    return { capability: capability[0]!, importance: input.importance };
  }

  listTaskCapabilities(taskId: string): Promise<TaskCapability[]> {
    return this.db
      .select({ capability: capabilities, importance: constructionTaskCapabilities.importance })
      .from(constructionTaskCapabilities)
      .innerJoin(capabilities, eq(capabilities.id, constructionTaskCapabilities.capabilityId))
      .where(eq(constructionTaskCapabilities.taskId, taskId))
      .orderBy(asc(capabilities.code));
  }

  listCapabilityTasks(
    capabilityId: string,
    importance: CapabilityImportance | undefined,
  ): Promise<CapabilityTask[]> {
    return this.db
      .select({ task: constructionTasks, importance: constructionTaskCapabilities.importance })
      .from(constructionTaskCapabilities)
      .innerJoin(constructionTasks, eq(constructionTasks.id, constructionTaskCapabilities.taskId))
      .where(
        and(
          eq(constructionTaskCapabilities.capabilityId, capabilityId),
          importance === undefined
            ? undefined
            : eq(constructionTaskCapabilities.importance, importance),
        ),
      )
      .orderBy(asc(constructionTasks.code));
  }

  async addTaskCategory(input: {
    taskId: string;
    categoryId: string;
    suitability: TaskSuitability;
  }): Promise<TaskCategory> {
    await insertOrConflict(
      this.db.insert(constructionTaskCategories).values(input),
      () => new LinkExistsError(),
    );
    const category = await this.findCategoryById(input.categoryId);
    return { category: category!, suitability: input.suitability };
  }

  listTaskCategories(taskId: string): Promise<TaskCategory[]> {
    return this.db
      .select({
        category: equipmentCategories,
        suitability: constructionTaskCategories.suitability,
      })
      .from(constructionTaskCategories)
      .innerJoin(
        equipmentCategories,
        eq(equipmentCategories.id, constructionTaskCategories.categoryId),
      )
      .where(eq(constructionTaskCategories.taskId, taskId))
      .orderBy(asc(equipmentCategories.code));
  }

  listCategoryTasks(categoryId: string): Promise<CategoryTask[]> {
    return this.db
      .select({ task: constructionTasks, suitability: constructionTaskCategories.suitability })
      .from(constructionTaskCategories)
      .innerJoin(constructionTasks, eq(constructionTasks.id, constructionTaskCategories.taskId))
      .where(eq(constructionTaskCategories.categoryId, categoryId))
      .orderBy(asc(constructionTasks.code));
  }

  private selectCapabilityLinks(
    link: LinkTable,
    where: SQL | undefined,
  ): Promise<CapabilityLink[]> {
    return this.db
      .select({ capability: capabilities, ...provenanceColumns(link) })
      .from(link)
      .innerJoin(capabilities, eq(capabilities.id, link.capabilityId))
      .leftJoin(specificationSources, eq(specificationSources.id, link.sourceId))
      .where(where)
      .orderBy(asc(capabilities.code));
  }
}
