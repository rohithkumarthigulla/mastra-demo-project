import { Controller, Get, Header } from '@nestjs/common';
import type { PublicReferenceDto } from '@ee/contracts';
import { ReferenceService } from '../application';

/** Unauthenticated lookups the client needs before sign-in (sign-up forms, city pickers). */
@Controller('public')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  @Get('reference')
  @Header('Cache-Control', 'public, max-age=300')
  getReference(): Promise<PublicReferenceDto> {
    return this.reference.getPublicReference();
  }
}
