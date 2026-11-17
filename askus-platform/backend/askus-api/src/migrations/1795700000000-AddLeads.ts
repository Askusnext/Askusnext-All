import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLeads1795700000000 implements MigrationInterface {
    name = 'AddLeads1795700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "solutions"."leads" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "ticket_number" character varying NOT NULL, "vertical" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'New', "customer_name" character varying NOT NULL, "customer_phone" character varying NOT NULL, "customer_email" character varying, "created_by_id" uuid NOT NULL, "created_by_name" character varying NOT NULL, "vehicle_reg_no" character varying, "vehicle_type" character varying, "insurer" character varying, "policy_type" character varying, "loan_type" character varying, "loan_amount" numeric, "lender" character varying, "claimed_by_id" uuid, "claimed_by_name" character varying, "claimed_at" TIMESTAMP WITH TIME ZONE, "last_activity_at" TIMESTAMP WITH TIME ZONE, "quote_amount" numeric, "payment_link_url" character varying, "payment_status" character varying NOT NULL DEFAULT 'pending', "paid_amount" numeric, "paid_at" TIMESTAMP WITH TIME ZONE, "issued_amount" numeric, "policy_number" character varying, "policy_expiry_date" character varying, "issued_at" TIMESTAMP WITH TIME ZONE, "rejected_reason" text, "resolved_at" TIMESTAMP WITH TIME ZONE, "closed_at" TIMESTAMP WITH TIME ZONE, "urgent" boolean NOT NULL DEFAULT false, "sla_due_at" TIMESTAMP WITH TIME ZONE NOT NULL, "sla_breached_at" TIMESTAMP WITH TIME ZONE, "commission_amount" numeric, "commission_basis" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_835b0e8d30518be73a1d1ee1b6" ON "solutions"."leads" ("ticket_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d06b68af268b5441db70189f3" ON "solutions"."leads" ("vertical") `);
        await queryRunner.query(`CREATE INDEX "IDX_491b018d616822bd64ce7d4726" ON "solutions"."leads" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f0318e0f95ab5c5895f17d8fd" ON "solutions"."leads" ("created_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_58cdf3cfc8a11815eb0a4292a3" ON "solutions"."leads" ("claimed_by_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ca6cebd938216a55cdacfdf7c" ON "solutions"."leads" ("sla_due_at") `);
        await queryRunner.query(`CREATE TABLE "solutions"."lead_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "lead_id" uuid NOT NULL, "user_id" uuid, "user_name" character varying NOT NULL, "action" character varying NOT NULL, "from_status" character varying, "to_status" character varying, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_38013d55900c219b7bb52f90122" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5f01589188405d4107fff0362f" ON "solutions"."lead_events" ("lead_id") `);
        await queryRunner.query(`CREATE TABLE "solutions"."lead_documents" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "lead_id" uuid NOT NULL, "kind" character varying NOT NULL, "file_name" character varying NOT NULL, "mime_type" character varying NOT NULL, "size_bytes" integer NOT NULL, "storage_key" character varying NOT NULL, "uploaded_by_id" uuid NOT NULL, "uploaded_by_name" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e31534e983c690c655b8a70ec6a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b19d3f84832d5a4bebf4336ecf" ON "solutions"."lead_documents" ("lead_id") `);
        await queryRunner.query(`CREATE TABLE "solutions"."lead_notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "lead_id" uuid NOT NULL, "kind" character varying NOT NULL, "audience" character varying NOT NULL, "channel" character varying NOT NULL, "recipient" character varying NOT NULL, "status" character varying NOT NULL, "detail" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_17dc3c07eb4e0fcaba0a06a621c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_28b13888cea1a76e6dfc50e2d4" ON "solutions"."lead_notifications" ("lead_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd537306ecd34c7929e4901252" ON "solutions"."lead_notifications" ("kind") `);
        await queryRunner.query(`CREATE TABLE "solutions"."commission_rules" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "vertical" character varying NOT NULL, "partner" character varying NOT NULL, "kind" character varying NOT NULL, "value" numeric NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_399c9fa57f7fd28dfc57acea3bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1e6bda14da3a24856cabbdc7aa" ON "solutions"."commission_rules" ("vertical", "partner") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "solutions"."IDX_1e6bda14da3a24856cabbdc7aa"`);
        await queryRunner.query(`DROP TABLE "solutions"."commission_rules"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_dd537306ecd34c7929e4901252"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_28b13888cea1a76e6dfc50e2d4"`);
        await queryRunner.query(`DROP TABLE "solutions"."lead_notifications"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_b19d3f84832d5a4bebf4336ecf"`);
        await queryRunner.query(`DROP TABLE "solutions"."lead_documents"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_5f01589188405d4107fff0362f"`);
        await queryRunner.query(`DROP TABLE "solutions"."lead_events"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_2ca6cebd938216a55cdacfdf7c"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_58cdf3cfc8a11815eb0a4292a3"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_8f0318e0f95ab5c5895f17d8fd"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_491b018d616822bd64ce7d4726"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_7d06b68af268b5441db70189f3"`);
        await queryRunner.query(`DROP INDEX "solutions"."IDX_835b0e8d30518be73a1d1ee1b6"`);
        await queryRunner.query(`DROP TABLE "solutions"."leads"`);
    }

}
