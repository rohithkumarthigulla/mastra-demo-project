import type {
  CapabilityImportance,
  CreateCapabilityRequest,
  CreateConstructionTaskRequest,
  TaskSuitability,
} from '@ee/contracts';

/**
 * Illustrative taxonomy for local development and demos. Model and category links are
 * seeded against the TEST_FIXTURE source, so they stay REVIEW_REQUIRED.
 */

export const seedCapabilities: CreateCapabilityRequest[] = [
  { code: 'DEEP_EXCAVATION', displayName: 'Deep excavation' },
  { code: 'TRENCHING', displayName: 'Trenching' },
  { code: 'LOADING', displayName: 'Loading' },
  { code: 'MATERIAL_HANDLING', displayName: 'Material handling' },
  { code: 'LIFTING', displayName: 'Lifting' },
  { code: 'COMPACTION', displayName: 'Compaction' },
  { code: 'GRADING', displayName: 'Grading' },
  { code: 'DEMOLITION', displayName: 'Demolition' },
  { code: 'HAULING', displayName: 'Hauling' },
  { code: 'BREAKING', displayName: 'Breaking' },
  { code: 'CONFINED_SPACE_WORK', displayName: 'Confined space work' },
];

export const seedConstructionTasks: CreateConstructionTaskRequest[] = [
  { code: 'FOUNDATION_EXCAVATION', displayName: 'Foundation excavation' },
  { code: 'TRENCH_DIGGING', displayName: 'Trench digging' },
  { code: 'SITE_GRADING', displayName: 'Site grading' },
  { code: 'SOIL_COMPACTION', displayName: 'Soil compaction' },
  { code: 'DEMOLITION_WORK', displayName: 'Demolition work' },
  { code: 'MATERIAL_LOADING', displayName: 'Material loading' },
  { code: 'HEAVY_LIFTING', displayName: 'Heavy lifting' },
  { code: 'EARTH_HAULING', displayName: 'Earth hauling' },
  { code: 'UTILITY_INSTALLATION', displayName: 'Utility installation' },
];

export const seedTaskCapabilities: [task: string, capability: string, CapabilityImportance][] = [
  ['FOUNDATION_EXCAVATION', 'DEEP_EXCAVATION', 'REQUIRED'],
  ['FOUNDATION_EXCAVATION', 'LOADING', 'PREFERRED'],
  ['TRENCH_DIGGING', 'TRENCHING', 'REQUIRED'],
  ['TRENCH_DIGGING', 'CONFINED_SPACE_WORK', 'PREFERRED'],
  ['SITE_GRADING', 'GRADING', 'REQUIRED'],
  ['SITE_GRADING', 'COMPACTION', 'OPTIONAL'],
  ['SOIL_COMPACTION', 'COMPACTION', 'REQUIRED'],
  ['DEMOLITION_WORK', 'DEMOLITION', 'REQUIRED'],
  ['DEMOLITION_WORK', 'BREAKING', 'PREFERRED'],
  ['DEMOLITION_WORK', 'LOADING', 'OPTIONAL'],
  ['MATERIAL_LOADING', 'LOADING', 'REQUIRED'],
  ['MATERIAL_LOADING', 'MATERIAL_HANDLING', 'PREFERRED'],
  ['HEAVY_LIFTING', 'LIFTING', 'REQUIRED'],
  ['HEAVY_LIFTING', 'MATERIAL_HANDLING', 'PREFERRED'],
  ['EARTH_HAULING', 'HAULING', 'REQUIRED'],
  ['EARTH_HAULING', 'LOADING', 'PREFERRED'],
  ['UTILITY_INSTALLATION', 'TRENCHING', 'REQUIRED'],
  ['UTILITY_INSTALLATION', 'LIFTING', 'OPTIONAL'],
];

export const seedTaskCategories: [task: string, category: string, TaskSuitability][] = [
  ['FOUNDATION_EXCAVATION', 'EXCAVATOR', 'PRIMARY'],
  ['FOUNDATION_EXCAVATION', 'BACKHOE_LOADER', 'SECONDARY'],
  ['TRENCH_DIGGING', 'MINI_EXCAVATOR', 'PRIMARY'],
  ['TRENCH_DIGGING', 'EXCAVATOR', 'SECONDARY'],
  ['TRENCH_DIGGING', 'BACKHOE_LOADER', 'SECONDARY'],
  ['SITE_GRADING', 'WHEEL_LOADER', 'SECONDARY'],
  ['SOIL_COMPACTION', 'ROLLER', 'PRIMARY'],
  ['DEMOLITION_WORK', 'EXCAVATOR', 'PRIMARY'],
  ['MATERIAL_LOADING', 'WHEEL_LOADER', 'PRIMARY'],
  ['MATERIAL_LOADING', 'BACKHOE_LOADER', 'SECONDARY'],
  ['HEAVY_LIFTING', 'TELEHANDLER', 'PRIMARY'],
  ['EARTH_HAULING', 'WHEEL_LOADER', 'SECONDARY'],
  ['UTILITY_INSTALLATION', 'MINI_EXCAVATOR', 'PRIMARY'],
  ['UTILITY_INSTALLATION', 'BACKHOE_LOADER', 'PRIMARY'],
];

export const seedCategoryCapabilities: [category: string, capability: string][] = [
  ['EXCAVATOR', 'DEEP_EXCAVATION'],
  ['EXCAVATOR', 'TRENCHING'],
  ['EXCAVATOR', 'DEMOLITION'],
  ['MINI_EXCAVATOR', 'TRENCHING'],
  ['MINI_EXCAVATOR', 'CONFINED_SPACE_WORK'],
  ['WHEEL_LOADER', 'LOADING'],
  ['WHEEL_LOADER', 'HAULING'],
  ['BACKHOE_LOADER', 'LOADING'],
  ['BACKHOE_LOADER', 'TRENCHING'],
  ['TELEHANDLER', 'LIFTING'],
  ['TELEHANDLER', 'MATERIAL_HANDLING'],
  ['ROLLER', 'COMPACTION'],
];

/** Model links are recorded per model; they are deliberately not derived from the category. */
export const seedModelCapabilities: [manufacturer: string, model: string, capability: string][] = [
  ['Caterpillar', '320', 'DEEP_EXCAVATION'],
  ['Caterpillar', '320', 'TRENCHING'],
  ['Liebherr', 'R 920', 'DEMOLITION'],
  ['Bobcat', 'E35', 'CONFINED_SPACE_WORK'],
  ['Caterpillar', '950', 'LOADING'],
  ['JCB', '3CX', 'LOADING'],
  ['JCB', '3CX', 'TRENCHING'],
  ['JCB', '540-140', 'LIFTING'],
  ['Hitachi', 'ZC125', 'COMPACTION'],
];
