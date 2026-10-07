import type { Unit } from '@ee/contracts';
import type {
  Capability,
  CapabilityImportance,
  CapabilityLink,
  CapabilityModel,
  CapabilityTask,
  CategoryTask,
  ConstructionTask,
  EquipmentCategory,
  EquipmentModel,
  EquipmentModelStatus,
  EquipmentSpecification,
  Manufacturer,
  SpecificationDefinition,
  SpecificationSource,
  SpecificationValue,
  SpecificationValueType,
  LinkVerification,
  SpecificationVerification,
  TaskCapability,
  TaskCategory,
  TaskSuitability,
  VerificationStatus,
} from './entities';

/**
 * A model matches a spec constraint when it has a specification for the definition whose
 * normalized range reaches the bound (`min`: normalizedMax >= value, `max`: normalizedMin <= value).
 * Values are in the definition's canonical unit. Rows without normalized values never match.
 */
export interface SpecConstraint {
  definitionId: string;
  bound: 'min' | 'max';
  value: number;
}

export interface ModelSearchCriteria {
  categoryId?: string;
  /** Exact manufacturer name, case-insensitive. */
  manufacturer?: string;
  /** Case-insensitive substring of model name or model code. */
  model?: string;
  status: EquipmentModelStatus;
  specs: SpecConstraint[];
  /** Restricts which specifications can satisfy `specs`. */
  verificationStatus?: VerificationStatus;
  limit: number;
  offset: number;
}

export const EQUIPMENT_KNOWLEDGE_REPOSITORY = Symbol('EQUIPMENT_KNOWLEDGE_REPOSITORY');

export interface EquipmentKnowledgeRepository {
  /** Throws `CategoryExistsError` on a duplicate code. */
  createCategory(input: { code: string; displayName: string }): Promise<EquipmentCategory>;
  listCategories(): Promise<EquipmentCategory[]>;
  findCategoryById(id: string): Promise<EquipmentCategory | null>;
  findCategoryByCode(code: string): Promise<EquipmentCategory | null>;

  createSource(
    input: Omit<SpecificationSource, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SpecificationSource>;
  /** Ordered by source type, source name, id. */
  listSources(): Promise<SpecificationSource[]>;
  findSourceById(id: string): Promise<SpecificationSource | null>;

  /** Throws `ManufacturerExistsError` on a case-insensitive duplicate name. */
  createManufacturer(input: { name: string }): Promise<Manufacturer>;
  listManufacturers(): Promise<Manufacturer[]>;
  findManufacturerById(id: string): Promise<Manufacturer | null>;
  findManufacturerByName(name: string): Promise<Manufacturer | null>;

  /** Throws `DefinitionExistsError` on a duplicate code. */
  createDefinition(input: {
    code: string;
    displayName: string;
    valueType: SpecificationValueType;
    canonicalUnit: Unit | null;
  }): Promise<SpecificationDefinition>;
  listDefinitions(): Promise<SpecificationDefinition[]>;
  findDefinitionByCode(code: string): Promise<SpecificationDefinition | null>;

  /** Throws `ModelExistsError` on a case-insensitive duplicate name for the manufacturer. */
  createModel(input: {
    manufacturerId: string;
    categoryId: string;
    modelName: string;
    modelCode: string | null;
    status: EquipmentModelStatus;
  }): Promise<EquipmentModel>;
  /** Ordered by manufacturer name, model name, id. */
  searchModels(criteria: ModelSearchCriteria): Promise<{
    items: EquipmentModel[];
    total: number;
  }>;
  findModelById(id: string): Promise<EquipmentModel | null>;
  findModelByName(manufacturerId: string, modelName: string): Promise<EquipmentModel | null>;

  /** Throws `SpecificationExistsError` if the model already has this definition. */
  createSpecification(
    input: { modelId: string; definitionId: string } & SpecificationValue &
      SpecificationVerification,
  ): Promise<EquipmentSpecification>;
  findSpecification(
    modelId: string,
    specificationId: string,
  ): Promise<EquipmentSpecification | null>;
  updateSpecification(
    specificationId: string,
    value: SpecificationValue & SpecificationVerification,
    updatedAt: Date,
  ): Promise<EquipmentSpecification | null>;
  /** Ordered by definition code. */
  listSpecifications(modelId: string): Promise<EquipmentSpecification[]>;

  /** Throws `CapabilityExistsError` on a duplicate code. */
  createCapability(input: { code: string; displayName: string }): Promise<Capability>;
  /** Ordered by code. */
  listCapabilities(): Promise<Capability[]>;
  findCapabilityByCode(code: string): Promise<Capability | null>;

  /** Throws `ConstructionTaskExistsError` on a duplicate code. */
  createConstructionTask(input: { code: string; displayName: string }): Promise<ConstructionTask>;
  /** Ordered by code. */
  listConstructionTasks(): Promise<ConstructionTask[]>;
  findConstructionTaskById(id: string): Promise<ConstructionTask | null>;
  findConstructionTaskByCode(code: string): Promise<ConstructionTask | null>;

  // Each link is unique per pair; adding an existing pair throws `LinkExistsError`.
  // Link lists are ordered by the code (or model ordering) of the other side.

  addModelCapability(
    input: { modelId: string; capabilityId: string } & LinkVerification,
  ): Promise<CapabilityLink>;
  listModelCapabilities(modelId: string): Promise<CapabilityLink[]>;
  /** Models linked directly to the capability; category links are not considered. */
  listCapabilityModels(capabilityId: string): Promise<CapabilityModel[]>;

  addCategoryCapability(
    input: { categoryId: string; capabilityId: string } & LinkVerification,
  ): Promise<CapabilityLink>;
  listCategoryCapabilities(categoryId: string): Promise<CapabilityLink[]>;

  addTaskCapability(input: {
    taskId: string;
    capabilityId: string;
    importance: CapabilityImportance;
  }): Promise<TaskCapability>;
  listTaskCapabilities(taskId: string): Promise<TaskCapability[]>;
  listCapabilityTasks(
    capabilityId: string,
    importance: CapabilityImportance | undefined,
  ): Promise<CapabilityTask[]>;

  addTaskCategory(input: {
    taskId: string;
    categoryId: string;
    suitability: TaskSuitability;
  }): Promise<TaskCategory>;
  listTaskCategories(taskId: string): Promise<TaskCategory[]>;
  listCategoryTasks(categoryId: string): Promise<CategoryTask[]>;
}
