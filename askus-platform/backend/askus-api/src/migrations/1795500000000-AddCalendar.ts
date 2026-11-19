import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCalendar1795500000000 implements MigrationInterface {
    name = 'AddCalendar1795500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "solutions"."calendar_connections" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "provider" character varying NOT NULL, "account_email" character varying, "oauth_token" text NOT NULL, "refresh_token" text, "token_expires_at" TIMESTAMP WITH TIME ZONE, "status" character varying NOT NULL DEFAULT 'active', "last_sync_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c2f78ae03c2e2a9389f6d8ddc64" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8c23050adbd338801ce63f422e" ON "solutions"."calendar_connections" ("user_id", "provider") `);
        await queryRunner.query(`CREATE TABLE "solutions"."meetings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "title" character varying(300) NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE NOT NULL, "source" character varying NOT NULL DEFAULT 'manual', "visibility_scope" character varying NOT NULL DEFAULT 'team', "provider" character varying, "external_id" character varying, "created_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_aa73be861afa77eb4ed31f3ed57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d0c9893d0ba07902153ccfb857" ON "solutions"."meetings" ("user_id", "provider", "external_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_af2f0ba92fdea504d02313ff65" ON "solutions"."meetings" ("user_id", "start_time") `);
        await queryRunner.query(`CREATE TABLE "solutions"."meeting_attendees" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "meeting_id" uuid NOT NULL, "employee_id" uuid, "email" character varying(254), "name" character varying(200), CONSTRAINT "PK_b49884a61337dbfb2f3018710da" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ae9f13b5157cf8cb17235cfbdb" ON "solutions"."meeting_attendees" ("employee_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8643679c49d7234b266433bc20" ON "solutions"."meeting_attendees" ("meeting_id") `);
        await queryRunner.query(`CREATE TABLE "solutions"."activity_feed" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "type" character varying NOT NULL, "ref_id" uuid NOT NULL, "date" character varying(10) NOT NULL, CONSTRAINT "PK_b772f66cacd352e98fba04a7b8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_650ec5eb03f650e381ca077f3c" ON "solutions"."activity_feed" ("date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_04c36cd07601830ccc02e4a276" ON "solutions"."activity_feed" ("user_id", "type", "ref_id", "date") `);
        await queryRunner.query(`CREATE TABLE "solutions"."team_members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "team" character varying NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_ca3eae89dcf20c9fd95bf7460aa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b55423f5fae3049dd94ce5a983" ON "solutions"."team_members" ("team", "user_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "solutions"."IDX_b55423f5fae3049dd94ce5a983"`);
        await queryRunner.query(`DROP TABLE "solutions"."team_members"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_04c36cd07601830ccc02e4a276"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_650ec5eb03f650e381ca077f3c"`);
        await queryRunner.query(`DROP TABLE "solutions"."activity_feed"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_8643679c49d7234b266433bc20"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_ae9f13b5157cf8cb17235cfbdb"`);
        await queryRunner.query(`DROP TABLE "solutions"."meeting_attendees"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_af2f0ba92fdea504d02313ff65"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_d0c9893d0ba07902153ccfb857"`);
        await queryRunner.query(`DROP TABLE "solutions"."meetings"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_8c23050adbd338801ce63f422e"`);
        await queryRunner.query(`DROP TABLE "solutions"."calendar_connections"`);
    }

}
