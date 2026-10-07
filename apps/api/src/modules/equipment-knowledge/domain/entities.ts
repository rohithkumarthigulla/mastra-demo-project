import type { EquipmentModelStatus, SpecificationValueType, Unit } from '@ee/contracts';

export type { EquipmentModelStatus, SpecificationValueType };

export interface EquipmentCategory {
  id: string;
  code: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Manufacturer {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecificationDefinition {
  id: string;
  code: string;
  displayName: string;
  valueType: SpecificationValueType;
  /** Set for NUMERIC definitions, null for TEXT. Never changes once set. */
  canonicalUnit: Unit | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentModel {
  id: string;
  manufacturerId: string;
  categoryId: string;
  modelName: string;
  modelCode: string | null;
  status: EquipmentModelStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecificationValue {
  numericValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  unit: Unit | null;
  textValue: string | null;
  normalizedMin: number | null;
  normalizedMax: number | null;
}

export interface EquipmentSpecification extends SpecificationValue {
  id: string;
  modelId: string;
  definitionId: string;
  definitionCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentModelDetail extends EquipmentModel {
  specifications: EquipmentSpecification[];
}
