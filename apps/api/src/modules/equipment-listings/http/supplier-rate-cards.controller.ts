import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { putRateCardSchema, type PutRateCardRequest, type RateCardDto } from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, notImplemented, ZodValidationPipe } from '../../../platform/http';

@Controller('supplier/listings/:id/rate-card')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierRateCardsController {
  @Get()
  get(@CurrentUser() user: AuthUser, @Param('id', IdPipe) listingId: string): Promise<RateCardDto> {
    return notImplemented(user, listingId);
  }

  @Put()
  put(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) listingId: string,
    @Body(new ZodValidationPipe(putRateCardSchema)) body: PutRateCardRequest,
  ): Promise<RateCardDto> {
    return notImplemented(user, listingId, body);
  }
}
