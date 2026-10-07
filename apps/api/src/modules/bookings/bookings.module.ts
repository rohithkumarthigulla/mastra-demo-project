import { Module } from '@nestjs/common';
import { BookingsService } from './application';
import { BookingsController } from './http';

@Module({ controllers: [BookingsController], providers: [BookingsService] })
export class BookingsModule {}
