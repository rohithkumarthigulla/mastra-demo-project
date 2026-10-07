import type {
  EquipmentModelStatus,
  SpecificationSourceType,
  SpecificationValueType,
  Unit,
  VerificationStatus,
} from '@ee/contracts';

export type {
  EquipmentModelStatus,
  SpecificationSourceType,
  SpecificationValueType,
  VerificationStatus,
};

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

export interface SpecificationSource {
  id: string;
  sourceType: SpecificationSourceType;
  sourceName: string;
  referenceUrl: string | null;
  documentName: string | null;
  /** Calendar date (YYYY-MM-DD). */
  retrievedAt: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SpecificationSourceSummary = Pick<
  SpecificationSource,
  'id' | 'sourceType' | 'sourceName' | 'referenceUrl'
>;

export interface SpecificationVerification {
  verificationStatus: VerificationStatus;
  sourceId: string | null;
  /** Set only while VERIFIED. */
  verifiedAt: Date | null;
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

export interface EquipmentSpecification extends SpecificationValue, SpecificationVerification {
  id: string;
  modelId: string;
  definitionId: string;
  definitionCode: string;
  source: SpecificationSourceSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EquipmentModelDetail extends EquipmentModel {
  specifications: EquipmentSpecification[];
}
