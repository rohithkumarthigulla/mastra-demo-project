import { Inject, Injectable } from '@nestjs/common';
import type {
  AddCapabilityLinkRequest,
  AddTaskCapabilityRequest,
  AddTaskCategoryRequest,
  CapabilityImportance,
  CreateCapabilityRequest,
  CreateConstructionTaskRequest,
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
  CapabilityExistsError,
  CapabilityNotFoundError,
  CategoryExistsError,
  CategoryNotFoundError,
  ConstructionTaskExistsError,
  ConstructionTaskNotFoundError,
  convert,
  DefinitionExistsError,
  DefinitionNotFoundError,
  EQUIPMENT_KNOWLEDGE_REPOSITORY,
  ManufacturerExistsError,
  ManufacturerNotFoundError,
  ModelExistsError,
  ModelNotFoundError,
  NonNumericSpecificationError,
  resolveLinkVerification,
  resolveSpecificationValue,
  resolveVerification,
  SourceNotFoundError,
  SpecificationNotFoundError,
  UnknownSpecificationCodeError,
  type Capability,
  type CapabilityLink,
  type CapabilityModel,
  type CapabilityTask,
  type CategoryTask,
  type ConstructionTask,
  type SpecConstraint,
  type EquipmentCategory,
  type EquipmentKnowledgeRepository,
  type EquipmentModel,
  type EquipmentModelDetail,
  type EquipmentSpecification,
  type Manufacturer,
  type SpecificationDefinition,
  type SpecificationSource,
  type TaskCapability,
  type TaskCategory,
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

  /**
   * An unknown category matches nothing. An unknown spec code, a TEXT definition or a unit
   * from another dimension is a client error rather than an empty result.
   */
  async searchModels(
    query: ListEquipmentModelsQuery,
  ): Promise<{ items: EquipmentModel[]; total: number }> {
    const specs: SpecConstraint[] = [];
    for (const filter of query.spec) {
      const definition = await this.repo.findDefinitionByCode(filter.code);
      if (!definition) throw new UnknownSpecificationCodeError(filter.code);
      if (definition.canonicalUnit === null) throw new NonNumericSpecificationError(filter.code);
      specs.push({
        definitionId: definition.id,
        bound: filter.bound,
        value: convert(filter.value, filter.unit, definition.canonicalUnit),
      });
    }

    let categoryId: string | undefined;
    if (query.category !== undefined) {
      const category = await this.repo.findCategoryByCode(query.category);
      if (!category) return { items: [], total: 0 };
      categoryId = category.id;
    }

    return this.repo.searchModels({
      categoryId,
      manufacturer: query.manufacturer,
      model: query.model,
      status: query.status,
      specs,
      verificationStatus: query.verificationStatus,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async getModel(id: string): Promise<EquipmentModelDetail> {
    const model = await this.repo.findModelById(id);
    if (!model) throw new ModelNotFoundError();
    const [specifications, capabilities] = await Promise.all([
      this.repo.listSpecifications(id),
      this.repo.listModelCapabilities(id),
    ]);
    return { ...model, specifications, capabilities };
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

  listCapabilities(): Promise<Capability[]> {
    return this.repo.listCapabilities();
  }

  async createCapability(input: CreateCapabilityRequest): Promise<Capability> {
    if (await this.repo.findCapabilityByCode(input.code)) throw new CapabilityExistsError();
    return this.repo.createCapability(input);
  }

  findCapabilityByCode(code: string): Promise<Capability | null> {
    return this.repo.findCapabilityByCode(code);
  }

  getCapability(code: string): Promise<Capability> {
    return this.requireCapability(code);
  }

  /** Only models linked directly; a category link says nothing about its models. */
  async listCapabilityModels(code: string): Promise<CapabilityModel[]> {
    const capability = await this.requireCapability(code);
    return this.repo.listCapabilityModels(capability.id);
  }

  async listCapabilityTasks(
    code: string,
    importance: CapabilityImportance | undefined,
  ): Promise<CapabilityTask[]> {
    const capability = await this.requireCapability(code);
    return this.repo.listCapabilityTasks(capability.id, importance);
  }

  listConstructionTasks(): Promise<ConstructionTask[]> {
    return this.repo.listConstructionTasks();
  }

  async createConstructionTask(input: CreateConstructionTaskRequest): Promise<ConstructionTask> {
    if (await this.repo.findConstructionTaskByCode(input.code)) {
      throw new ConstructionTaskExistsError();
    }
    return this.repo.createConstructionTask(input);
  }

  findConstructionTaskByCode(code: string): Promise<ConstructionTask | null> {
    return this.repo.findConstructionTaskByCode(code);
  }

  getConstructionTask(id: string): Promise<ConstructionTask> {
    return this.requireTask(id);
  }

  async addTaskCapability(
    taskId: string,
    input: AddTaskCapabilityRequest,
  ): Promise<TaskCapability> {
    await this.requireTask(taskId);
    const capability = await this.requireCapability(input.capabilityCode);
    return this.repo.addTaskCapability({
      taskId,
      capabilityId: capability.id,
      importance: input.importance,
    });
  }

  async listTaskCapabilities(taskId: string): Promise<TaskCapability[]> {
    await this.requireTask(taskId);
    return this.repo.listTaskCapabilities(taskId);
  }

  async addTaskCategory(taskId: string, input: AddTaskCategoryRequest): Promise<TaskCategory> {
    await this.requireTask(taskId);
    const category = await this.repo.findCategoryByCode(input.categoryCode);
    if (!category) throw new CategoryNotFoundError();
    return this.repo.addTaskCategory({
      taskId,
      categoryId: category.id,
      suitability: input.suitability,
    });
  }

  async listTaskCategories(taskId: string): Promise<TaskCategory[]> {
    await this.requireTask(taskId);
    return this.repo.listTaskCategories(taskId);
  }

  async addModelCapability(
    modelId: string,
    input: AddCapabilityLinkRequest,
  ): Promise<CapabilityLink> {
    if (!(await this.repo.findModelById(modelId))) throw new ModelNotFoundError();
    const capability = await this.requireCapability(input.capabilityCode);
    return this.repo.addModelCapability({
      modelId,
      capabilityId: capability.id,
      ...(await this.resolveLink(input)),
    });
  }

  async listModelCapabilities(modelId: string): Promise<CapabilityLink[]> {
    if (!(await this.repo.findModelById(modelId))) throw new ModelNotFoundError();
    return this.repo.listModelCapabilities(modelId);
  }

  async addCategoryCapability(
    categoryId: string,
    input: AddCapabilityLinkRequest,
  ): Promise<CapabilityLink> {
    if (!(await this.repo.findCategoryById(categoryId))) throw new CategoryNotFoundError();
    const capability = await this.requireCapability(input.capabilityCode);
    return this.repo.addCategoryCapability({
      categoryId,
      capabilityId: capability.id,
      ...(await this.resolveLink(input)),
    });
  }

  async listCategoryCapabilities(categoryId: string): Promise<CapabilityLink[]> {
    if (!(await this.repo.findCategoryById(categoryId))) throw new CategoryNotFoundError();
    return this.repo.listCategoryCapabilities(categoryId);
  }

  async listCategoryTasks(categoryId: string): Promise<CategoryTask[]> {
    if (!(await this.repo.findCategoryById(categoryId))) throw new CategoryNotFoundError();
    return this.repo.listCategoryTasks(categoryId);
  }

  private async resolveLink(input: AddCapabilityLinkRequest) {
    return resolveLinkVerification({
      requested: input.verificationStatus,
      source: await this.findSource(input.sourceId ?? null),
      now: this.clock.now(),
    });
  }

  private async requireCapability(code: string): Promise<Capability> {
    const capability = await this.repo.findCapabilityByCode(code);
    if (!capability) throw new CapabilityNotFoundError();
    return capability;
  }

  private async requireTask(id: string): Promise<ConstructionTask> {
    const task = await this.repo.findConstructionTaskById(id);
    if (!task) throw new ConstructionTaskNotFoundError();
    return task;
  }

  private async findSource(id: string | null): Promise<SpecificationSource | null> {
    if (id === null) return null;
    const source = await this.repo.findSourceById(id);
    if (!source) throw new SourceNotFoundError();
    return source;
  }
}
