import { sql, type SQL } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const accountRole = pgEnum('account_role', ['SUPPLIER', 'BUILDER', 'ADMIN']);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: accountRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('accounts_email_lower_idx').on(sql`lower(${t.email})`)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refresh_tokens_account_id_idx').on(t.accountId)],
);

export const supplierProfiles = pgTable('supplier_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id')
    .notNull()
    .unique()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const unit = pgEnum('unit', ['kg', 't', 'm', 'mm', 'kW', 'hp', 'm3']);
export const specificationValueType = pgEnum('specification_value_type', ['NUMERIC', 'TEXT']);
export const equipmentModelStatus = pgEnum('equipment_model_status', ['ACTIVE', 'INACTIVE']);

const CODE_PATTERN = '^[A-Z][A-Z0-9_]*$';

/** Null, or a finite non-negative number (double precision also allows NaN and ±Infinity). */
function finiteNonNegative(column: AnyPgColumn): SQL {
  return sql`${column} IS NULL OR (${column} >= 0 AND ${column} < 'Infinity'::float8)`;
}

export const equipmentCategories = pgTable(
  'equipment_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('equipment_categories_code_chk', sql`${t.code} ~ ${sql.raw(`'${CODE_PATTERN}'`)}`)],
);

export const manufacturers = pgTable(
  'manufacturers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('manufacturers_name_lower_idx').on(sql`lower(${t.name})`)],
);

export const specificationDefinitions = pgTable(
  'specification_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    displayName: text('display_name').notNull(),
    valueType: specificationValueType('value_type').notNull(),
    /** Immutable once set; enforced by a trigger in the migration. */
    canonicalUnit: unit('canonical_unit'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('specification_definitions_code_chk', sql`${t.code} ~ ${sql.raw(`'${CODE_PATTERN}'`)}`),
    check(
      'specification_definitions_unit_chk',
      sql`(${t.valueType} = 'NUMERIC') = (${t.canonicalUnit} IS NOT NULL)`,
    ),
  ],
);

export const equipmentModels = pgTable(
  'equipment_models',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    manufacturerId: uuid('manufacturer_id')
      .notNull()
      .references(() => manufacturers.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => equipmentCategories.id, { onDelete: 'restrict' }),
    modelName: text('model_name').notNull(),
    modelCode: text('model_code'),
    status: equipmentModelStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('equipment_models_manufacturer_name_lower_idx').on(
      t.manufacturerId,
      sql`lower(${t.modelName})`,
    ),
    index('equipment_models_category_id_idx').on(t.categoryId),
  ],
);

export const specificationSourceType = pgEnum('specification_source_type', [
  'MANUFACTURER',
  'LICENSED_DATASET',
  'APPROVED_PUBLIC_SOURCE',
  'INTERNAL_VERIFICATION',
  'TEST_FIXTURE',
]);
export const verificationStatus = pgEnum('verification_status', [
  'VERIFIED',
  'REVIEW_REQUIRED',
  'UNKNOWN',
  'DEPRECATED',
]);

export const specificationSources = pgTable(
  'specification_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceType: specificationSourceType('source_type').notNull(),
    sourceName: text('source_name').notNull(),
    referenceUrl: text('reference_url'),
    documentName: text('document_name'),
    retrievedAt: date('retrieved_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('specification_sources_type_name_lower_idx').on(
      t.sourceType,
      sql`lower(${t.sourceName})`,
    ),
  ],
);

export const equipmentSpecifications = pgTable(
  'equipment_specifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => equipmentModels.id, { onDelete: 'cascade' }),
    definitionId: uuid('definition_id')
      .notNull()
      .references(() => specificationDefinitions.id, { onDelete: 'restrict' }),
    numericValue: doublePrecision('numeric_value'),
    minValue: doublePrecision('min_value'),
    maxValue: doublePrecision('max_value'),
    unit: unit('unit'),
    textValue: text('text_value'),
    normalizedMin: doublePrecision('normalized_min'),
    normalizedMax: doublePrecision('normalized_max'),
    verificationStatus: verificationStatus('verification_status').notNull(),
    sourceId: uuid('source_id').references(() => specificationSources.id, {
      onDelete: 'restrict',
    }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('equipment_specifications_model_definition_unique').on(t.modelId, t.definitionId),
    // Serve spec range filters; the min index also covers lookups by definition alone.
    index('equipment_specifications_definition_normalized_min_idx').on(
      t.definitionId,
      t.normalizedMin,
    ),
    index('equipment_specifications_definition_normalized_max_idx').on(
      t.definitionId,
      t.normalizedMax,
    ),
    index('equipment_specifications_source_id_idx').on(t.sourceId),
    // An empty value is UNKNOWN, and UNKNOWN is only for an empty value.
    check(
      'equipment_specifications_unknown_chk',
      sql`(${t.verificationStatus} = 'UNKNOWN') = (${t.numericValue} IS NULL AND ${t.minValue} IS NULL AND ${t.maxValue} IS NULL AND ${t.textValue} IS NULL)`,
    ),
    // VERIFIED needs a source; a TEST_FIXTURE source is rejected by a trigger in the migration.
    check(
      'equipment_specifications_verified_chk',
      sql`${t.verificationStatus} <> 'VERIFIED' OR ${t.sourceId} IS NOT NULL`,
    ),
    check(
      'equipment_specifications_verified_at_chk',
      sql`(${t.verifiedAt} IS NOT NULL) = (${t.verificationStatus} = 'VERIFIED')`,
    ),
    // Exactly one shape: single, range, text, or empty (unknown).
    check(
      'equipment_specifications_shape_chk',
      sql`(${t.numericValue} IS NOT NULL AND ${t.minValue} IS NULL AND ${t.maxValue} IS NULL AND ${t.unit} IS NOT NULL AND ${t.textValue} IS NULL AND ${t.normalizedMin} = ${t.normalizedMax})
        OR (${t.numericValue} IS NULL AND ${t.minValue} IS NOT NULL AND ${t.maxValue} IS NOT NULL AND ${t.unit} IS NOT NULL AND ${t.textValue} IS NULL AND ${t.normalizedMin} IS NOT NULL AND ${t.normalizedMax} IS NOT NULL)
        OR (${t.numericValue} IS NULL AND ${t.minValue} IS NULL AND ${t.maxValue} IS NULL AND ${t.unit} IS NULL AND ${t.textValue} IS NOT NULL AND ${t.normalizedMin} IS NULL AND ${t.normalizedMax} IS NULL)
        OR (${t.numericValue} IS NULL AND ${t.minValue} IS NULL AND ${t.maxValue} IS NULL AND ${t.unit} IS NULL AND ${t.textValue} IS NULL AND ${t.normalizedMin} IS NULL AND ${t.normalizedMax} IS NULL)`,
    ),
    check('equipment_specifications_numeric_value_chk', finiteNonNegative(t.numericValue)),
    check('equipment_specifications_min_value_chk', finiteNonNegative(t.minValue)),
    check('equipment_specifications_max_value_chk', finiteNonNegative(t.maxValue)),
    check('equipment_specifications_normalized_min_chk', finiteNonNegative(t.normalizedMin)),
    check('equipment_specifications_normalized_max_chk', finiteNonNegative(t.normalizedMax)),
    check(
      'equipment_specifications_range_chk',
      sql`${t.minValue} IS NULL OR ${t.maxValue} IS NULL OR ${t.minValue} <= ${t.maxValue}`,
    ),
    check(
      'equipment_specifications_normalized_range_chk',
      sql`${t.normalizedMin} IS NULL OR ${t.normalizedMax} IS NULL OR ${t.normalizedMin} <= ${t.normalizedMax}`,
    ),
  ],
);

export const capabilityImportance = pgEnum('capability_importance', [
  'REQUIRED',
  'PREFERRED',
  'OPTIONAL',
]);

export const taskSuitability = pgEnum('task_suitability', ['PRIMARY', 'SECONDARY']);

export const capabilities = pgTable('capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique('capabilities_code_unique'),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const constructionTasks = pgTable('construction_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique('construction_tasks_code_unique'),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Provenance shared by model and category capability links. */
function linkProvenanceColumns() {
  return {
    verificationStatus: verificationStatus('verification_status').notNull(),
    sourceId: uuid('source_id').references(() => specificationSources.id, {
      onDelete: 'restrict',
    }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  };
}

// A link exists, so it is never UNKNOWN; VERIFIED needs a source, and a TEST_FIXTURE
// source is rejected by a trigger in the migration.
function linkProvenanceChecks(
  table: string,
  t: { verificationStatus: AnyPgColumn; sourceId: AnyPgColumn; verifiedAt: AnyPgColumn },
) {
  return [
    check(`${table}_status_chk`, sql`${t.verificationStatus} IN ('VERIFIED', 'REVIEW_REQUIRED')`),
    check(
      `${table}_verified_chk`,
      sql`${t.verificationStatus} <> 'VERIFIED' OR ${t.sourceId} IS NOT NULL`,
    ),
    check(
      `${table}_verified_at_chk`,
      sql`(${t.verifiedAt} IS NOT NULL) = (${t.verificationStatus} = 'VERIFIED')`,
    ),
    index(`${table}_source_id_idx`).on(t.sourceId),
  ];
}

export const equipmentModelCapabilities = pgTable(
  'equipment_model_capabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => equipmentModels.id, { onDelete: 'cascade' }),
    capabilityId: uuid('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
    ...linkProvenanceColumns(),
  },
  (t) => [
    unique('equipment_model_capabilities_unique').on(t.modelId, t.capabilityId),
    index('equipment_model_capabilities_capability_id_idx').on(t.capabilityId),
    ...linkProvenanceChecks('equipment_model_capabilities', t),
  ],
);

export const equipmentCategoryCapabilities = pgTable(
  'equipment_category_capabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => equipmentCategories.id, { onDelete: 'cascade' }),
    capabilityId: uuid('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
    ...linkProvenanceColumns(),
  },
  (t) => [
    unique('equipment_category_capabilities_unique').on(t.categoryId, t.capabilityId),
    index('equipment_category_capabilities_capability_id_idx').on(t.capabilityId),
    ...linkProvenanceChecks('equipment_category_capabilities', t),
  ],
);

export const constructionTaskCapabilities = pgTable(
  'construction_task_capabilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => constructionTasks.id, { onDelete: 'cascade' }),
    capabilityId: uuid('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
    importance: capabilityImportance('importance').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('construction_task_capabilities_unique').on(t.taskId, t.capabilityId),
    index('construction_task_capabilities_capability_id_idx').on(t.capabilityId, t.importance),
  ],
);

export const constructionTaskCategories = pgTable(
  'construction_task_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => constructionTasks.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => equipmentCategories.id, { onDelete: 'cascade' }),
    suitability: taskSuitability('suitability').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('construction_task_categories_unique').on(t.taskId, t.categoryId),
    index('construction_task_categories_category_id_idx').on(t.categoryId),
  ],
);

/** Cities the marketplace knows about; `enabled` marks where it operates. */
export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  geoId: text('geo_id').notNull().unique('cities_geo_id_unique'),
  name: text('name').notNull(),
  state: text('state').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Legal forms a business can register as (proprietorship, LLP, …). */
export const entityTypes = pgTable('entity_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique('entity_types_code_unique'),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const listingStatus = pgEnum('listing_status', ['DRAFT', 'ACTIVE', 'INACTIVE']);

/**
 * A supplier's rentable unit. The category is not stored: it always comes from the
 * equipment model so the listing cannot disagree with the knowledge base.
 */
export const equipmentListings = pgTable(
  'equipment_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierProfileId: uuid('supplier_profile_id')
      .notNull()
      .references(() => supplierProfiles.id, { onDelete: 'cascade' }),
    modelId: uuid('model_id')
      .notNull()
      .references(() => equipmentModels.id, { onDelete: 'restrict' }),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    location: text('location').notNull(),
    pricePerDay: numeric('price_per_day', { precision: 14, scale: 2 }).notNull(),
    status: listingStatus('status').notNull().default('DRAFT'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'equipment_listings_price_chk',
      sql`${t.pricePerDay} > 0 AND ${t.pricePerDay} <= 1000000`,
    ),
    index('equipment_listings_supplier_profile_id_idx').on(t.supplierProfileId),
    index('equipment_listings_status_city_idx').on(t.status, t.cityId),
    index('equipment_listings_status_created_at_idx').on(t.status, t.createdAt),
    index('equipment_listings_model_id_idx').on(t.modelId),
    // Target for fleet foreign keys that pin a unit to its supplier's own listing.
    unique('equipment_listings_id_supplier_unique').on(t.id, t.supplierProfileId),
  ],
);

export const listingMedia = pgTable(
  'listing_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => equipmentListings.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'listing_media_mime_type_chk',
      sql`${t.mimeType} IN ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    check('listing_media_size_bytes_chk', sql`${t.sizeBytes} > 0`),
    check('listing_media_position_chk', sql`${t.position} >= 0`),
    // Not unique so a reorder can rewrite positions row by row without deferred constraints.
    index('listing_media_listing_position_idx').on(t.listingId, t.position),
  ],
);

/** A supplier's depot where machines are kept. */
export const yards = pgTable(
  'yards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierProfileId: uuid('supplier_profile_id')
      .notNull()
      .references(() => supplierProfiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    address: text('address').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('yards_name_chk', sql`char_length(${t.name}) BETWEEN 1 AND 80`),
    check('yards_address_chk', sql`char_length(${t.address}) <= 300`),
    uniqueIndex('yards_supplier_name_idx').on(t.supplierProfileId, sql`lower(${t.name})`),
    unique('yards_id_supplier_unique').on(t.id, t.supplierProfileId),
  ],
);

export const unitCondition = pgEnum('unit_condition', ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR']);
export const unitStatus = pgEnum('unit_status', ['ACTIVE', 'RETIRED']);

/**
 * One physical machine offered under a listing. The model is not stored: it always comes
 * from the listing. Composite foreign keys keep the listing and yard within the unit's supplier.
 */
export const equipmentUnits = pgTable(
  'equipment_units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierProfileId: uuid('supplier_profile_id')
      .notNull()
      .references(() => supplierProfiles.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id').notNull(),
    yardId: uuid('yard_id').notNull(),
    modelYear: integer('model_year').notNull(),
    condition: unitCondition('condition').notNull(),
    label: text('label'),
    status: unitStatus('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'equipment_units_listing_fk',
      columns: [t.listingId, t.supplierProfileId],
      foreignColumns: [equipmentListings.id, equipmentListings.supplierProfileId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'equipment_units_yard_fk',
      columns: [t.yardId, t.supplierProfileId],
      foreignColumns: [yards.id, yards.supplierProfileId],
    }).onDelete('restrict'),
    check('equipment_units_model_year_chk', sql`${t.modelYear} BETWEEN 1950 AND 2100`),
    check('equipment_units_label_chk', sql`char_length(${t.label}) BETWEEN 1 AND 80`),
    unique('equipment_units_id_supplier_unique').on(t.id, t.supplierProfileId),
    index('equipment_units_supplier_status_idx').on(t.supplierProfileId, t.status),
    index('equipment_units_listing_status_idx').on(t.listingId, t.status),
    index('equipment_units_yard_status_idx').on(t.yardId, t.status),
  ],
);

export const assetIdentifierType = pgEnum('asset_identifier_type', [
  'SERIAL_NUMBER',
  'REGISTRATION_NUMBER',
  'ENGINE_NUMBER',
]);

/** Serial, registration or engine number; unique per type within a supplier's fleet. */
export const assetIdentifiers = pgTable(
  'asset_identifiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierProfileId: uuid('supplier_profile_id').notNull(),
    unitId: uuid('unit_id').notNull(),
    type: assetIdentifierType('type').notNull(),
    value: text('value').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'asset_identifiers_unit_fk',
      columns: [t.unitId, t.supplierProfileId],
      foreignColumns: [equipmentUnits.id, equipmentUnits.supplierProfileId],
    }).onDelete('cascade'),
    check('asset_identifiers_value_chk', sql`char_length(${t.value}) BETWEEN 1 AND 80`),
    unique('asset_identifiers_unit_type_unique').on(t.unitId, t.type),
    uniqueIndex('asset_identifiers_supplier_type_value_idx').on(
      t.supplierProfileId,
      t.type,
      sql`lower(${t.value})`,
    ),
  ],
);

export const blockReason = pgEnum('block_reason', ['MAINTENANCE', 'TRANSPORT', 'HELD_BACK']);
export const blockStatus = pgEnum('block_status', ['ACTIVE', 'LIFTED']);

/**
 * Overlap between ACTIVE blocks of one unit is prevented by the
 * `maintenance_blocks_no_overlap` EXCLUDE constraint (btree_gist), added by hand
 * in drizzle/0011_availability.sql because Drizzle cannot model it.
 */
export const maintenanceBlocks = pgTable(
  'maintenance_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => equipmentUnits.id, { onDelete: 'cascade' }),
    reason: blockReason('reason').notNull(),
    status: blockStatus('status').notNull().default('ACTIVE'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    note: text('note'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('maintenance_blocks_range_chk', sql`${t.endAt} > ${t.startAt}`),
    check('maintenance_blocks_note_chk', sql`${t.note} IS NULL OR char_length(${t.note}) <= 500`),
    index('maintenance_blocks_unit_status_idx').on(t.unitId, t.status),
  ],
);

export const rentalRequestStatus = pgEnum('rental_request_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'WITHDRAWN',
]);
export const quoteStatus = pgEnum('quote_status', [
  'DRAFT',
  'PENDING_APPROVAL',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);
export const quoteLineType = pgEnum('quote_line_type', [
  'RENTAL',
  'TRANSPORT',
  'OPERATOR',
  'DEPOSIT',
  'DISCOUNT',
]);
export const bookingStatus = pgEnum('booking_status', [
  'CONFIRMED',
  'OUT_FOR_DELIVERY',
  'ON_RENT',
  'RETURNED',
  'CANCELLED',
]);
export const requirementStatus = pgEnum('requirement_status', [
  'DRAFT',
  'OPEN',
  'AWARDED',
  'CANCELLED',
]);
export const notificationKind = pgEnum('notification_kind', [
  'QUOTE_RECEIVED',
  'JOB_VIEWED',
  'REQUEST_DECLINED',
  'BOOKING_CONFIRMED',
  'REQUEST_RECEIVED',
  'QUOTE_ACCEPTED',
  'QUOTE_LOST',
  'REQUEST_WITHDRAWN',
]);
export const notificationTone = pgEnum('notification_tone', ['good', 'waiting', 'neutral']);
export const chatRole = pgEnum('chat_role', ['USER', 'ASSISTANT']);
export const agentActionType = pgEnum('agent_action_type', [
  'BLOCK_UNIT',
  'LIFT_BLOCK',
  'UPDATE_LISTING_PRICE',
  'REJECT_REQUEST',
]);
export const agentActionStatus = pgEnum('agent_action_status', [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

/** A builder's job sent to several suppliers at once; each invitation is a rental request. */
export const requirements = pgTable(
  'requirements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    builderAccountId: uuid('builder_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => equipmentCategories.id, { onDelete: 'restrict' }),
    equipmentModelId: uuid('equipment_model_id').references(() => equipmentModels.id, {
      onDelete: 'restrict',
    }),
    constructionTaskId: uuid('construction_task_id').references(() => constructionTasks.id, {
      onDelete: 'restrict',
    }),
    cityId: uuid('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'restrict' }),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    budgetPerDay: money('budget_per_day'),
    notes: text('notes'),
    status: requirementStatus('status').notNull().default('DRAFT'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    awardedQuoteId: uuid('awarded_quote_id').references((): AnyPgColumn => quotes.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('requirements_title_chk', sql`char_length(${t.title}) BETWEEN 3 AND 120`),
    check('requirements_dates_chk', sql`${t.endDate} >= ${t.startDate}`),
    check('requirements_quantity_chk', sql`${t.quantity} BETWEEN 1 AND 20`),
    check(
      'requirements_budget_chk',
      sql`${t.budgetPerDay} IS NULL OR (${t.budgetPerDay} > 0 AND ${t.budgetPerDay} <= 1000000)`,
    ),
    check('requirements_notes_chk', sql`${t.notes} IS NULL OR char_length(${t.notes}) <= 2000`),
    index('requirements_builder_status_idx').on(t.builderAccountId, t.status),
  ],
);

export const rentalRequests = pgTable(
  'rental_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => equipmentListings.id, { onDelete: 'restrict' }),
    builderAccountId: uuid('builder_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    requirementId: uuid('requirement_id').references(() => requirements.id, {
      onDelete: 'cascade',
    }),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    message: text('message'),
    status: rentalRequestStatus('status').notNull().default('PENDING'),
    declineReason: text('decline_reason'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('rental_requests_dates_chk', sql`${t.endDate} >= ${t.startDate}`),
    check(
      'rental_requests_message_chk',
      sql`${t.message} IS NULL OR char_length(${t.message}) <= 1000`,
    ),
    check(
      'rental_requests_decline_reason_chk',
      sql`${t.declineReason} IS NULL OR char_length(${t.declineReason}) <= 500`,
    ),
    index('rental_requests_listing_status_idx').on(t.listingId, t.status),
    index('rental_requests_builder_status_idx').on(t.builderAccountId, t.status),
    index('rental_requests_requirement_idx').on(t.requirementId),
    // A requirement invites each listing at most once.
    uniqueIndex('rental_requests_requirement_listing_idx')
      .on(t.requirementId, t.listingId)
      .where(sql`${t.requirementId} IS NOT NULL`),
  ],
);

/** Optional extra prices a supplier keeps per listing; used to pre-fill quotes. */
export const rateCards = pgTable(
  'rate_cards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .unique('rate_cards_listing_unique')
      .references(() => equipmentListings.id, { onDelete: 'cascade' }),
    weekRate: money('week_rate'),
    monthRate: money('month_rate'),
    transportFee: money('transport_fee'),
    operatorRatePerDay: money('operator_rate_per_day'),
    depositAmount: money('deposit_amount'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'rate_cards_amounts_chk',
      sql`coalesce(${t.weekRate}, 0) >= 0 AND coalesce(${t.monthRate}, 0) >= 0 AND coalesce(${t.transportFee}, 0) >= 0 AND coalesce(${t.operatorRatePerDay}, 0) >= 0 AND coalesce(${t.depositAmount}, 0) >= 0`,
    ),
  ],
);

/** At most one quote per rental request that is not REJECTED or EXPIRED. */
export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rentalRequestId: uuid('rental_request_id')
      .notNull()
      .references(() => rentalRequests.id, { onDelete: 'cascade' }),
    supplierProfileId: uuid('supplier_profile_id')
      .notNull()
      .references(() => supplierProfiles.id, { onDelete: 'cascade' }),
    equipmentUnitId: uuid('equipment_unit_id').references(() => equipmentUnits.id, {
      onDelete: 'restrict',
    }),
    status: quoteStatus('status').notNull().default('DRAFT'),
    subtotal: money('subtotal').notNull(),
    taxPercent: numeric('tax_percent', { precision: 5, scale: 2 }).notNull(),
    taxAmount: money('tax_amount').notNull(),
    depositAmount: money('deposit_amount').notNull().default('0'),
    total: money('total').notNull(),
    notes: text('notes'),
    validUntil: date('valid_until', { mode: 'string' }),
    autoDrafted: boolean('auto_drafted').notNull().default(false),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('quotes_tax_percent_chk', sql`${t.taxPercent} >= 0`),
    check('quotes_amounts_chk', sql`${t.taxAmount} >= 0 AND ${t.depositAmount} >= 0`),
    check('quotes_notes_chk', sql`${t.notes} IS NULL OR char_length(${t.notes}) <= 2000`),
    uniqueIndex('quotes_one_open_per_request')
      .on(t.rentalRequestId)
      .where(sql`${t.status} NOT IN ('REJECTED', 'EXPIRED')`),
    index('quotes_rental_request_idx').on(t.rentalRequestId),
    index('quotes_supplier_status_idx').on(t.supplierProfileId, t.status),
  ],
);

export const quoteLines = pgTable(
  'quote_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    type: quoteLineType('type').notNull(),
    description: text('description').notNull(),
    quantity: integer('quantity').notNull(),
    unitAmount: money('unit_amount').notNull(),
    amount: money('amount').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [
    check('quote_lines_description_chk', sql`char_length(${t.description}) BETWEEN 1 AND 200`),
    check('quote_lines_quantity_chk', sql`${t.quantity} >= 1`),
    check('quote_lines_unit_amount_chk', sql`${t.unitAmount} >= 0`),
    check('quote_lines_position_chk', sql`${t.position} >= 0`),
    index('quote_lines_quote_position_idx').on(t.quoteId, t.position),
  ],
);

/**
 * `start_at` is midnight Asia/Kolkata on the start date; `end_at` is midnight after the
 * end date (half-open). Overlap between CONFIRMED, OUT_FOR_DELIVERY and ON_RENT bookings
 * of one unit is prevented by the `bookings_no_overlap` EXCLUDE constraint (btree_gist),
 * added by hand in drizzle/0012_remaining_features.sql because Drizzle cannot model it.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id')
      .notNull()
      .unique('bookings_quote_unique')
      .references(() => quotes.id, { onDelete: 'restrict' }),
    rentalRequestId: uuid('rental_request_id')
      .notNull()
      .references(() => rentalRequests.id, { onDelete: 'restrict' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => equipmentListings.id, { onDelete: 'restrict' }),
    equipmentUnitId: uuid('equipment_unit_id')
      .notNull()
      .references(() => equipmentUnits.id, { onDelete: 'restrict' }),
    supplierProfileId: uuid('supplier_profile_id')
      .notNull()
      .references(() => supplierProfiles.id, { onDelete: 'restrict' }),
    builderAccountId: uuid('builder_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: bookingStatus('status').notNull().default('CONFIRMED'),
    total: money('total').notNull(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    rentStartedAt: timestamp('rent_started_at', { withTimezone: true }),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('bookings_range_chk', sql`${t.endAt} > ${t.startAt}`),
    check(
      'bookings_cancel_reason_chk',
      sql`${t.cancelReason} IS NULL OR char_length(${t.cancelReason}) <= 500`,
    ),
    index('bookings_supplier_status_idx').on(t.supplierProfileId, t.status),
    index('bookings_builder_status_idx').on(t.builderAccountId, t.status),
    index('bookings_unit_status_idx').on(t.equipmentUnitId, t.status),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    kind: notificationKind('kind').notNull(),
    title: text('title').notNull(),
    detail: text('detail'),
    href: text('href'),
    tone: notificationTone('tone').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('notifications_href_chk', sql`${t.href} IS NULL OR ${t.href} LIKE '/%'`),
    index('notifications_account_created_at_idx').on(t.accountId, t.createdAt),
  ],
);

export const assistantConversations = pgTable(
  'assistant_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    builderAccountId: uuid('builder_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('assistant_conversations_title_chk', sql`char_length(${t.title}) BETWEEN 1 AND 120`),
    index('assistant_conversations_builder_updated_idx').on(t.builderAccountId, t.updatedAt),
  ],
);

export const assistantMessages = pgTable(
  'assistant_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => assistantConversations.id, { onDelete: 'cascade' }),
    role: chatRole('role').notNull(),
    content: text('content').notNull(),
    recommendedModelIds: uuid('recommended_model_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('assistant_messages_conversation_created_idx').on(t.conversationId, t.createdAt)],
);

export const knowledgeDocuments = pgTable('knowledge_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  path: text('path').notNull().unique('knowledge_documents_path_unique'),
  language: text('language').notNull(),
  audience: text('audience').notNull(),
  domain: text('domain').notNull(),
  topic: text('topic').notNull(),
  title: text('title').notNull(),
  contentHash: text('content_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
    embeddingModel: text('embedding_model').notNull(),
  },
  (t) => [
    unique('knowledge_chunks_document_position_unique').on(t.documentId, t.position),
    index('knowledge_chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

export const agentConversations = pgTable(
  'agent_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierProfileId: uuid('supplier_profile_id')
      .notNull()
      .references(() => supplierProfiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('agent_conversations_title_chk', sql`char_length(${t.title}) BETWEEN 1 AND 120`),
    index('agent_conversations_supplier_updated_idx').on(t.supplierProfileId, t.updatedAt),
  ],
);

export const agentMessages = pgTable(
  'agent_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    role: chatRole('role').notNull(),
    content: text('content').notNull(),
    citedDocumentIds: uuid('cited_document_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('agent_messages_conversation_created_idx').on(t.conversationId, t.createdAt)],
);

/** Changes the supplier agent proposes; nothing is applied until the supplier confirms. */
export const agentPendingActions = pgTable(
  'agent_pending_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => agentConversations.id, { onDelete: 'cascade' }),
    type: agentActionType('type').notNull(),
    payload: jsonb('payload').notNull(),
    status: agentActionStatus('status').notNull().default('PENDING'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('agent_pending_actions_conversation_status_idx').on(t.conversationId, t.status)],
);
