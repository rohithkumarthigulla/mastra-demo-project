import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  reorderListingMediaRequestSchema,
  type ListingMediaDto,
  type ListingMediaListDto,
  type ReorderListingMediaRequest,
} from '@ee/contracts';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { ENV, type Env } from '../../../platform/config';
import { ZodValidationPipe } from '../../../platform/http';
import { ListingMediaService, type UploadedFile } from '../application';
import { InvalidUploadError, MediaTooLargeError, MissingFileError } from '../domain';
import { ListingIdPipe } from './dto';
import { MediaIdPipe, toMediaDto, toMediaListDto } from './media-dto';

@Controller('supplier/listings/:id/media')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierListingMediaController {
  constructor(
    private readonly media: ListingMediaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post()
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ListingIdPipe) id: string,
    @Req() request: FastifyRequest,
  ): Promise<ListingMediaDto> {
    const file = await this.readFile(request);
    return toMediaDto(await this.media.upload(user.accountId, id, file));
  }

  @Put('order')
  async reorder(
    @CurrentUser() user: AuthUser,
    @Param('id', ListingIdPipe) id: string,
    @Body(new ZodValidationPipe(reorderListingMediaRequestSchema)) body: ReorderListingMediaRequest,
  ): Promise<ListingMediaListDto> {
    return toMediaListDto(await this.media.reorder(user.accountId, id, body.mediaIds));
  }

  @Delete(':mediaId')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ListingIdPipe) id: string,
    @Param('mediaId', MediaIdPipe) mediaId: string,
  ): Promise<void> {
    await this.media.remove(user.accountId, id, mediaId);
  }

  private async readFile(request: FastifyRequest): Promise<UploadedFile> {
    if (!request.isMultipart()) throw new MissingFileError();
    const tooLarge = new MediaTooLargeError(this.env.LISTING_MEDIA_MAX_BYTES);
    try {
      const part = await request.file();
      if (!part) throw new MissingFileError();
      const data = await part.toBuffer();
      if (part.file.truncated) throw tooLarge;
      return { filename: part.filename, data };
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error)) throw error;
      switch (error.code) {
        case 'FST_REQ_FILE_TOO_LARGE':
          throw tooLarge;
        case 'FST_FILES_LIMIT':
        case 'FST_FIELDS_LIMIT':
        case 'FST_PARTS_LIMIT':
          throw new InvalidUploadError('Send exactly one photo and no other fields');
        case 'FST_INVALID_MULTIPART_CONTENT_TYPE':
          throw new MissingFileError();
        default:
          throw error;
      }
    }
  }
}
