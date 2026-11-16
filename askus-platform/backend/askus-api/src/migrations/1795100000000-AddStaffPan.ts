import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStaffPan1795100000000 implements MigrationInterface {
    name = 'AddStaffPan1795100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "pan_number" character varying`);
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "pan_key" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "pan_key"`);
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "pan_number"`);
    }
}
