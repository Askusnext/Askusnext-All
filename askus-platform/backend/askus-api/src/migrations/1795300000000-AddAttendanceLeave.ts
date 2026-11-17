import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttendanceLeave1795300000000 implements MigrationInterface {
    name = 'AddAttendanceLeave1795300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "solutions"."leave_types" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "default_days_per_year" integer NOT NULL DEFAULT '0', "is_paid" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_359223e0755d19711813cd07394" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e41bb9537ef5e65ee2de2cfa81" ON "solutions"."leave_types" ("name") `);
        await queryRunner.query(`CREATE TABLE "solutions"."leave_balances" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "leave_type_id" uuid NOT NULL, "year" integer NOT NULL, "total_allotted" integer NOT NULL DEFAULT '0', "used" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_a1d90dff48fb2bfd23a7163d077" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c96727e7b6f0420af2593ca754" ON "solutions"."leave_balances" ("user_id", "leave_type_id", "year") `);
        await queryRunner.query(`CREATE TABLE "solutions"."leave_requests" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "user_name" character varying NOT NULL, "leave_type_id" uuid NOT NULL, "leave_type_name" character varying NOT NULL, "from_date" character varying(10) NOT NULL, "to_date" character varying(10) NOT NULL, "days" integer NOT NULL, "reason" text NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "approved_by" uuid, "approved_by_name" character varying, "decided_at" TIMESTAMP WITH TIME ZONE, "decision_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d3abcf9a16cef1450129e06fa9f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6e36f8bbbdeb98c24bf3ad4a65" ON "solutions"."leave_requests" ("status", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc5df5b87c737bfd4624cad0fe" ON "solutions"."leave_requests" ("user_id", "from_date") `);
        await queryRunner.query(`CREATE TABLE "solutions"."holiday_calendar" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "date" character varying(10) NOT NULL, "name" character varying NOT NULL, "applicable_to" character varying NOT NULL DEFAULT 'all', CONSTRAINT "PK_ab93ff20ee8d6d744896d9322a8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_38d691bf6992bb195772a530ec" ON "solutions"."holiday_calendar" ("date") `);
        await queryRunner.query(`CREATE TABLE "solutions"."attendance_records" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "date" character varying(10) NOT NULL, "status" character varying NOT NULL, "check_in_time" TIMESTAMP WITH TIME ZONE, "check_out_time" TIMESTAMP WITH TIME ZONE, "late_by_minutes" integer NOT NULL DEFAULT '0', "missed_checkout" boolean NOT NULL DEFAULT false, "source" character varying NOT NULL DEFAULT 'system', "marked_by" uuid, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_946920332f5bc9efad3f3023b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9fb6ef15f899489af7e47b6c83" ON "solutions"."attendance_records" ("date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_09f578fa2a9ca43517d6fcbfb8" ON "solutions"."attendance_records" ("user_id", "date") `);
        await queryRunner.query(`CREATE TABLE "solutions"."attendance_config" ("id" character varying NOT NULL, "shift_start" character varying NOT NULL DEFAULT '09:30', "grace_minutes" integer NOT NULL DEFAULT '10', "half_day_minutes" integer NOT NULL DEFAULT '240', "week_off_days" character varying NOT NULL DEFAULT '0', CONSTRAINT "PK_d63110530cdd359332a88396b78" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "solutions"."week_off_rules" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "scope" character varying NOT NULL, "target" character varying NOT NULL, "days" character varying NOT NULL DEFAULT '', CONSTRAINT "PK_e291aa4d1688dcb30db0f5cd952" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_bb3896118a20aa3d0eebb4fd25" ON "solutions"."week_off_rules" ("scope", "target") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "solutions"."IDX_bb3896118a20aa3d0eebb4fd25"`);
        await queryRunner.query(`DROP TABLE "solutions"."week_off_rules"`);
        await queryRunner.query(`DROP TABLE "solutions"."attendance_config"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_09f578fa2a9ca43517d6fcbfb8"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_9fb6ef15f899489af7e47b6c83"`);
        await queryRunner.query(`DROP TABLE "solutions"."attendance_records"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_38d691bf6992bb195772a530ec"`);
        await queryRunner.query(`DROP TABLE "solutions"."holiday_calendar"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_fc5df5b87c737bfd4624cad0fe"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_6e36f8bbbdeb98c24bf3ad4a65"`);
        await queryRunner.query(`DROP TABLE "solutions"."leave_requests"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_c96727e7b6f0420af2593ca754"`);
        await queryRunner.query(`DROP TABLE "solutions"."leave_balances"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_e41bb9537ef5e65ee2de2cfa81"`);
        await queryRunner.query(`DROP TABLE "solutions"."leave_types"`);
    }

}
