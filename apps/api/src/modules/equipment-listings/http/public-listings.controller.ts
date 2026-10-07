import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  browseListingsQuerySchema,
  type BrowseListingsQuery,
  type EquipmentListingDto,
  type EquipmentListingPageDto,
} from '@ee/contracts';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentListingsService } from '../application';
import { ListingIdPipe, toListingDto, toListingPageDto } from './dto';

/** Public browsing: only ACTIVE listings are visible and no sign-in is needed. */
@Controller('equipment-listings')
export class PublicListingsController {
  constructor(private readonly listings: EquipmentListingsService) {}

  @Get()
  async browse(
    @Query(new ZodValidationPipe(browseListingsQuerySchema)) query: BrowseListingsQuery,
  ): Promise<EquipmentListingPageDto> {
    return toListingPageDto(await this.listings.browse(query), query);
  }

  @Get(':id')
  async get(@Param('id', ListingIdPipe) id: string): Promise<EquipmentListingDto> {
    return toListingDto(await this.listings.getPublic(id));
  }
}
