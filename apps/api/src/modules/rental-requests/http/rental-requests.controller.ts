import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  createRentalRequestSchema,
  listIncomingRentalRequestsQuerySchema,
  listMyRentalRequestsQuerySchema,
  rejectRentalRequestSchema,
  type CreateRentalRequest,
  type ListIncomingRentalRequestsQuery,
  type ListMyRentalRequestsQuery,
  type RejectRentalRequest,
  type RentalRequestDto,
  type RentalRequestPageDto,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { RentalRequestsService } from '../application';

@Controller('rental-requests')
@UseGuards(AuthGuard, RolesGuard)
export class RentalRequestsController {
  constructor(private readonly requests: RentalRequestsService) {}

  @Post()
  @Roles('BUILDER')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createRentalRequestSchema)) body: CreateRentalRequest,
  ): Promise<RentalRequestDto> {
    return this.requests.create(user.accountId, body);
  }

  @Get('mine')
  @Roles('BUILDER')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listMyRentalRequestsQuerySchema)) query: ListMyRentalRequestsQuery,
  ): Promise<RentalRequestPageDto> {
    return this.requests.listMine(user.accountId, query);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('BUILDER')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<RentalRequestDto> {
    return this.requests.cancel(user.accountId, id);
  }

  @Get('incoming')
  @Roles('SUPPLIER')
  listIncoming(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listIncomingRentalRequestsQuerySchema))
    query: ListIncomingRentalRequestsQuery,
  ): Promise<RentalRequestPageDto> {
    return this.requests.listIncoming(user.accountId, query);
  }

  /** Records the first time the supplier opened the request; later calls are no-ops. */
  @Post(':id/viewed')
  @HttpCode(200)
  @Roles('SUPPLIER')
  markViewed(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<RentalRequestDto> {
    return this.requests.markViewed(user.accountId, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('SUPPLIER')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(rejectRentalRequestSchema)) body: RejectRentalRequest,
  ): Promise<RentalRequestDto> {
    return this.requests.reject(user.accountId, id, body);
  }

  /** The builder who sent it or the supplier who owns the listing. */
  @Get(':id')
  @Roles('BUILDER', 'SUPPLIER')
  get(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<RentalRequestDto> {
    return this.requests.getFor(
      user.role === 'BUILDER' ? 'BUILDER' : 'SUPPLIER',
      user.accountId,
      id,
    );
  }
}
