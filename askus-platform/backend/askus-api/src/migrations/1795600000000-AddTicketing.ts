import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTicketing1795600000000 implements MigrationInterface {
    name = 'AddTicketing1795600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "solutions"."ticket_history" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ticket_id" uuid NOT NULL, "changed_by_id" uuid, "changed_by_name" character varying NOT NULL, "field_changed" character varying NOT NULL, "old_value" text, "new_value" text, "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6d0f4bc32cc3581d6a016bca30a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_369eedc575788b9f9e8667017b" ON "solutions"."ticket_history" ("ticket_id") `);
        await queryRunner.query(`CREATE TABLE "solutions"."ticket_comments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ticket_id" uuid NOT NULL, "user_id" uuid, "user_name" character varying NOT NULL, "body" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_811ed3b81dd8df6b9a92058d89c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4ee48e3e18e7c3ac35152a9fb7" ON "solutions"."ticket_comments" ("ticket_id") `);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" ADD "created_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" ADD "resolved_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" ADD "closed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" ADD "renewal_of_id" uuid`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" ADD "renewal_for" character varying`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_f131b2269095005a89841a11e4" ON "solutions"."tickets" ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_70744799e77cf62e0963b43b3d" ON "solutions"."tickets" ("renewal_of_id") `);
        // The old 'Completed' status is now 'Resolved'; fill in the new timestamps for tickets that were already finished.
        await queryRunner.query(`UPDATE "solutions"."tickets" SET "status" = 'Resolved' WHERE "status" = 'Completed'`);
        await queryRunner.query(`UPDATE "solutions"."tickets" SET "resolved_at" = "updated_at" WHERE "status" = 'Resolved' AND "resolved_at" IS NULL`);
        await queryRunner.query(`UPDATE "solutions"."tickets" SET "closed_at" = "updated_at", "resolved_at" = COALESCE("resolved_at", "updated_at") WHERE "status" = 'Closed' AND "closed_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "solutions"."tickets" SET "status" = 'Completed' WHERE "status" IN ('Resolved', 'AwaitingResponse', 'Reopened')`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_70744799e77cf62e0963b43b3d"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_f131b2269095005a89841a11e4"`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" DROP COLUMN "renewal_for"`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" DROP COLUMN "renewal_of_id"`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" DROP COLUMN "closed_at"`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" DROP COLUMN "resolved_at"`);
        await queryRunner.query(`ALTER TABLE "solutions"."tickets" DROP COLUMN "created_by_id"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_4ee48e3e18e7c3ac35152a9fb7"`);
        await queryRunner.query(`DROP TABLE "solutions"."ticket_comments"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_369eedc575788b9f9e8667017b"`);
        await queryRunner.query(`DROP TABLE "solutions"."ticket_history"`);
    }

}
