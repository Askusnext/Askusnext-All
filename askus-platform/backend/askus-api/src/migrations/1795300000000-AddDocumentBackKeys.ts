import { MigrationInterface, QueryRunner } from "typeorm";

// Aadhaar and PAN are two-sided documents; aadhaar_key/pan_key already hold the front image,
// these add the matching back-page image key.
export class AddDocumentBackKeys1795300000000 implements MigrationInterface {
    name = 'AddDocumentBackKeys1795300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "aadhaar_back_key" character varying`);
        await queryRunner.query(`ALTER TABLE "identity"."users" ADD "pan_back_key" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "pan_back_key"`);
        await queryRunner.query(`ALTER TABLE "identity"."users" DROP COLUMN "aadhaar_back_key"`);
    }
}
