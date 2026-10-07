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
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { BookingsService } from '../application';
import type { BookingViewer } from '../infrastructure/booking.reader';

const viewerOf = (user: AuthUser): BookingViewer => ({
  role: user.role === 'BUILDER' ? 'BUILDER' : 'SUPPLIER',
  accountId: user.accountId,
});
const supplier = (user: AuthUser): BookingViewer => ({
  role: 'SUPPLIER',
  accountId: user.accountId,
});

@Controller('bookings')
@UseGuards(AuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('supplier')
  @Roles('SUPPLIER')
  listForSupplier(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listBookingsQuerySchema)) query: ListBookingsQuery,
  ): Promise<BookingPageDto> {
    return this.bookings.list(supplier(user), query);
  }

  @Get('builder')
  @Roles('BUILDER')
  listForBuilder(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listBookingsQuerySchema)) query: ListBookingsQuery,
  ): Promise<BookingPageDto> {
    return this.bookings.list({ role: 'BUILDER', accountId: user.accountId }, query);
  }

  @Get(':id')
  @Roles('BUILDER', 'SUPPLIER')
  get(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return this.bookings.get(viewerOf(user), id);
  }

  /** `CONFIRMED` → `OUT_FOR_DELIVERY`. */
  @Post(':id/dispatch')
  @HttpCode(200)
  @Roles('SUPPLIER')
  dispatch(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return this.bookings.transition(supplier(user), id, 'dispatch');
  }

  /** `OUT_FOR_DELIVERY` → `ON_RENT`. */
  @Post(':id/start-rent')
  @HttpCode(200)
  @Roles('SUPPLIER')
  startRent(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return this.bookings.transition(supplier(user), id, 'start-rent');
  }

  /** `ON_RENT` → `RETURNED`. */
  @Post(':id/complete')
  @HttpCode(200)
  @Roles('SUPPLIER')
  complete(@CurrentUser() user: AuthUser, @Param('id', IdPipe) id: string): Promise<BookingDto> {
    return this.bookings.transition(supplier(user), id, 'complete');
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
    return this.bookings.transition(viewerOf(user), id, 'cancel', body.reason);
  }
}
