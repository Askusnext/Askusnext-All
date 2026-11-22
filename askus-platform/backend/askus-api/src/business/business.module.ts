import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { SCHEMA_SQL } from './schema';
import { seedBusinessDemo } from './seed';

/**
 * Business Suite (Sales, Customers, Policies, Staff, Money, Settings) in the `business` schema.
 * Production applies the schema with the AddBusinessSuite migration. Outside production the module creates it
 * on start-up (all statements are idempotent) and, when the tables are empty, loads sample data unless
 * BUSINESS_DEMO_SEED=false.
 */
@Module({
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule implements OnModuleInit {
  private readonly log = new Logger('Business');
  constructor(private readonly db: DataSource, private readonly svc: BusinessService, private readonly config: ConfigService) {}

  async onModuleInit() {
    if (this.config.get('NODE_ENV') === 'production') return;
    for (const sql of SCHEMA_SQL) await this.db.query(sql);
    if (this.config.get('BUSINESS_DEMO_SEED') === 'false') return;
    const [{ n }] = await this.db.query('SELECT count(*)::int AS n FROM business.employees');
    if (n > 0) return;
    const started = Date.now();
    const count = await seedBusinessDemo(this.svc, this.db);
    this.log.log(`Loaded ${count} sample records in ${Date.now() - started} ms`);
  }
}
