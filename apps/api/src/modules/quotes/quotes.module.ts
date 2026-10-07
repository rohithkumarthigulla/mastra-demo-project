import { Module } from '@nestjs/common';
import { QuotesController } from './http';

@Module({ controllers: [QuotesController] })
export class QuotesModule {}
