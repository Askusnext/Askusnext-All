import { MigrationInterface, QueryRunner } from 'typeorm';
import { DROP_SQL, SCHEMA_SQL } from '../business/schema';

/** Business Suite tables, relationships, constraints, indexes and updated_at triggers in the `business` schema. */
export class AddBusinessSuite1795900000000 implements MigrationInterface {
  name = 'AddBusinessSuite1795900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of SCHEMA_SQL) await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const sql of DROP_SQL) await queryRunner.query(sql);
  }
}
