import { Module } from '@nestjs/common';
import { QuotesService } from './application';
import { QuotesController } from './http';

@Module({ controllers: [QuotesController], providers: [QuotesService] })
export class QuotesModule {}
