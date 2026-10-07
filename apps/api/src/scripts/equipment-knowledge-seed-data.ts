import type {
  CreateEquipmentCategoryRequest,
  CreateEquipmentSpecificationRequest,
  CreateSpecificationDefinitionRequest,
} from '@ee/contracts';

/**
 * Reference data for local development and demos. Specification values are
 * illustrative round numbers chosen to exercise every value shape and unit —
 * they are NOT manufacturer data and must not be shown to users as such.
 */

export const seedCategories: CreateEquipmentCategoryRequest[] = [
  { code: 'EXCAVATOR', displayName: 'Excavator' },
  { code: 'MINI_EXCAVATOR', displayName: 'Mini excavator' },
  { code: 'WHEEL_LOADER', displayName: 'Wheel loader' },
  { code: 'BACKHOE_LOADER', displayName: 'Backhoe loader' },
  { code: 'TELEHANDLER', displayName: 'Telehandler' },
  { code: 'ROLLER', displayName: 'Roller' },
];

export const seedManufacturers = [
  'Bobcat',
  'Caterpillar',
  'Doosan',
  'Hitachi',
  'JCB',
  'Komatsu',
  'Liebherr',
  'Volvo',
];

export const seedDefinitions: CreateSpecificationDefinitionRequest[] = [
  {
    code: 'OPERATING_WEIGHT',
    displayName: 'Operating weight',
    valueType: 'NUMERIC',
    canonicalUnit: 't',
  },
  { code: 'ENGINE_POWER', displayName: 'Engine power', valueType: 'NUMERIC', canonicalUnit: 'kW' },
  {
    code: 'MAX_DIGGING_DEPTH',
    displayName: 'Maximum digging depth',
    valueType: 'NUMERIC',
    canonicalUnit: 'm',
  },
  { code: 'MAX_REACH', displayName: 'Maximum reach', valueType: 'NUMERIC', canonicalUnit: 'm' },
  {
    code: 'MAX_LIFT_HEIGHT',
    displayName: 'Maximum lift height',
    valueType: 'NUMERIC',
    canonicalUnit: 'm',
  },
  {
    code: 'LIFT_CAPACITY',
    displayName: 'Lift capacity',
    valueType: 'NUMERIC',
    canonicalUnit: 'kg',
  },
  {
    code: 'BUCKET_CAPACITY',
    displayName: 'Bucket capacity',
    valueType: 'NUMERIC',
    canonicalUnit: 'm3',
  },
  { code: 'DRUM_WIDTH', displayName: 'Drum width', valueType: 'NUMERIC', canonicalUnit: 'm' },
  {
    code: 'TRANSPORT_LENGTH',
    displayName: 'Transport length',
    valueType: 'NUMERIC',
    canonicalUnit: 'm',
  },
  { code: 'ENGINE_MODEL', displayName: 'Engine model', valueType: 'TEXT' },
];

export interface SeedModel {
  manufacturer: string;
  category: string;
  modelName: string;
  specifications: CreateEquipmentSpecificationRequest[];
}

export const seedModels: SeedModel[] = [
  {
    manufacturer: 'Caterpillar',
    category: 'EXCAVATOR',
    modelName: '320',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 22, unit: 't' },
      { definitionCode: 'ENGINE_POWER', numericValue: 120, unit: 'kW' },
      { definitionCode: 'MAX_DIGGING_DEPTH', numericValue: 6700, unit: 'mm' },
      { definitionCode: 'BUCKET_CAPACITY', minValue: 0.5, maxValue: 1.5, unit: 'm3' },
    ],
  },
  {
    manufacturer: 'Komatsu',
    category: 'EXCAVATOR',
    modelName: 'PC210',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 21000, unit: 'kg' },
      { definitionCode: 'ENGINE_POWER', numericValue: 165, unit: 'hp' },
      { definitionCode: 'MAX_REACH', numericValue: 10, unit: 'm' },
    ],
  },
  {
    manufacturer: 'Volvo',
    category: 'EXCAVATOR',
    modelName: 'EC220',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', minValue: 22, maxValue: 25, unit: 't' },
      { definitionCode: 'MAX_DIGGING_DEPTH', numericValue: 6.5, unit: 'm' },
      { definitionCode: 'ENGINE_MODEL', textValue: 'Illustrative diesel D6' },
    ],
  },
  {
    manufacturer: 'Hitachi',
    category: 'EXCAVATOR',
    modelName: 'ZX210',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 21, unit: 't' },
      { definitionCode: 'BUCKET_CAPACITY', numericValue: 1, unit: 'm3' },
      // Deliberately unknown: exercises the empty shape.
      { definitionCode: 'MAX_REACH' },
    ],
  },
  {
    manufacturer: 'Liebherr',
    category: 'EXCAVATOR',
    modelName: 'R 920',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 20, unit: 't' },
      { definitionCode: 'ENGINE_POWER', numericValue: 110, unit: 'kW' },
    ],
  },
  {
    manufacturer: 'Bobcat',
    category: 'MINI_EXCAVATOR',
    modelName: 'E35',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 3500, unit: 'kg' },
      { definitionCode: 'MAX_DIGGING_DEPTH', numericValue: 3000, unit: 'mm' },
      { definitionCode: 'ENGINE_POWER', numericValue: 25, unit: 'hp' },
    ],
  },
  {
    manufacturer: 'JCB',
    category: 'MINI_EXCAVATOR',
    modelName: '8030',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 3, unit: 't' },
      { definitionCode: 'MAX_DIGGING_DEPTH', numericValue: 2.8, unit: 'm' },
    ],
  },
  {
    manufacturer: 'Doosan',
    category: 'MINI_EXCAVATOR',
    modelName: 'DX27',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 2700, unit: 'kg' },
      { definitionCode: 'TRANSPORT_LENGTH', numericValue: 4500, unit: 'mm' },
    ],
  },
  {
    manufacturer: 'Caterpillar',
    category: 'WHEEL_LOADER',
    modelName: '950',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 19, unit: 't' },
      { definitionCode: 'BUCKET_CAPACITY', minValue: 3, maxValue: 4, unit: 'm3' },
      { definitionCode: 'ENGINE_POWER', numericValue: 200, unit: 'kW' },
    ],
  },
  {
    manufacturer: 'Volvo',
    category: 'WHEEL_LOADER',
    modelName: 'L120',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 20000, unit: 'kg' },
      { definitionCode: 'BUCKET_CAPACITY', numericValue: 3.5, unit: 'm3' },
    ],
  },
  {
    manufacturer: 'Komatsu',
    category: 'WHEEL_LOADER',
    modelName: 'WA320',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 15, unit: 't' },
      { definitionCode: 'ENGINE_POWER', numericValue: 170, unit: 'hp' },
    ],
  },
  {
    manufacturer: 'JCB',
    category: 'BACKHOE_LOADER',
    modelName: '3CX',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 8, unit: 't' },
      { definitionCode: 'MAX_DIGGING_DEPTH', numericValue: 5900, unit: 'mm' },
      { definitionCode: 'ENGINE_MODEL', textValue: 'Illustrative diesel 448' },
    ],
  },
  {
    manufacturer: 'JCB',
    category: 'TELEHANDLER',
    modelName: '540-140',
    specifications: [
      { definitionCode: 'MAX_LIFT_HEIGHT', numericValue: 14, unit: 'm' },
      { definitionCode: 'LIFT_CAPACITY', numericValue: 4, unit: 't' },
      { definitionCode: 'MAX_REACH', minValue: 10, maxValue: 11, unit: 'm' },
    ],
  },
  {
    manufacturer: 'Bobcat',
    category: 'TELEHANDLER',
    modelName: 'T40.180',
    specifications: [
      { definitionCode: 'MAX_LIFT_HEIGHT', numericValue: 17500, unit: 'mm' },
      { definitionCode: 'LIFT_CAPACITY', numericValue: 4000, unit: 'kg' },
    ],
  },
  {
    manufacturer: 'Hitachi',
    category: 'ROLLER',
    modelName: 'ZC125',
    specifications: [
      { definitionCode: 'OPERATING_WEIGHT', numericValue: 12, unit: 't' },
      { definitionCode: 'DRUM_WIDTH', numericValue: 2100, unit: 'mm' },
    ],
  },
];
