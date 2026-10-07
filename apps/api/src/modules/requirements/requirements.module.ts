import { Module } from '@nestjs/common';
import { RequirementsController } from './http';

@Module({ controllers: [RequirementsController] })
export class RequirementsModule {}
