import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  cancelBookingSchema,
  listBookingsQuerySchema,
  type BookingDto,
  type BookingPageDto,
  type CancelBookingRequest,
  type ListBookingsQuery,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, notImplemented, ZodValidationPipe } from '../../../platform/http';

@Controller('bookings')
@UseGuards(AuthGuard, RolesGuard)
export class BookingsController {
  @Get('supplier')
  @Roles('SUPPLIER')
  listForSupplier(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listBookingsQuerySchema)) query: ListBookingsQuery,
  ): Promise<BookingPageDto> {
    return notImplemented(user, query);
  }

  @Get('builder')
  @Roles('BUILDER')
  listForBuilder(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listBookingsQuerySchema)) query: ListBookingsQuery,
  ): Promise<BookingPageDto> {
    return notImplemented(user, query);
  }

  @Get(':id')
  @Roles('BUILDER', 'SUPPLIER')
  get(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return notImplemented(user, id);
  }

  /** `CONFIRMED` → `OUT_FOR_DELIVERY`. */
  @Post(':id/dispatch')
  @HttpCode(200)
  @Roles('SUPPLIER')
  dispatch(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return notImplemented(user, id);
  }

  /** `OUT_FOR_DELIVERY` → `ON_RENT`. */
  @Post(':id/start-rent')
  @HttpCode(200)
  @Roles('SUPPLIER')
  startRent(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return notImplemented(user, id);
  }

  /** `ON_RENT` → `RETURNED`. */
  @Post(':id/complete')
  @HttpCode(200)
  @Roles('SUPPLIER')
  complete(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return notImplemented(user, id);
  }

  /** Allowed from `CONFIRMED` or `OUT_FOR_DELIVERY` only. */
  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('BUILDER', 'SUPPLIER')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(cancelBookingSchema)) body: CancelBookingRequest,
  ): Promise<BookingDto> {
    return notImplemented(user, id, body);
  }
}
