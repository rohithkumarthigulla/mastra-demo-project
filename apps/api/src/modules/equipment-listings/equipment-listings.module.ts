import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../platform/config';
import { EquipmentListingsService, ListingMediaService, RateCardsService } from './application';
import {
  EQUIPMENT_LISTING_REPOSITORY,
  LISTING_MEDIA_REPOSITORY,
  LISTING_MEDIA_STORAGE,
} from './domain';
import {
  OptionalAuthGuard,
  PublicListingsController,
  SupplierListingMediaController,
  SupplierListingsController,
  SupplierRateCardsController,
} from './http';
import {
  DrizzleEquipmentListingsRepository,
  DrizzleListingMediaRepository,
  LocalDiskMediaStorage,
} from './infrastructure';

@Module({
  controllers: [
    SupplierListingsController,
    SupplierListingMediaController,
    PublicListingsController,
    SupplierRateCardsController,
  ],
  providers: [
    EquipmentListingsService,
    ListingMediaService,
    RateCardsService,
    OptionalAuthGuard,
    { provide: EQUIPMENT_LISTING_REPOSITORY, useClass: DrizzleEquipmentListingsRepository },
    { provide: LISTING_MEDIA_REPOSITORY, useClass: DrizzleListingMediaRepository },
    {
      provide: LISTING_MEDIA_STORAGE,
      useFactory: (env: Env) => new LocalDiskMediaStorage(env.LISTING_MEDIA_DIR),
      inject: [ENV],
    },
  ],
})
export class EquipmentListingsModule {}
