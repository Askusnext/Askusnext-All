import { Controller, Get } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { CustomerModule } from './customer/customer.module';
import { IdentityModule } from './identity/identity.module';
import { InsuranceModule } from './insurance/insurance.module';
import { LoansModule } from './loans/loans.module';
import { NotificationModule } from './notification/notification.module';
import { OrganicModule } from './organic/organic.module';
import { ReportingModule } from './reporting/reporting.module';
import { SnakeNamingStrategy } from './common/snake-naming.strategy';
import { SolutionsModule } from './solutions/solutions.module';
import { StorageModule } from './storage/storage.module';
import { TaxiModule } from './taxi/taxi.module';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        ssl: config.get('DATABASE_SSL') === 'true' ? { rejectUnauthorized: true } : false,
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        uuidExtension: 'pgcrypto' as const,
        // Dev only; use migrations in production.
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    IdentityModule,
    CustomerModule,
    AdminModule,
    AuditModule,
    NotificationModule,
    StorageModule,
    TaxiModule,
    InsuranceModule,
    LoansModule,
    OrganicModule,
    ReportingModule,
    SolutionsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
