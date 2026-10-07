export type {
  EquipmentCategory,
  EquipmentModel,
  EquipmentModelDetail,
  EquipmentModelStatus,
  EquipmentSpecification,
  Manufacturer,
  SpecificationDefinition,
  SpecificationValue,
  SpecificationValueType,
} from './entities';
export * from './errors';
export { EQUIPMENT_KNOWLEDGE_REPOSITORY, type EquipmentKnowledgeRepository } from './repository';
export { resolveSpecificationValue, type SpecificationValueInput } from './specification-value';
export { convert, dimensionOf, roundNormalized, type Dimension, type Unit } from './units';
