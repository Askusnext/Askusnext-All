import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordLogin1794742232816 implements MigrationInterface {
    name = 'AddPasswordLogin1794742232816'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "identity"."users"
            ADD "password_hash" character varying
        `);
        await queryRunner.query(`
            ALTER TABLE "identity"."users"
            ADD "failed_logins" integer NOT NULL DEFAULT '0'
        `);
        await queryRunner.query(`
            ALTER TABLE "identity"."users"
            ADD "locked_until" TIMESTAMP WITH TIME ZONE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "identity"."users" DROP COLUMN "locked_until"
        `);
        await queryRunner.query(`
            ALTER TABLE "identity"."users" DROP COLUMN "failed_logins"
        `);
        await queryRunner.query(`
            ALTER TABLE "identity"."users" DROP COLUMN "password_hash"
        `);
    }

}
