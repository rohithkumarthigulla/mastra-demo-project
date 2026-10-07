import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createSupplierProfileRequestSchema,
  updateSupplierProfileRequestSchema,
  type CreateSupplierProfileRequest,
  type SupplierProfileDto,
  type UpdateSupplierProfileRequest,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { SupplierProfileService } from '../application';
import type { SupplierProfile } from '../domain';

function toDto(profile: SupplierProfile): SupplierProfileDto {
  return {
    id: profile.id,
    accountId: profile.accountId,
    displayName: profile.displayName,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

@Controller('supplier-profile')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierProfileController {
  constructor(private readonly profiles: SupplierProfileService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser): Promise<SupplierProfileDto> {
    return toDto(await this.profiles.get(user.accountId));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSupplierProfileRequestSchema))
    body: CreateSupplierProfileRequest,
  ): Promise<SupplierProfileDto> {
    return toDto(await this.profiles.create(user.accountId, body.displayName));
  }

  @Patch()
  async update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateSupplierProfileRequestSchema))
    body: UpdateSupplierProfileRequest,
  ): Promise<SupplierProfileDto> {
    return toDto(await this.profiles.update(user.accountId, body.displayName));
  }
}
