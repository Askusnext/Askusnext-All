import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTrackingActivityAssignment1794747244618 implements MigrationInterface {
    name = 'AddTrackingActivityAssignment1794747244618'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "solutions"."tracking_consents" ("user_id" uuid NOT NULL, "version" character varying NOT NULL, "accepted_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f4b0f6780eec06f94c7515682b8" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TABLE "solutions"."work_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "day" character varying NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, "end_reason" character varying, "start_lat" double precision, "start_lng" double precision, "start_accuracy" double precision, "end_lat" double precision, "end_lng" double precision, "last_ping_at" TIMESTAMP WITH TIME ZONE, "last_lat" double precision, "last_lng" double precision, "last_accuracy" double precision, "last_state" character varying NOT NULL DEFAULT 'active', CONSTRAINT "PK_2b15ef494243f1cc2bf0f731e76" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4dfb452d1af3bae42593301098" ON "solutions"."work_sessions" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c01461932a41e4057310b461e1" ON "solutions"."work_sessions" ("user_id", "day") `);
        await queryRunner.query(`CREATE TABLE "solutions"."location_pings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "session_id" uuid NOT NULL, "user_id" uuid NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL, "lat" double precision, "lng" double precision, "accuracy" double precision, "state" character varying NOT NULL DEFAULT 'active', CONSTRAINT "PK_b666c5c0408c8bd318811640532" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d84f226cadab9afdb89e7eac0a" ON "solutions"."location_pings" ("session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f40ed0b01087933f5481334432" ON "solutions"."location_pings" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6471df8247894ea2fad264695f" ON "solutions"."location_pings" ("at") `);
        await queryRunner.query(`CREATE TABLE "admin"."activity_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actor_id" uuid, "actor_name" character varying NOT NULL, "actor_role" character varying NOT NULL, "module" character varying NOT NULL, "action" character varying NOT NULL, "entity_type" character varying, "entity_id" character varying, "entity_label" character varying, "summary" text NOT NULL, "metadata" jsonb, CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1fa31efc2a0bc0b517b9f7225d" ON "admin"."activity_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_153c3fec7301b8bcc96a0e1537" ON "admin"."activity_logs" ("entity_type", "entity_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6629c4d1f11f1037f3e57d03d6" ON "admin"."activity_logs" ("module", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_53d8d568e1243a4777f0f7e9e8" ON "admin"."activity_logs" ("actor_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "loans"."quote_applications" ADD "assigned_to_id" uuid`);
        await queryRunner.query(`ALTER TABLE "loans"."quote_applications" ADD "assigned_to_name" character varying`);
        await queryRunner.query(`ALTER TABLE "loans"."quote_applications" ADD "assigned_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "loans"."form_applications" ADD "assigned_to_id" uuid`);
        await queryRunner.query(`ALTER TABLE "loans"."form_applications" ADD "assigned_to_name" character varying`);
        await queryRunner.query(`ALTER TABLE "loans"."form_applications" ADD "assigned_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "insurance"."requests" ADD "assigned_to_id" uuid`);
        await queryRunner.query(`ALTER TABLE "insurance"."requests" ADD "assigned_to_name" character varying`);
        await queryRunner.query(`ALTER TABLE "insurance"."requests" ADD "assigned_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_2602f4055a5f6be131f711fede" ON "loans"."quote_applications" ("assigned_to_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_058725276036d65281c424f207" ON "loans"."form_applications" ("assigned_to_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_34f164420341564d7a495ae764" ON "insurance"."requests" ("assigned_to_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "insurance"."IDX_34f164420341564d7a495ae764"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_058725276036d65281c424f207"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_2602f4055a5f6be131f711fede"`);
        await queryRunner.query(`ALTER TABLE "insurance"."requests" DROP COLUMN "assigned_at"`);
        await queryRunner.query(`ALTER TABLE "insurance"."requests" DROP COLUMN "assigned_to_name"`);
        await queryRunner.query(`ALTER TABLE "insurance"."requests" DROP COLUMN "assigned_to_id"`);
        await queryRunner.query(`ALTER TABLE "loans"."form_applications" DROP COLUMN "assigned_at"`);
        await queryRunner.query(`ALTER TABLE "loans"."form_applications" DROP COLUMN "assigned_to_name"`);
        await queryRunner.query(`ALTER TABLE "loans"."form_applications" DROP COLUMN "assigned_to_id"`);
        await queryRunner.query(`ALTER TABLE "loans"."quote_applications" DROP COLUMN "assigned_at"`);
        await queryRunner.query(`ALTER TABLE "loans"."quote_applications" DROP COLUMN "assigned_to_name"`);
        await queryRunner.query(`ALTER TABLE "loans"."quote_applications" DROP COLUMN "assigned_to_id"`);
        await queryRunner.query(`DROP INDEX "admin"."IDX_53d8d568e1243a4777f0f7e9e8"`);
        await queryRunner.query(`DROP INDEX "admin"."IDX_6629c4d1f11f1037f3e57d03d6"`);
        await queryRunner.query(`DROP INDEX "admin"."IDX_153c3fec7301b8bcc96a0e1537"`);
        await queryRunner.query(`DROP INDEX "admin"."IDX_1fa31efc2a0bc0b517b9f7225d"`);
        await queryRunner.query(`DROP TABLE "admin"."activity_logs"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_6471df8247894ea2fad264695f"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_f40ed0b01087933f5481334432"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_d84f226cadab9afdb89e7eac0a"`);
        await queryRunner.query(`DROP TABLE "solutions"."location_pings"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_c01461932a41e4057310b461e1"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_4dfb452d1af3bae42593301098"`);
        await queryRunner.query(`DROP TABLE "solutions"."work_sessions"`);
        await queryRunner.query(`DROP TABLE "solutions"."tracking_consents"`);
    }

}
