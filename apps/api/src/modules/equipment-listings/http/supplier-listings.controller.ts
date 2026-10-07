import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createListingRequestSchema,
  listSupplierListingsQuerySchema,
  updateListingRequestSchema,
  type CreateListingRequest,
  type EquipmentListingDto,
  type EquipmentListingPageDto,
  type ListSupplierListingsQuery,
  type UpdateListingRequest,
} from '@ee/contracts';
import { AuthGuard, CurrentUser, Roles, RolesGuard, type AuthUser } from '../../../platform/auth';
import { ZodValidationPipe } from '../../../platform/http';
import { EquipmentListingsService } from '../application';
import { ListingIdPipe, toListingDto, toListingPageDto } from './dto';

@Controller('supplier/listings')
@UseGuards(AuthGuard, RolesGuard)
@Roles('SUPPLIER')
export class SupplierListingsController {
  constructor(private readonly listings: EquipmentListingsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(listSupplierListingsQuerySchema)) query: ListSupplierListingsQuery,
  ): Promise<EquipmentListingPageDto> {
    return toListingPageDto(await this.listings.listOwn(user.accountId, query), query);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createListingRequestSchema)) body: CreateListingRequest,
  ): Promise<EquipmentListingDto> {
    return toListingDto(await this.listings.create(user.accountId, body));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', ListingIdPipe) id: string,
  ): Promise<EquipmentListingDto> {
    return toListingDto(await this.listings.getOwn(user.accountId, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ListingIdPipe) id: string,
    @Body(new ZodValidationPipe(updateListingRequestSchema)) body: UpdateListingRequest,
  ): Promise<EquipmentListingDto> {
    return toListingDto(await this.listings.update(user.accountId, id, body));
  }

  @Post(':id/publish')
  @HttpCode(200)
  async publish(
    @CurrentUser() user: AuthUser,
    @Param('id', ListingIdPipe) id: string,
  ): Promise<EquipmentListingDto> {
    return toListingDto(await this.listings.publish(user.accountId, id));
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  async deactivate(
    @CurrentUser() user: AuthUser,
    @Param('id', ListingIdPipe) id: string,
  ): Promise<EquipmentListingDto> {
    return toListingDto(await this.listings.deactivate(user.accountId, id));
  }
}
