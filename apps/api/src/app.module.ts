import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule, type Env } from './platform/config';
import { AuthModule } from './platform/auth';
import { DatabaseModule } from './platform/database';
import { AccountsModule } from './modules/accounts/accounts.module';
import { SupplierProfilesModule } from './modules/supplier-profiles/supplier-profiles.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { HealthModule } from './modules/health/health.module';
import { EquipmentKnowledgeModule } from './modules/equipment-knowledge/equipment-knowledge.module';
import { EquipmentListingsModule } from './modules/equipment-listings/equipment-listings.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { RentalRequestsModule } from './modules/rental-requests/rental-requests.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { RequirementsModule } from './modules/requirements/requirements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AiModule } from './modules/ai/ai.module';
import { EquipmentAssistantModule } from './modules/equipment-assistant/equipment-assistant.module';
import { SupplierAgentModule } from './modules/supplier-agent/supplier-agent.module';

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(env),
        DatabaseModule,
        AuthModule,
        AccountsModule,
        SupplierProfilesModule,
        ReferenceModule,
        HealthModule,
        EquipmentKnowledgeModule,
        EquipmentListingsModule,
        FleetModule,
        AvailabilityModule,
        RentalRequestsModule,
        QuotesModule,
        BookingsModule,
        RequirementsModule,
        NotificationsModule,
        AiModule,
        EquipmentAssistantModule,
        SupplierAgentModule,
      ],
    };
  }
}
