import type {
  CapabilityDto,
  CapabilityLinkDto,
  CapabilityModelDto,
  CapabilityTaskDto,
  CategoryTaskDto,
  ConstructionTaskDto,
  EquipmentCategoryDto,
  EquipmentModelDetailDto,
  EquipmentModelDto,
  EquipmentSpecificationDto,
  ManufacturerDto,
  SpecificationDefinitionDto,
  SpecificationSourceDto,
  TaskCapabilityDto,
  TaskCategoryDto,
} from '@ee/contracts';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http';
import type {
  Capability,
  CapabilityLink,
  CapabilityModel,
  CapabilityTask,
  CategoryTask,
  ConstructionTask,
  EquipmentCategory,
  EquipmentModel,
  EquipmentModelDetail,
  EquipmentSpecification,
  Manufacturer,
  SpecificationDefinition,
  SpecificationSource,
  TaskCapability,
  TaskCategory,
} from '../domain';

/** Rejects malformed ids with 400 before they reach Postgres's uuid parser. */
export const uuidPipe = new ZodValidationPipe(z.uuid());

const timestamps = (row: { createdAt: Date; updatedAt: Date }) => ({
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export function categoryToDto(row: EquipmentCategory): EquipmentCategoryDto {
  return { id: row.id, code: row.code, displayName: row.displayName, ...timestamps(row) };
}

export function manufacturerToDto(row: Manufacturer): ManufacturerDto {
  return { id: row.id, name: row.name, ...timestamps(row) };
}

export function definitionToDto(row: SpecificationDefinition): SpecificationDefinitionDto {
  return {
    id: row.id,
    code: row.code,
    displayName: row.displayName,
    valueType: row.valueType,
    canonicalUnit: row.canonicalUnit,
    ...timestamps(row),
  };
}

export function sourceToDto(row: SpecificationSource): SpecificationSourceDto {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceName: row.sourceName,
    referenceUrl: row.referenceUrl,
    documentName: row.documentName,
    retrievedAt: row.retrievedAt,
    notes: row.notes,
    ...timestamps(row),
  };
}

export function modelToDto(row: EquipmentModel): EquipmentModelDto {
  return {
    id: row.id,
    manufacturerId: row.manufacturerId,
    categoryId: row.categoryId,
    modelName: row.modelName,
    modelCode: row.modelCode,
    status: row.status,
    ...timestamps(row),
  };
}

export function specificationToDto(row: EquipmentSpecification): EquipmentSpecificationDto {
  return {
    id: row.id,
    modelId: row.modelId,
    definitionCode: row.definitionCode,
    numericValue: row.numericValue,
    minValue: row.minValue,
    maxValue: row.maxValue,
    unit: row.unit,
    textValue: row.textValue,
    normalizedMin: row.normalizedMin,
    normalizedMax: row.normalizedMax,
    verificationStatus: row.verificationStatus,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    source: row.source && {
      id: row.source.id,
      sourceType: row.source.sourceType,
      sourceName: row.source.sourceName,
      referenceUrl: row.source.referenceUrl,
    },
    ...timestamps(row),
  };
}

export function modelDetailToDto(row: EquipmentModelDetail): EquipmentModelDetailDto {
  return {
    ...modelToDto(row),
    specifications: row.specifications.map(specificationToDto),
    capabilities: row.capabilities.map(capabilityLinkToDto),
  };
}

export function capabilityToDto(row: Capability): CapabilityDto {
  return { id: row.id, code: row.code, displayName: row.displayName, ...timestamps(row) };
}

export function constructionTaskToDto(row: ConstructionTask): ConstructionTaskDto {
  return { id: row.id, code: row.code, displayName: row.displayName, ...timestamps(row) };
}

const provenanceToDto = (row: CapabilityLink | CapabilityModel) => ({
  verificationStatus: row.verificationStatus,
  verifiedAt: row.verifiedAt?.toISOString() ?? null,
  source: row.source && {
    id: row.source.id,
    sourceType: row.source.sourceType,
    sourceName: row.source.sourceName,
    referenceUrl: row.source.referenceUrl,
  },
});

export function capabilityLinkToDto(row: CapabilityLink): CapabilityLinkDto {
  return { capability: capabilityToDto(row.capability), ...provenanceToDto(row) };
}

export function capabilityModelToDto(row: CapabilityModel): CapabilityModelDto {
  return { model: modelToDto(row.model), ...provenanceToDto(row) };
}

export function taskCapabilityToDto(row: TaskCapability): TaskCapabilityDto {
  return { capability: capabilityToDto(row.capability), importance: row.importance };
}

export function capabilityTaskToDto(row: CapabilityTask): CapabilityTaskDto {
  return { task: constructionTaskToDto(row.task), importance: row.importance };
}

export function taskCategoryToDto(row: TaskCategory): TaskCategoryDto {
  return { category: categoryToDto(row.category), suitability: row.suitability };
}

export function categoryTaskToDto(row: CategoryTask): CategoryTaskDto {
  return { task: constructionTaskToDto(row.task), suitability: row.suitability };
}
