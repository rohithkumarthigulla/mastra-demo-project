import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateEquipmentCategoryRequest,
  CreateEquipmentModelRequest,
  CreateEquipmentSpecificationRequest,
  CreateManufacturerRequest,
  CreateSpecificationDefinitionRequest,
  CreateSpecificationSourceRequest,
  ListEquipmentModelsQuery,
  UpdateEquipmentSpecificationRequest,
} from '@ee/contracts';
import { CLOCK, type Clock } from '../../../platform/auth';
import {
  CategoryExistsError,
  CategoryNotFoundError,
  DefinitionExistsError,
  DefinitionNotFoundError,
  EQUIPMENT_KNOWLEDGE_REPOSITORY,
  ManufacturerExistsError,
  ManufacturerNotFoundError,
  ModelExistsError,
  ModelNotFoundError,
  resolveSpecificationValue,
  resolveVerification,
  SourceNotFoundError,
  SpecificationNotFoundError,
  type EquipmentCategory,
  type EquipmentKnowledgeRepository,
  type EquipmentModel,
  type EquipmentModelDetail,
  type EquipmentSpecification,
  type Manufacturer,
  type SpecificationDefinition,
  type SpecificationSource,
} from '../domain';

const VALUE_KEYS = ['numericValue', 'minValue', 'maxValue', 'unit', 'textValue'] as const;

/** Pre-checks give clean 404/409s; the database constraints still cover concurrent writes. */
@Injectable()
export class EquipmentKnowledgeService {
  constructor(
    @Inject(EQUIPMENT_KNOWLEDGE_REPOSITORY) private readonly repo: EquipmentKnowledgeRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  listCategories(): Promise<EquipmentCategory[]> {
    return this.repo.listCategories();
  }

  async createCategory(input: CreateEquipmentCategoryRequest): Promise<EquipmentCategory> {
    if (await this.repo.findCategoryByCode(input.code)) throw new CategoryExistsError();
    return this.repo.createCategory(input);
  }

  findCategoryByCode(code: string): Promise<EquipmentCategory | null> {
    return this.repo.findCategoryByCode(code);
  }

  listManufacturers(): Promise<Manufacturer[]> {
    return this.repo.listManufacturers();
  }

  async createManufacturer(input: CreateManufacturerRequest): Promise<Manufacturer> {
    if (await this.repo.findManufacturerByName(input.name)) throw new ManufacturerExistsError();
    return this.repo.createManufacturer(input);
  }

  findManufacturerByName(name: string): Promise<Manufacturer | null> {
    return this.repo.findManufacturerByName(name);
  }

  listDefinitions(): Promise<SpecificationDefinition[]> {
    return this.repo.listDefinitions();
  }

  async createDefinition(
    input: CreateSpecificationDefinitionRequest,
  ): Promise<SpecificationDefinition> {
    if (await this.repo.findDefinitionByCode(input.code)) throw new DefinitionExistsError();
    return this.repo.createDefinition({
      code: input.code,
      displayName: input.displayName,
      valueType: input.valueType,
      canonicalUnit: input.canonicalUnit ?? null,
    });
  }

  findDefinitionByCode(code: string): Promise<SpecificationDefinition | null> {
    return this.repo.findDefinitionByCode(code);
  }

  listSources(): Promise<SpecificationSource[]> {
    return this.repo.listSources();
  }

  createSource(input: CreateSpecificationSourceRequest): Promise<SpecificationSource> {
    return this.repo.createSource({
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      referenceUrl: input.referenceUrl ?? null,
      documentName: input.documentName ?? null,
      retrievedAt: input.retrievedAt ?? null,
      notes: input.notes ?? null,
    });
  }

  listModels(page: ListEquipmentModelsQuery): Promise<{ items: EquipmentModel[]; total: number }> {
    return this.repo.listModels(page);
  }

  async getModel(id: string): Promise<EquipmentModelDetail> {
    const model = await this.repo.findModelById(id);
    if (!model) throw new ModelNotFoundError();
    return { ...model, specifications: await this.repo.listSpecifications(id) };
  }

  async createModel(input: CreateEquipmentModelRequest): Promise<EquipmentModel> {
    if (!(await this.repo.findManufacturerById(input.manufacturerId))) {
      throw new ManufacturerNotFoundError();
    }
    if (!(await this.repo.findCategoryById(input.categoryId))) throw new CategoryNotFoundError();
    if (await this.repo.findModelByName(input.manufacturerId, input.modelName)) {
      throw new ModelExistsError();
    }
    return this.repo.createModel({
      manufacturerId: input.manufacturerId,
      categoryId: input.categoryId,
      modelName: input.modelName,
      modelCode: input.modelCode ?? null,
      status: input.status ?? 'ACTIVE',
    });
  }

  findModelByName(manufacturerId: string, modelName: string): Promise<EquipmentModel | null> {
    return this.repo.findModelByName(manufacturerId, modelName);
  }

  async addSpecification(
    modelId: string,
    input: CreateEquipmentSpecificationRequest,
  ): Promise<EquipmentSpecification> {
    if (!(await this.repo.findModelById(modelId))) throw new ModelNotFoundError();
    const definition = await this.repo.findDefinitionByCode(input.definitionCode);
    if (!definition) throw new DefinitionNotFoundError();
    const value = resolveSpecificationValue(definition, input);
    const verification = resolveVerification({
      value,
      requested: input.verificationStatus,
      source: await this.findSource(input.sourceId ?? null),
      current: null,
      valueChanged: true,
      now: this.clock.now(),
    });
    return this.repo.createSpecification({
      modelId,
      definitionId: definition.id,
      ...value,
      ...verification,
    });
  }

  /**
   * Provided keys replace the stored value (null clears it); omitted keys are kept.
   * Changing the value without sending a status re-defaults it (REVIEW_REQUIRED or UNKNOWN).
   */
  async updateSpecification(
    modelId: string,
    specificationId: string,
    patch: UpdateEquipmentSpecificationRequest,
  ): Promise<EquipmentSpecification> {
    const current = await this.repo.findSpecification(modelId, specificationId);
    if (!current) throw new SpecificationNotFoundError();
    const definition = await this.repo.findDefinitionByCode(current.definitionCode);
    if (!definition) throw new DefinitionNotFoundError();

    const merged = {
      numericValue: current.numericValue,
      minValue: current.minValue,
      maxValue: current.maxValue,
      unit: current.unit,
      textValue: current.textValue,
    };
    for (const key of VALUE_KEYS) {
      if (patch[key] !== undefined) Object.assign(merged, { [key]: patch[key] });
    }

    const value = resolveSpecificationValue(definition, merged);
    const now = this.clock.now();
    const verification = resolveVerification({
      value,
      requested: patch.verificationStatus,
      source: await this.findSource(
        patch.sourceId === undefined ? current.sourceId : patch.sourceId,
      ),
      current,
      valueChanged: VALUE_KEYS.some((key) => value[key] !== current[key]),
      now,
    });
    const updated = await this.repo.updateSpecification(
      specificationId,
      { ...value, ...verification },
      now,
    );
    if (!updated) throw new SpecificationNotFoundError();
    return updated;
  }

  private async findSource(id: string | null): Promise<SpecificationSource | null> {
    if (id === null) return null;
    const source = await this.repo.findSourceById(id);
    if (!source) throw new SourceNotFoundError();
    return source;
  }
}
