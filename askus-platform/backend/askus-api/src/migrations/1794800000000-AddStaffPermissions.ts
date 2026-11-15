import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStaffPermissions1794800000000 implements MigrationInterface {
    name = 'AddStaffPermissions1794800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "permissions" text NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "aadhaar_key" character varying`);
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "created_by" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "aadhaar_key"`);
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "permissions"`);
    }
}
