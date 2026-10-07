import { Inject, Injectable } from '@nestjs/common';
import {
  MAX_RENTAL_DAYS,
  rentalDays,
  todayInRentalZone,
  type CreateRequirementRequest,
  type ListRequirementsQuery,
  type RequirementMatchesQuery,
  type SendRequirementRequest,
  type SendSkipReason,
  type UpdateRequirementRequest,
} from '@ee/contracts';
import { CLOCK, type Clock } from '../../../platform/auth';
import { DomainError } from '../../../platform/http';
import { NotificationsService } from '../../notifications/application';
import {
  InvalidReferenceError,
  planSend,
  rentalRange,
  REQUIREMENTS_REPOSITORY,
  RequirementAwardedError,
  RequirementClosedError,
  RequirementNotDraftError,
  RequirementNotFoundError,
  type Invitation,
  type Page,
  type ReferenceCodes,
  type Requirement,
  type RequirementFields,
  type RequirementMatch,
  type RequirementsRepository,
  type ResolvedReferences,
} from '../domain';

/** Where suppliers handle incoming requests in the app. */
const SUPPLIER_INBOX_HREF = '/supplier/pipeline';

export interface RequirementDetail {
  requirement: Requirement;
  invitations: Invitation[];
}

export interface SendResult {
  sent: Invitation[];
  skipped: { listingId: string; reason: SendSkipReason }[];
}

@Injectable()
export class RequirementsService {
  constructor(
    @Inject(REQUIREMENTS_REPOSITORY) private readonly repo: RequirementsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly notifications: NotificationsService,
  ) {}

  async create(builderAccountId: string, body: CreateRequirementRequest): Promise<Requirement> {
    const refs = await this.resolve(body);
    const id = await this.repo.create(
      builderAccountId,
      {
        title: body.title,
        categoryId: refs.categoryId!,
        equipmentModelId: refs.equipmentModel?.id ?? null,
        constructionTaskId: refs.constructionTaskId ?? null,
        cityId: refs.cityId!,
        startDate: body.startDate,
        endDate: body.endDate,
        quantity: body.quantity,
        budgetPerDay: body.budgetPerDay ?? null,
        notes: body.notes ?? null,
      },
      this.clock.now(),
    );
    return this.get(builderAccountId, id);
  }

  list(builderAccountId: string, query: ListRequirementsQuery): Promise<Page<Requirement>> {
    return this.repo.list(builderAccountId, query);
  }

  async get(builderAccountId: string, id: string): Promise<Requirement> {
    const requirement = await this.repo.find(builderAccountId, id);
    if (!requirement) throw new RequirementNotFoundError();
    return requirement;
  }

  async detail(builderAccountId: string, id: string): Promise<RequirementDetail> {
    const requirement = await this.get(builderAccountId, id);
    return { requirement, invitations: await this.repo.invitations(id) };
  }

  async update(
    builderAccountId: string,
    id: string,
    body: UpdateRequirementRequest,
  ): Promise<Requirement> {
    const current = await this.get(builderAccountId, id);
    if (current.status !== 'DRAFT') throw new RequirementNotDraftError();

    if (body.startDate !== undefined || body.endDate !== undefined) {
      this.checkDates(body.startDate ?? current.startDate, body.endDate ?? current.endDate);
    }

    const refs = await this.resolve(body, body.categoryCode ? undefined : id);
    const fields: Partial<RequirementFields> = {};
    if (body.title !== undefined) fields.title = body.title;
    if (refs.categoryId) fields.categoryId = refs.categoryId;
    if (body.equipmentModelId !== undefined)
      fields.equipmentModelId = refs.equipmentModel?.id ?? null;
    if (body.constructionTaskCode !== undefined) {
      fields.constructionTaskId = refs.constructionTaskId ?? null;
    }
    if (refs.cityId) fields.cityId = refs.cityId;
    if (body.startDate !== undefined) fields.startDate = body.startDate;
    if (body.endDate !== undefined) fields.endDate = body.endDate;
    if (body.quantity !== undefined) fields.quantity = body.quantity;
    if (body.budgetPerDay !== undefined) fields.budgetPerDay = body.budgetPerDay;
    if (body.notes !== undefined) fields.notes = body.notes;

    // Changing only the category must not leave a model from another category behind.
    if (refs.categoryId && body.equipmentModelId === undefined && current.equipmentModelId) {
      const model = (
        await this.repo.resolveReferences({ equipmentModelId: current.equipmentModelId })
      ).equipmentModel;
      if (model && model.categoryId !== refs.categoryId) throw modelCategoryMismatch();
    }

    await this.repo.update(id, fields, this.clock.now());
    return this.get(builderAccountId, id);
  }

  async matches(
    builderAccountId: string,
    id: string,
    query: RequirementMatchesQuery,
  ): Promise<Page<RequirementMatch>> {
    const requirement = await this.get(builderAccountId, id);
    if (requirement.status !== 'DRAFT' && requirement.status !== 'OPEN') {
      throw new RequirementClosedError();
    }
    return this.repo.matches(
      requirement,
      rentalRange(requirement.startDate, requirement.endDate),
      query,
    );
  }

  async send(
    builderAccountId: string,
    id: string,
    body: SendRequirementRequest,
  ): Promise<SendResult> {
    const now = this.clock.now();
    return this.repo.transaction(async (tx) => {
      const requirement = await this.repo.find(builderAccountId, id, { tx, lock: true });
      if (!requirement) throw new RequirementNotFoundError();
      if (requirement.status !== 'DRAFT' && requirement.status !== 'OPEN') {
        throw new RequirementClosedError();
      }

      const range = rentalRange(requirement.startDate, requirement.endDate);
      const invited = await this.repo.invitedListingIds(id, tx);
      const targets = await this.repo.sendTargets(body.listingIds, range, tx);
      const plan = planSend(body.listingIds, targets, invited);

      const inserted = new Set(
        await this.repo.insertInvitations(
          requirement,
          plan.send.map((t) => t.listingId),
          body.message ?? null,
          now,
          tx,
        ),
      );
      // The requirement row is locked, so a conflict here only comes from a racing
      // insert outside this path; report it the same way as an earlier invitation.
      for (const target of plan.send) {
        if (!inserted.has(target.listingId)) {
          plan.skipped.push({ listingId: target.listingId, reason: 'ALREADY_INVITED' });
        }
      }
      const sentTargets = plan.send.filter((t) => inserted.has(t.listingId));

      if (sentTargets.length > 0 && requirement.status === 'DRAFT') {
        await this.repo.markOpen(id, now, tx);
      }

      await this.notifications.notify(
        sentTargets.map((t) => ({
          accountId: t.supplierAccountId,
          kind: 'REQUEST_RECEIVED',
          title: `New request for ${t.listingTitle}`,
          detail: `${requirement.title} · ${requirement.city.name} · ${requirement.startDate} to ${requirement.endDate}`,
          href: SUPPLIER_INBOX_HREF,
          tone: 'waiting',
        })),
        tx,
      );

      const all = await this.repo.invitations(id, tx);
      return {
        sent: all.filter((inv) => inserted.has(inv.listingId)),
        skipped: plan.skipped,
      };
    });
  }

  async cancel(builderAccountId: string, id: string): Promise<Requirement> {
    const now = this.clock.now();
    await this.repo.transaction(async (tx) => {
      const requirement = await this.repo.find(builderAccountId, id, { tx, lock: true });
      if (!requirement) throw new RequirementNotFoundError();
      if (requirement.status === 'AWARDED') throw new RequirementAwardedError();
      if (requirement.status === 'CANCELLED') throw new RequirementClosedError();

      const withdrawn = await this.repo.cancel(id, now, tx);
      await this.notifications.notify(
        withdrawn.map((w) => ({
          accountId: w.supplierAccountId,
          kind: 'REQUEST_WITHDRAWN',
          title: `Request withdrawn for ${w.listingTitle}`,
          detail: `The builder cancelled "${requirement.title}".`,
          href: SUPPLIER_INBOX_HREF,
          tone: 'neutral',
        })),
        tx,
      );
    });
    return this.get(builderAccountId, id);
  }

  private checkDates(startDate: string, endDate: string): void {
    if (endDate < startDate) {
      throw new DomainError('invalid_dates', 'endDate must not be before startDate');
    }
    if (startDate < todayInRentalZone(this.clock.now())) {
      throw new DomainError('invalid_dates', 'startDate must not be in the past');
    }
    if (rentalDays(startDate, endDate) > MAX_RENTAL_DAYS) {
      throw new DomainError('invalid_dates', `A rental is at most ${MAX_RENTAL_DAYS} days`);
    }
  }

  /**
   * Resolves and validates the reference codes in a create or update body. When the body
   * sets a model without a category, `requirementId` supplies the stored category to check
   * the model against.
   */
  private async resolve(
    codes: ReferenceCodes,
    requirementId?: string,
  ): Promise<ResolvedReferences> {
    const refs = await this.repo.resolveReferences({
      categoryCode: codes.categoryCode,
      equipmentModelId: codes.equipmentModelId ?? undefined,
      constructionTaskCode: codes.constructionTaskCode ?? undefined,
      cityGeoId: codes.cityGeoId,
    });
    if (refs.categoryId === null) {
      throw new InvalidReferenceError('invalid_category', 'Equipment category is unknown');
    }
    if (refs.equipmentModel === null) {
      throw new InvalidReferenceError('invalid_model', 'Equipment model is unknown or not active');
    }
    if (refs.constructionTaskId === null) {
      throw new InvalidReferenceError('invalid_construction_task', 'Construction task is unknown');
    }
    if (refs.cityId === null) {
      throw new InvalidReferenceError('invalid_city', 'City is unknown or not enabled');
    }
    if (refs.equipmentModel) {
      const categoryId =
        refs.categoryId ??
        (requirementId ? await this.repo.categoryIdOf(requirementId) : undefined);
      if (refs.equipmentModel.categoryId !== categoryId) throw modelCategoryMismatch();
    }
    return refs;
  }
}

function modelCategoryMismatch(): InvalidReferenceError {
  return new InvalidReferenceError(
    'model_category_mismatch',
    'Equipment model does not belong to the requirement category',
  );
}
