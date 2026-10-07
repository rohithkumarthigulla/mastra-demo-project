import { z } from 'zod';
import {
  calendarDateSchema,
  listingSummarySchema,
  pageSchema,
  paginationQuery,
  withRentalDateRules,
} from './common.js';
import { knowledgeCodeSchema } from './equipment-knowledge.js';
import { rateSchema } from './money.js';
import { RENTAL_REQUEST_MESSAGE_MAX } from './rental-request.js';
import {
  quoteSummarySchema,
  rentalRequestStatusSchema,
  requirementStatusSchema,
} from './statuses.js';

/** Most suppliers one requirement may be sent to, across every `send` call. */
export const REQUIREMENT_MAX_SUPPLIERS = 25;
export const REQUIREMENT_TITLE_MIN = 3;
export const REQUIREMENT_TITLE_MAX = 120;
export const REQUIREMENT_NOTES_MAX = 2000;
export const REQUIREMENT_MAX_QUANTITY = 20;

const requirementFields = {
  title: z.string().trim().min(REQUIREMENT_TITLE_MIN).max(REQUIREMENT_TITLE_MAX),
  categoryCode: knowledgeCodeSchema,
  equipmentModelId: z.uuid().nullable(),
  constructionTaskCode: knowledgeCodeSchema.nullable(),
  cityGeoId: z.string().trim().min(1),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  quantity: z.number().int().min(1).max(REQUIREMENT_MAX_QUANTITY),
  budgetPerDay: rateSchema.nullable(),
  notes: z.string().trim().min(1).max(REQUIREMENT_NOTES_MAX).nullable(),
};

/** Creates a `DRAFT` requirement. */
export const createRequirementSchema = withRentalDateRules(
  z
    .object({
      ...requirementFields,
      equipmentModelId: requirementFields.equipmentModelId.optional(),
      constructionTaskCode: requirementFields.constructionTaskCode.optional(),
      quantity: requirementFields.quantity.default(1),
      budgetPerDay: requirementFields.budgetPerDay.optional(),
      notes: requirementFields.notes.optional(),
    })
    .strict(),
);
export type CreateRequirementRequest = z.infer<typeof createRequirementSchema>;

/**
 * Only allowed while `DRAFT`. When either date is sent, the api re-checks the date
 * rules against the stored other date.
 */
export const updateRequirementSchema = z
  .object(requirementFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to change',
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });
export type UpdateRequirementRequest = z.infer<typeof updateRequirementSchema>;

export const listRequirementsQuerySchema = z.object({
  status: requirementStatusSchema.optional(),
  ...paginationQuery,
});
export type ListRequirementsQuery = z.infer<typeof listRequirementsQuerySchema>;

export const requirementMatchesQuerySchema = z.object({ ...paginationQuery });
export type RequirementMatchesQuery = z.infer<typeof requirementMatchesQuerySchema>;

export const sendRequirementSchema = z
  .object({
    listingIds: z
      .array(z.uuid())
      .min(1)
      .max(REQUIREMENT_MAX_SUPPLIERS)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'listingIds must be unique' }),
    message: z.string().trim().min(1).max(RENTAL_REQUEST_MESSAGE_MAX).optional(),
  })
  .strict();
export type SendRequirementRequest = z.infer<typeof sendRequirementSchema>;

export const sendSkipReasonSchema = z.enum(['ALREADY_INVITED', 'NOT_ACTIVE', 'UNAVAILABLE']);
export type SendSkipReason = z.infer<typeof sendSkipReasonSchema>;

export const requirementInvitationSchema = z.object({
  rentalRequestId: z.uuid(),
  listingId: z.uuid(),
  listingTitle: z.string(),
  supplierName: z.string(),
  status: rentalRequestStatusSchema,
  viewedAt: z.iso.datetime().nullable(),
  quote: quoteSummarySchema.nullable(),
});
export type RequirementInvitationDto = z.infer<typeof requirementInvitationSchema>;

export const sendRequirementResponseSchema = z.object({
  sent: z.array(requirementInvitationSchema),
  skipped: z.array(z.object({ listingId: z.uuid(), reason: sendSkipReasonSchema })),
});
export type SendRequirementResponse = z.infer<typeof sendRequirementResponseSchema>;

export const requirementSchema = z.object({
  id: z.uuid(),
  status: requirementStatusSchema,
  title: z.string(),
  categoryCode: z.string(),
  equipmentModelId: z.uuid().nullable(),
  constructionTaskCode: z.string().nullable(),
  city: z.object({ geoId: z.string(), name: z.string() }),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
  days: z.number().int(),
  quantity: z.number().int(),
  budgetPerDay: z.number().nullable(),
  notes: z.string().nullable(),
  sentAt: z.iso.datetime().nullable(),
  awardedQuoteId: z.uuid().nullable(),
  invitationCount: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RequirementDto = z.infer<typeof requirementSchema>;

export const requirementDetailSchema = requirementSchema.extend({
  invitations: z.array(requirementInvitationSchema),
});
export type RequirementDetailDto = z.infer<typeof requirementDetailSchema>;

export const requirementPageSchema = pageSchema(requirementSchema);
export type RequirementPageDto = z.infer<typeof requirementPageSchema>;

/** A listing that fits the requirement's category, city and dates. */
export const requirementMatchSchema = z.object({
  listing: listingSummarySchema,
  supplierName: z.string(),
  availableUnits: z.number().int(),
  alreadyInvited: z.boolean(),
});
export type RequirementMatchDto = z.infer<typeof requirementMatchSchema>;

export const requirementMatchPageSchema = pageSchema(requirementMatchSchema);
export type RequirementMatchPageDto = z.infer<typeof requirementMatchPageSchema>;
