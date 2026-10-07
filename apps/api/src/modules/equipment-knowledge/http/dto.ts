import type {
  EquipmentCategoryDto,
  EquipmentModelDetailDto,
  EquipmentModelDto,
  EquipmentSpecificationDto,
  ManufacturerDto,
  SpecificationDefinitionDto,
} from '@ee/contracts';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http';
import type {
  EquipmentCategory,
  EquipmentModel,
  EquipmentModelDetail,
  EquipmentSpecification,
  Manufacturer,
  SpecificationDefinition,
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
    ...timestamps(row),
  };
}

export function modelDetailToDto(row: EquipmentModelDetail): EquipmentModelDetailDto {
  return { ...modelToDto(row), specifications: row.specifications.map(specificationToDto) };
}
