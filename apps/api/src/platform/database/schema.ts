import { sql, type SQL } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('equipment_specifications_model_definition_unique').on(t.modelId, t.definitionId),
    index('equipment_specifications_definition_id_idx').on(t.definitionId),
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
