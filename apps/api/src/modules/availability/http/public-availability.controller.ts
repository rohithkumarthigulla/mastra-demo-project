import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  calendarRangeQuerySchema,
  type CalendarRangeQuery,
  type ListingAvailabilityDto,
} from '@ee/contracts';
import { ZodValidationPipe } from '../../../platform/http';
import { AvailabilityService } from '../application';
import { PublicListingIdPipe } from './dto';

/** No sign-in; exposes counts only, never which machines or why. */
@Controller('equipment-listings')
export class PublicListingAvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get(':id/availability')
  listingAvailability(
    @Param('id', PublicListingIdPipe) id: string,
    @Query(new ZodValidationPipe(calendarRangeQuerySchema)) query: CalendarRangeQuery,
  ): Promise<ListingAvailabilityDto> {
    return this.availability.listingAvailability(id, {
      start: new Date(query.from),
      end: new Date(query.to),
    });
  }
}
