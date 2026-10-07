import {
  rentalDays,
  type RequirementDetailDto,
  type RequirementDto,
  type RequirementInvitationDto,
  type RequirementMatchDto,
} from '@ee/contracts';
import type { RequirementDetail } from '../application';
import type { Invitation, Requirement, RequirementMatch } from '../domain';

export function toRequirementDto(r: Requirement): RequirementDto {
  return {
    id: r.id,
    status: r.status,
    title: r.title,
    categoryCode: r.categoryCode,
    equipmentModelId: r.equipmentModelId,
    constructionTaskCode: r.constructionTaskCode,
    city: r.city,
    startDate: r.startDate,
    endDate: r.endDate,
    days: rentalDays(r.startDate, r.endDate),
    quantity: r.quantity,
    budgetPerDay: r.budgetPerDay,
    notes: r.notes,
    sentAt: r.sentAt?.toISOString() ?? null,
    awardedQuoteId: r.awardedQuoteId,
    invitationCount: r.invitationCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toInvitationDto(i: Invitation): RequirementInvitationDto {
  return { ...i, viewedAt: i.viewedAt?.toISOString() ?? null };
}

export function toRequirementDetailDto(d: RequirementDetail): RequirementDetailDto {
  return { ...toRequirementDto(d.requirement), invitations: d.invitations.map(toInvitationDto) };
}

export function toMatchDto(m: RequirementMatch): RequirementMatchDto {
  return m;
}
