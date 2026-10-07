import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { putRateCardSchema, type PutRateCardRequest, type RateCardDto } from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { IdPipe, ZodValidationPipe } from '../../../platform/http';
import { RateCardsService } from '../application';

@Controller('supplier/listings/:id/rate-card')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierRateCardsController {
  constructor(private readonly rateCards: RateCardsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('id', IdPipe) listingId: string): Promise<RateCardDto> {
    return this.rateCards.get(user.accountId, listingId);
  }

  @Put()
  put(
    @CurrentUser() user: AuthUser,
    @Param('id', IdPipe) listingId: string,
    @Body(new ZodValidationPipe(putRateCardSchema)) body: PutRateCardRequest,
  ): Promise<RateCardDto> {
    return this.rateCards.put(user.accountId, listingId, body);
  }
}
