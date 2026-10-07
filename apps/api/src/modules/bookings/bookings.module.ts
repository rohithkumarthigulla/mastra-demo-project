import { Module } from '@nestjs/common';
import { BookingsController } from './http';

@Module({ controllers: [BookingsController] })
export class BookingsModule {}
