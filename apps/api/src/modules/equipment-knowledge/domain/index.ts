export type {
  EquipmentCategory,
  EquipmentModel,
  EquipmentModelDetail,
  EquipmentModelStatus,
  EquipmentSpecification,
  Manufacturer,
  SpecificationDefinition,
  SpecificationSource,
  SpecificationSourceSummary,
  SpecificationSourceType,
  SpecificationValue,
  SpecificationValueType,
  SpecificationVerification,
  VerificationStatus,
} from './entities';
export * from './errors';
export {
  EQUIPMENT_KNOWLEDGE_REPOSITORY,
  type EquipmentKnowledgeRepository,
  type ModelSearchCriteria,
  type SpecConstraint,
} from './repository';
export { resolveSpecificationValue, type SpecificationValueInput } from './specification-value';
export { convert, dimensionOf, roundNormalized, type Dimension, type Unit } from './units';
export { hasSpecificationValue, resolveVerification, type VerificationInput } from './verification';
