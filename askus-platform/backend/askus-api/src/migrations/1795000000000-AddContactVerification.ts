import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactVerification1795000000000 implements MigrationInterface {
    name = 'AddContactVerification1795000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "mobile_verified_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "email_verified_at"`);
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "mobile_verified_at"`);
    }
}
