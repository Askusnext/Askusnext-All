import { MigrationInterface, QueryRunner } from "typeorm";

export class AddApprovalStatus1794900000000 implements MigrationInterface {
    name = 'AddApprovalStatus1794900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "approval_status" character varying NOT NULL DEFAULT 'APPROVED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "approval_status"`);
    }
}
