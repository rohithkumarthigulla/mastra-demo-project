import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  browseListingsQuerySchema,
  type BrowseListingsQuery,
  type EquipmentListingDto,
  type EquipmentListingPageDto,
} from '@ee/contracts';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentListingsService, ListingMediaService } from '../application';
import { ListingIdPipe, toListingDto, toListingPageDto } from './dto';
import { MediaIdPipe } from './media-dto';
import { OptionalAuthGuard } from './optional-auth.guard';

/** Public browsing: only ACTIVE listings are visible and no sign-in is needed. */
@Controller('equipment-listings')
export class PublicListingsController {
  constructor(
    private readonly listings: EquipmentListingsService,
    private readonly media: ListingMediaService,
  ) {}

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

  /** Photos of ACTIVE listings are public; the owning supplier can also see the rest. */
  @Get(':id/media/:mediaId')
  @UseGuards(OptionalAuthGuard)
  async photo(
    @Param('id', ListingIdPipe) id: string,
    @Param('mediaId', MediaIdPipe) mediaId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const { media, data, listingStatus } = await this.media.open(id, mediaId, request.user);
    reply
      .header('Content-Type', media.mimeType)
      .header('Content-Length', data.length)
      .header('X-Content-Type-Options', 'nosniff')
      .header(
        'Cache-Control',
        listingStatus === 'ACTIVE' ? 'public, max-age=300' : 'private, no-store',
      );
    return data;
  }
}
