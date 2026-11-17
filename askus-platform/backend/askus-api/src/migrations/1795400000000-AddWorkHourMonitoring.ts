import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkHourMonitoring1795400000000 implements MigrationInterface {
    name = 'AddWorkHourMonitoring1795400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "solutions"."activity_heartbeats" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "device_id" character varying(100) NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "idle_flag" boolean NOT NULL DEFAULT false, "source" character varying NOT NULL DEFAULT 'agent', "active_app" character varying(120), CONSTRAINT "PK_1b087d4fd8537ad8d4dfc3d7979" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8dba345e8d2dfc030c45fbe13a" ON "solutions"."activity_heartbeats" ("timestamp") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bc2e2f59e1be52852bcc75bad4" ON "solutions"."activity_heartbeats" ("user_id", "device_id", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_8787b3bb0e9d19610511328887" ON "solutions"."activity_heartbeats" ("user_id", "timestamp") `);
        await queryRunner.query(`CREATE TABLE "solutions"."activity_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "day" character varying(10) NOT NULL, "start_time" TIMESTAMP WITH TIME ZONE NOT NULL, "end_time" TIMESTAMP WITH TIME ZONE NOT NULL, "active_seconds" integer NOT NULL DEFAULT '0', "idle_seconds" integer NOT NULL DEFAULT '0', "source" character varying NOT NULL DEFAULT 'agent', "open" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_5ef2bc4b70134d1cf3e5b093fae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9be8462c143adf211b7c00d529" ON "solutions"."activity_sessions" ("user_id", "day") `);
        await queryRunner.query(`CREATE TABLE "solutions"."daily_summary" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "date" character varying(10) NOT NULL, "total_active_minutes" integer NOT NULL DEFAULT '0', "total_idle_minutes" integer NOT NULL DEFAULT '0', "first_activity" TIMESTAMP WITH TIME ZONE, "last_activity" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_025bce0d99d13eeee6883b7f184" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_90293fccc2efdf2c8617c56610" ON "solutions"."daily_summary" ("date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_30f0a48867f035381dd3ad70e8" ON "solutions"."daily_summary" ("user_id", "date") `);
        await queryRunner.query(`CREATE TABLE "solutions"."device_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "device_id" character varying(100) NOT NULL, "device_name" character varying(120), "token_hash" character varying(64) NOT NULL, "platform" character varying NOT NULL DEFAULT 'windows', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_seen_at" TIMESTAMP WITH TIME ZONE, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5c9204ea7007b8cc9ba8553497" ON "solutions"."device_tokens" ("token_hash") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f11adc06aa35ccaa9caa2f079f" ON "solutions"."device_tokens" ("user_id", "device_id") `);
        await queryRunner.query(`CREATE TABLE "solutions"."agent_pairing_codes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_60c3661a1ec06c0555de867fa57" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c49a9f2588a887b28a0d3238de" ON "solutions"."agent_pairing_codes" ("code_hash") `);
        await queryRunner.query(`CREATE TABLE "solutions"."monitoring_consents" ("user_id" uuid NOT NULL, "policy_version" character varying(20) NOT NULL, "consent_accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8d7f6fe66598f9d97fa2a569c73" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TABLE "solutions"."monitoring_settings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "scope" character varying NOT NULL, "target" character varying NOT NULL, "target_minutes_per_day" integer, "tracking_method" character varying, CONSTRAINT "PK_273d007cba08ed8771c0ea88d70" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_74b46e160e1260efdcf771c60a" ON "solutions"."monitoring_settings" ("scope", "target") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "solutions"."IDX_74b46e160e1260efdcf771c60a"`);
        await queryRunner.query(`DROP TABLE "solutions"."monitoring_settings"`);
        await queryRunner.query(`DROP TABLE "solutions"."monitoring_consents"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_c49a9f2588a887b28a0d3238de"`);
        await queryRunner.query(`DROP TABLE "solutions"."agent_pairing_codes"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_f11adc06aa35ccaa9caa2f079f"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_5c9204ea7007b8cc9ba8553497"`);
        await queryRunner.query(`DROP TABLE "solutions"."device_tokens"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_30f0a48867f035381dd3ad70e8"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_90293fccc2efdf2c8617c56610"`);
        await queryRunner.query(`DROP TABLE "solutions"."daily_summary"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_9be8462c143adf211b7c00d529"`);
        await queryRunner.query(`DROP TABLE "solutions"."activity_sessions"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_8787b3bb0e9d19610511328887"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_bc2e2f59e1be52852bcc75bad4"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_8dba345e8d2dfc030c45fbe13a"`);
        await queryRunner.query(`DROP TABLE "solutions"."activity_heartbeats"`);
    }

}
