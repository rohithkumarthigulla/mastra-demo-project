import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, exists, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { DB, isUniqueViolation, type Database } from '../../../platform/database';
import {
  equipmentCategories,
  equipmentModels,
  equipmentSpecifications,
  manufacturers,
  specificationDefinitions,
  specificationSources,
} from '../../../platform/database/schema';
import {
  CategoryExistsError,
  DefinitionExistsError,
  ManufacturerExistsError,
  ModelExistsError,
  SpecificationExistsError,
  type EquipmentCategory,
  type EquipmentKnowledgeRepository,
  type EquipmentModel,
  type EquipmentModelStatus,
  type EquipmentSpecification,
  type Manufacturer,
  type ModelSearchCriteria,
  type SpecificationDefinition,
  type SpecificationSource,
  type SpecificationValue,
  type SpecificationValueType,
  type SpecificationVerification,
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
}
