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
import { IdPipe, notImplemented, ZodValidationPipe } from '../../../platform/http';

@Controller('rental-requests')
@UseGuards(AuthGuard, RolesGuard)
export class RentalRequestsController {
  @Post()
  @Roles('BUILDER')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createRentalRequestSchema)) body: CreateRentalRequest,
  ): Promise<RentalRequestDto> {
    return notImplemented(user, body);
  }

  @Get('mine')
  @Roles('BUILDER')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listMyRentalRequestsQuerySchema)) query: ListMyRentalRequestsQuery,
  ): Promise<RentalRequestPageDto> {
    return notImplemented(user, query);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('BUILDER')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<RentalRequestDto> {
    return notImplemented(user, id);
  }

  @Get('incoming')
  @Roles('SUPPLIER')
  listIncoming(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listIncomingRentalRequestsQuerySchema))
    query: ListIncomingRentalRequestsQuery,
  ): Promise<RentalRequestPageDto> {
    return notImplemented(user, query);
  }

  /** Records the first time the supplier opened the request; later calls are no-ops. */
  @Post(':id/viewed')
  @HttpCode(200)
  @Roles('SUPPLIER')
  markViewed(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
  ): Promise<RentalRequestDto> {
    return notImplemented(user, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('SUPPLIER')
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(rejectRentalRequestSchema)) body: RejectRentalRequest,
  ): Promise<RentalRequestDto> {
    return notImplemented(user, id, body);
  }

  /** The builder who sent it or the supplier who owns the listing. */
  @Get(':id')
  @Roles('BUILDER', 'SUPPLIER')
  get(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<RentalRequestDto> {
    return notImplemented(user, id);
  }
}
