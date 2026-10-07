import type { Unit } from '@ee/contracts';
import type {
  EquipmentCategory,
  EquipmentModel,
  EquipmentModelStatus,
  EquipmentSpecification,
  Manufacturer,
  SpecificationDefinition,
  SpecificationSource,
  SpecificationValue,
  SpecificationValueType,
  SpecificationVerification,
} from './entities';

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
  listModels(page: { limit: number; offset: number }): Promise<{
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
}
