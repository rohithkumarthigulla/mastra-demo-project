export type {
  Capability,
  CapabilityImportance,
  CapabilityLink,
  CapabilityModel,
  CapabilityTask,
  CategoryTask,
  ConstructionTask,
  EquipmentCategory,
  EquipmentModel,
  EquipmentModelDetail,
  EquipmentModelStatus,
  EquipmentSpecification,
  LinkVerification,
  LinkVerificationStatus,
  Manufacturer,
  SpecificationDefinition,
  SpecificationSource,
  SpecificationSourceSummary,
  SpecificationSourceType,
  SpecificationValue,
  SpecificationValueType,
  SpecificationVerification,
  TaskCapability,
  TaskCategory,
  TaskSuitability,
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
export {
  hasSpecificationValue,
  resolveLinkVerification,
  resolveVerification,
  type VerificationInput,
} from './verification';
