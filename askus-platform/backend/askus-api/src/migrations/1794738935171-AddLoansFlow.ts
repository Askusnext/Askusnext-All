import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLoansFlow1794738935171 implements MigrationInterface {
    name = 'AddLoansFlow1794738935171'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "loans"."customer_details" ("user_id" uuid NOT NULL, "data" jsonb NOT NULL DEFAULT '{}', "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0ff325b4b69ef153aac0da1d922" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TABLE "loans"."quote_applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "app_key" character varying NOT NULL, "loan_type" character varying NOT NULL, "lender_id" character varying NOT NULL, "amount" numeric(14,0) NOT NULL, "tenure_months" integer NOT NULL, "roi" numeric(6,2) NOT NULL, "status" character varying NOT NULL DEFAULT 'in_progress', "step" character varying NOT NULL DEFAULT 'know_you', "purpose" character varying, "document_draft_id" uuid, "reference_number" character varying, "consent_version" character varying, "submitted_at" TIMESTAMP WITH TIME ZONE, "review_message" text, "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "resubmissions" integer NOT NULL DEFAULT '0', "resubmitted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_eed45bd3c80a8e3ce267e38d10e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_eabbff3ef16cb55ed4012641b3" ON "loans"."quote_applications" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7963be7c7369a3a27222b321b" ON "loans"."quote_applications" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9995cc6b123fcbddfc49ed838a" ON "loans"."quote_applications" ("user_id", "app_key") `);
        await queryRunner.query(`CREATE TABLE "loans"."quote_documents" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "application_id" uuid NOT NULL, "slot" character varying NOT NULL, "label" character varying NOT NULL, "file_name" character varying NOT NULL, "file_size" integer NOT NULL, "mime_type" character varying NOT NULL, "storage_key" character varying NOT NULL, "file_id" character varying NOT NULL, "file_format" character varying NOT NULL, "file_version" integer NOT NULL DEFAULT '0', "period" character varying, "review_status" character varying, "review_note" character varying, "reviewed_at" TIMESTAMP WITH TIME ZONE, "reviewed_by" uuid, "uploaded_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_93283428179deb22ca3973615be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7473bca6fdbff6e83b58195816" ON "loans"."quote_documents" ("storage_key") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8967bebd60cb1bbccd92dbc1fa" ON "loans"."quote_documents" ("application_id", "slot") `);
        await queryRunner.query(`CREATE TABLE "loans"."quote_history" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "application_id" uuid NOT NULL, "at" TIMESTAMP NOT NULL DEFAULT now(), "actor" character varying NOT NULL, "actor_id" uuid NOT NULL, "event" character varying NOT NULL, "from_status" character varying NOT NULL, "to_status" character varying NOT NULL, "message" text, CONSTRAINT "PK_15e7cbdd8d80ae8e44edc4369a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_70a8c8b5be99c59a505dbec350" ON "loans"."quote_history" ("application_id") `);
        await queryRunner.query(`CREATE TABLE "loans"."quote_admin_notes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "application_id" uuid NOT NULL, "text" text NOT NULL, "by_id" uuid NOT NULL, "by_email" character varying, "at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_afc86d0a8fd8ba92dfd6223eec0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_bba912d3b96218934a33ad0fe7" ON "loans"."quote_admin_notes" ("application_id") `);
        await queryRunner.query(`CREATE TABLE "loans"."quote_snapshots" ("application_id" uuid NOT NULL, "profile" jsonb NOT NULL, "taken_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_e9141cb16f0882c1b7692e262a5" PRIMARY KEY ("application_id"))`);
        await queryRunner.query(`CREATE TABLE "loans"."form_applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "reference_number" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'submitted', "data" jsonb NOT NULL, "documents" jsonb NOT NULL DEFAULT '[]', "status_history" jsonb NOT NULL DEFAULT '[]', "admin_notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_66cc3ae090802e0290084b70528" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d62163333257d67217cebfa57c" ON "loans"."form_applications" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_caaf269b150587a5bba9e632aa" ON "loans"."form_applications" ("reference_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_63b08c42f2fd29e98cf7731216" ON "loans"."form_applications" ("status") `);
        await queryRunner.query(`CREATE TABLE "loans"."support_tickets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "user_name" character varying, "user_mobile" character varying, "subject" character varying NOT NULL, "message" text NOT NULL, "category" character varying NOT NULL DEFAULT 'general', "status" character varying NOT NULL DEFAULT 'open', "reply" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_942e8d8f5df86100471d2324643" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0b1eb4f1f984aab3c481c48468" ON "loans"."support_tickets" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "loans"."audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_id" uuid NOT NULL, "actor_email" character varying, "actor_role" character varying NOT NULL, "action" character varying NOT NULL, "application_id" character varying, "reference_number" character varying, "details" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "loans"."audit_logs" ("action") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "loans"."IDX_cee5459245f652b75eb2759b4c"`);
        await queryRunner.query(`DROP TABLE "loans"."audit_logs"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_0b1eb4f1f984aab3c481c48468"`);
        await queryRunner.query(`DROP TABLE "loans"."support_tickets"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_63b08c42f2fd29e98cf7731216"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_caaf269b150587a5bba9e632aa"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_d62163333257d67217cebfa57c"`);
        await queryRunner.query(`DROP TABLE "loans"."form_applications"`);
        await queryRunner.query(`DROP TABLE "loans"."quote_snapshots"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_bba912d3b96218934a33ad0fe7"`);
        await queryRunner.query(`DROP TABLE "loans"."quote_admin_notes"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_70a8c8b5be99c59a505dbec350"`);
        await queryRunner.query(`DROP TABLE "loans"."quote_history"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_8967bebd60cb1bbccd92dbc1fa"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_7473bca6fdbff6e83b58195816"`);
        await queryRunner.query(`DROP TABLE "loans"."quote_documents"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_9995cc6b123fcbddfc49ed838a"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_b7963be7c7369a3a27222b321b"`);
        await queryRunner.query(`DROP INDEX "loans"."IDX_eabbff3ef16cb55ed4012641b3"`);
        await queryRunner.query(`DROP TABLE "loans"."quote_applications"`);
        await queryRunner.query(`DROP TABLE "loans"."customer_details"`);
    }

}
