import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1794721209233 implements MigrationInterface {
    name = 'InitialSchema1794721209233'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
        for (const schema of ['identity', 'admin', 'taxi', 'insurance', 'loans', 'organic', 'reporting', 'solutions']) {
            await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
        }
        await queryRunner.query(`
            CREATE TABLE "taxi"."drivers" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "license_number" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'PENDING',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_8e224f1b8f05ace7cfc7c76d03" ON "taxi"."drivers" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "taxi"."vehicles" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "driver_id" uuid NOT NULL,
                "registration_no" character varying NOT NULL,
                "model" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_b382822724168e92086e430b8fb" UNIQUE ("registration_no"),
                CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_9c2e0a8772c9e43b32f57bfcfc" ON "taxi"."vehicles" ("driver_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "taxi"."bookings" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "customer_id" uuid NOT NULL,
                "pickup" character varying NOT NULL,
                "drop_off" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'REQUESTED',
                "fare" numeric(14, 2),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_8e21b7ae33e7b0673270de4146" ON "taxi"."bookings" ("customer_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "taxi"."trips" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "booking_id" uuid NOT NULL,
                "driver_id" uuid NOT NULL,
                "started_at" TIMESTAMP WITH TIME ZONE,
                "ended_at" TIMESTAMP WITH TIME ZONE,
                "distance_km" numeric(8, 2),
                CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_09a86fb73859a636f87de8505f" ON "taxi"."trips" ("booking_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "solutions"."customers" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid,
                "name" character varying NOT NULL,
                "mobile" character varying NOT NULL,
                "email" character varying,
                "address" character varying,
                "city" character varying,
                "pincode" character varying,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_11d81cd7be87b6f8865b0cf766" ON "solutions"."customers" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_6d1cb2e8c3ca15f7293464edad" ON "solutions"."customers" ("mobile")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_8536b8b85c06969f84f0c098b0" ON "solutions"."customers" ("email")
        `);
        await queryRunner.query(`
            CREATE TABLE "solutions"."vehicles" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "registration_no" character varying NOT NULL,
                "make" character varying NOT NULL,
                "vehicle_model" character varying NOT NULL,
                "year" integer NOT NULL,
                "fuel_type" character varying NOT NULL DEFAULT 'Petrol',
                "engine_cc" integer,
                "chassis_no" character varying,
                "engine_no" character varying,
                "colour" character varying,
                "customer_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_b382822724168e92086e430b8f" ON "solutions"."vehicles" ("registration_no")
        `);
        await queryRunner.query(`
            CREATE TABLE "solutions"."counters" (
                "id" character varying NOT NULL,
                "seq" integer NOT NULL DEFAULT '0',
                CONSTRAINT "PK_910bfcbadea9cde6397e0daf996" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "solutions"."tickets" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "ticket_number" character varying NOT NULL,
                "title" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'Open',
                "priority" character varying NOT NULL DEFAULT 'Medium',
                "ticket_type" character varying NOT NULL DEFAULT 'Insurance',
                "assigned_to_id" character varying,
                "assigned_to_name" character varying,
                "due_date" TIMESTAMP WITH TIME ZONE,
                "internal_notes" text,
                "customer_id" uuid,
                "customer_name" character varying NOT NULL,
                "customer_mobile" character varying NOT NULL,
                "vehicle_id" uuid,
                "vehicle_reg_no" character varying,
                "vehicle_name" character varying,
                "policy" jsonb,
                "payment" jsonb NOT NULL DEFAULT '{"amount": 0, "paymentStatus": "Pending"}',
                "raised_by_customer" boolean NOT NULL DEFAULT false,
                "payment_ticket_data" jsonb,
                "office_ticket_data" jsonb,
                "other_ticket_data" jsonb,
                "o2_taxi_ticket_data" jsonb,
                "daily_activity_ticket_data" jsonb,
                "support_ticket_data" jsonb,
                "general_ticket_data" jsonb,
                "documents" jsonb NOT NULL DEFAULT '[]',
                "activity_log" jsonb NOT NULL DEFAULT '[]',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_8d7b9a157280caf57aa0282e72" ON "solutions"."tickets" ("ticket_number")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_12b901b34113688b4786368510" ON "solutions"."tickets" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_42e4343476d9c4a46fb565a5c4" ON "solutions"."tickets" ("customer_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3444f486e85e03163b88c79726" ON "solutions"."tickets" ("vehicle_reg_no")
        `);
        await queryRunner.query(`
            CREATE TABLE "solutions"."timesheets" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "employee_name" character varying NOT NULL,
                "employee_id" character varying NOT NULL,
                "role" character varying NOT NULL,
                "week_start" character varying NOT NULL,
                "entries" jsonb NOT NULL DEFAULT '[]',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_1dc280b68c9353ecce41a34be71" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_7130aba0edd0f53765524ef6b6" ON "solutions"."timesheets" ("user_id", "week_start")
        `);
        await queryRunner.query(`
            CREATE TABLE "solutions"."kb_articles" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "title" character varying NOT NULL,
                "slug" character varying NOT NULL,
                "category" character varying NOT NULL DEFAULT 'General',
                "body" text NOT NULL,
                "published" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ffb01b096d72350aa97d1d0cb14" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_6c048f402eb6814c8c10b6da0b" ON "solutions"."kb_articles" ("slug")
        `);
        await queryRunner.query(`
            CREATE TABLE "reporting"."business_summary" (
                "product" character varying NOT NULL,
                "total_records" integer NOT NULL DEFAULT '0',
                "total_amount" numeric(16, 2) NOT NULL DEFAULT '0',
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_899ca04e5a2befaf55ff06bc252" PRIMARY KEY ("product")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "reporting"."daily_metrics" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "day" date NOT NULL,
                "product" character varying NOT NULL,
                "metric" character varying NOT NULL,
                "value" numeric(16, 2) NOT NULL,
                CONSTRAINT "PK_0b33a3faffa5fbb3d4dad78c4e9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_1e3868a8f37ce8d1bfc9150b97" ON "reporting"."daily_metrics" ("day", "product", "metric")
        `);
        await queryRunner.query(`
            CREATE TABLE "reporting"."outbox_events" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "type" character varying NOT NULL,
                "payload" jsonb NOT NULL,
                "processed_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_9c1d8c50b7a9548beaaa9455b6" ON "reporting"."outbox_events" ("processed_at")
        `);
        await queryRunner.query(`
            CREATE TABLE "organic"."products" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "sku" character varying NOT NULL,
                "name" character varying NOT NULL,
                "price" numeric(12, 2) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_c44ac33a05b144dd0d9ddcf9327" UNIQUE ("sku"),
                CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "organic"."orders" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "customer_id" uuid NOT NULL,
                "total" numeric(14, 2) NOT NULL,
                "status" character varying NOT NULL DEFAULT 'PLACED',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_772d0ce0473ac2ccfa26060dbe" ON "organic"."orders" ("customer_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "organic"."inventory" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "product_id" uuid NOT NULL,
                "quantity" integer NOT NULL DEFAULT '0',
                CONSTRAINT "PK_82aa5da437c5bbfb80703b08309" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_732fdb1f76432d65d2c136340d" ON "organic"."inventory" ("product_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "loans"."applications" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "customer_id" uuid NOT NULL,
                "amount" numeric(14, 2) NOT NULL,
                "tenure_months" integer NOT NULL,
                "status" character varying NOT NULL DEFAULT 'SUBMITTED',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_938c0a27255637bde919591888f" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_7ab97e23f4482c78e873c8424b" ON "loans"."applications" ("customer_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "loans"."transactions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "application_id" uuid NOT NULL,
                "type" character varying NOT NULL,
                "amount" numeric(14, 2) NOT NULL,
                "gateway_ref" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_da183398f7b039bc7a70aa7a2a" ON "loans"."transactions" ("application_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "loans"."settlements" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "application_id" uuid NOT NULL,
                "amount" numeric(14, 2) NOT NULL,
                "settled_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                CONSTRAINT "PK_5f523ce152b84e818bff9467aab" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_ad47341bcf7ca71c8a702c2157" ON "loans"."settlements" ("application_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "insurance"."requests" (
                "id" uuid NOT NULL,
                "customer_id" uuid NOT NULL,
                "kind" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'new',
                "admin_note" text,
                "updated_by" character varying,
                "vehicle_type" character varying,
                "cashback_up_to" integer,
                "applicant" jsonb,
                "vehicle" jsonb,
                "policy" jsonb,
                "plan" jsonb,
                "contact_name" character varying,
                "contact_mobile" character varying,
                "doc_type" character varying,
                "documents" jsonb NOT NULL DEFAULT '[]',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_0428f484e96f9e6a55955f29b5f" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_210052a4b94dfd2394b07ebde1" ON "insurance"."requests" ("customer_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_59b85be6a3c16cbf27f8bdda1d" ON "insurance"."requests" ("status")
        `);
        await queryRunner.query(`
            CREATE TABLE "insurance"."quotes" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "customer_id" uuid NOT NULL,
                "product_type" character varying NOT NULL,
                "premium" numeric(14, 2) NOT NULL,
                "status" character varying NOT NULL DEFAULT 'DRAFT',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_99a0e8bcbcd8719d3a41f23c263" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a11bdb4a739328d1009c0b47e8" ON "insurance"."quotes" ("customer_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "insurance"."policies" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "customer_id" uuid NOT NULL,
                "quote_id" uuid NOT NULL,
                "policy_number" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'ACTIVE',
                "start_date" date NOT NULL,
                "end_date" date NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_0a3ff12ee86e399e522e8ec7cef" UNIQUE ("policy_number"),
                CONSTRAINT "PK_603e09f183df0108d8695c57e28" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_f7d30941e7f951eeeba747ae7e" ON "insurance"."policies" ("customer_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "insurance"."claims" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "policy_id" uuid NOT NULL,
                "customer_id" uuid NOT NULL,
                "amount" numeric(14, 2) NOT NULL,
                "status" character varying NOT NULL DEFAULT 'SUBMITTED',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_96c91970c0dcb2f69fdccd0a698" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_879ff2d9bdf3ee3db7963b7a25" ON "insurance"."claims" ("policy_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "identity"."users" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "mobile" character varying,
                "email" character varying,
                "full_name" character varying,
                "roles" text NOT NULL DEFAULT 'CUSTOMER',
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_d376a9f93bba651f32a2c03a7d" ON "identity"."users" ("mobile")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "identity"."users" ("email")
        `);
        await queryRunner.query(`
            CREATE TABLE "identity"."otp_codes" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "identifier" character varying NOT NULL,
                "code_hash" character varying NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "attempts" integer NOT NULL DEFAULT '0',
                "consumed" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_84d7e405419825d034a7ef8dd3" ON "identity"."otp_codes" ("identifier")
        `);
        await queryRunner.query(`
            CREATE TABLE "identity"."sessions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "family_id" uuid NOT NULL,
                "refresh_hash" character varying NOT NULL,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "revoked_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "identity"."sessions" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_f61929073858aa9cb9cb893b66" ON "identity"."sessions" ("family_id")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_0be384894b8949610f7915d19b" ON "identity"."sessions" ("refresh_hash")
        `);
        await queryRunner.query(`
            CREATE TABLE "identity"."mfa_methods" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "type" character varying NOT NULL,
                "secret" character varying,
                "enabled" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_60e4d183e6dbd427aa5549da581" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_1d590a89ba342ab3515e64f6d2" ON "identity"."mfa_methods" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "identity"."customer_profiles" (
                "user_id" uuid NOT NULL,
                "display_name" character varying,
                "city" character varying,
                "address" character varying,
                "pincode" character varying,
                "contact_email" character varying,
                "products" text NOT NULL DEFAULT '',
                "kyc_status" character varying NOT NULL DEFAULT 'PENDING',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_99617dd6d452ad43dd992a79933" PRIMARY KEY ("user_id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "admin"."audit_logs" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "actor_id" uuid,
                "action" character varying NOT NULL,
                "resource" character varying,
                "metadata" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_177183f29f438c488b5e8510cd" ON "admin"."audit_logs" ("actor_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "admin"."audit_logs" ("action")
        `);
        await queryRunner.query(`
            CREATE TABLE "admin"."roles" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying NOT NULL,
                "description" character varying,
                CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"),
                CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "admin"."permissions" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "role_id" uuid NOT NULL,
                "product" character varying NOT NULL,
                "action" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "admin"."permissions"
        `);
        await queryRunner.query(`
            DROP TABLE "admin"."roles"
        `);
        await queryRunner.query(`
            DROP INDEX "admin"."IDX_cee5459245f652b75eb2759b4c"
        `);
        await queryRunner.query(`
            DROP INDEX "admin"."IDX_177183f29f438c488b5e8510cd"
        `);
        await queryRunner.query(`
            DROP TABLE "admin"."audit_logs"
        `);
        await queryRunner.query(`
            DROP TABLE "identity"."customer_profiles"
        `);
        await queryRunner.query(`
            DROP INDEX "identity"."IDX_1d590a89ba342ab3515e64f6d2"
        `);
        await queryRunner.query(`
            DROP TABLE "identity"."mfa_methods"
        `);
        await queryRunner.query(`
            DROP INDEX "identity"."IDX_0be384894b8949610f7915d19b"
        `);
        await queryRunner.query(`
            DROP INDEX "identity"."IDX_f61929073858aa9cb9cb893b66"
        `);
        await queryRunner.query(`
            DROP INDEX "identity"."IDX_085d540d9f418cfbdc7bd55bb1"
        `);
        await queryRunner.query(`
            DROP TABLE "identity"."sessions"
        `);
        await queryRunner.query(`
            DROP INDEX "identity"."IDX_84d7e405419825d034a7ef8dd3"
        `);
        await queryRunner.query(`
            DROP TABLE "identity"."otp_codes"
        `);
        await queryRunner.query(`
            DROP INDEX "identity"."IDX_97672ac88f789774dd47f7c8be"
        `);
        await queryRunner.query(`
            DROP INDEX "identity"."IDX_d376a9f93bba651f32a2c03a7d"
        `);
        await queryRunner.query(`
            DROP TABLE "identity"."users"
        `);
        await queryRunner.query(`
            DROP INDEX "insurance"."IDX_879ff2d9bdf3ee3db7963b7a25"
        `);
        await queryRunner.query(`
            DROP TABLE "insurance"."claims"
        `);
        await queryRunner.query(`
            DROP INDEX "insurance"."IDX_f7d30941e7f951eeeba747ae7e"
        `);
        await queryRunner.query(`
            DROP TABLE "insurance"."policies"
        `);
        await queryRunner.query(`
            DROP INDEX "insurance"."IDX_a11bdb4a739328d1009c0b47e8"
        `);
        await queryRunner.query(`
            DROP TABLE "insurance"."quotes"
        `);
        await queryRunner.query(`
            DROP INDEX "insurance"."IDX_59b85be6a3c16cbf27f8bdda1d"
        `);
        await queryRunner.query(`
            DROP INDEX "insurance"."IDX_210052a4b94dfd2394b07ebde1"
        `);
        await queryRunner.query(`
            DROP TABLE "insurance"."requests"
        `);
        await queryRunner.query(`
            DROP INDEX "loans"."IDX_ad47341bcf7ca71c8a702c2157"
        `);
        await queryRunner.query(`
            DROP TABLE "loans"."settlements"
        `);
        await queryRunner.query(`
            DROP INDEX "loans"."IDX_da183398f7b039bc7a70aa7a2a"
        `);
        await queryRunner.query(`
            DROP TABLE "loans"."transactions"
        `);
        await queryRunner.query(`
            DROP INDEX "loans"."IDX_7ab97e23f4482c78e873c8424b"
        `);
        await queryRunner.query(`
            DROP TABLE "loans"."applications"
        `);
        await queryRunner.query(`
            DROP INDEX "organic"."IDX_732fdb1f76432d65d2c136340d"
        `);
        await queryRunner.query(`
            DROP TABLE "organic"."inventory"
        `);
        await queryRunner.query(`
            DROP INDEX "organic"."IDX_772d0ce0473ac2ccfa26060dbe"
        `);
        await queryRunner.query(`
            DROP TABLE "organic"."orders"
        `);
        await queryRunner.query(`
            DROP TABLE "organic"."products"
        `);
        await queryRunner.query(`
            DROP INDEX "reporting"."IDX_9c1d8c50b7a9548beaaa9455b6"
        `);
        await queryRunner.query(`
            DROP TABLE "reporting"."outbox_events"
        `);
        await queryRunner.query(`
            DROP INDEX "reporting"."IDX_1e3868a8f37ce8d1bfc9150b97"
        `);
        await queryRunner.query(`
            DROP TABLE "reporting"."daily_metrics"
        `);
        await queryRunner.query(`
            DROP TABLE "reporting"."business_summary"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_6c048f402eb6814c8c10b6da0b"
        `);
        await queryRunner.query(`
            DROP TABLE "solutions"."kb_articles"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_7130aba0edd0f53765524ef6b6"
        `);
        await queryRunner.query(`
            DROP TABLE "solutions"."timesheets"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_3444f486e85e03163b88c79726"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_42e4343476d9c4a46fb565a5c4"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_12b901b34113688b4786368510"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_8d7b9a157280caf57aa0282e72"
        `);
        await queryRunner.query(`
            DROP TABLE "solutions"."tickets"
        `);
        await queryRunner.query(`
            DROP TABLE "solutions"."counters"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_b382822724168e92086e430b8f"
        `);
        await queryRunner.query(`
            DROP TABLE "solutions"."vehicles"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_8536b8b85c06969f84f0c098b0"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_6d1cb2e8c3ca15f7293464edad"
        `);
        await queryRunner.query(`
            DROP INDEX "solutions"."IDX_11d81cd7be87b6f8865b0cf766"
        `);
        await queryRunner.query(`
            DROP TABLE "solutions"."customers"
        `);
        await queryRunner.query(`
            DROP INDEX "taxi"."IDX_09a86fb73859a636f87de8505f"
        `);
        await queryRunner.query(`
            DROP TABLE "taxi"."trips"
        `);
        await queryRunner.query(`
            DROP INDEX "taxi"."IDX_8e21b7ae33e7b0673270de4146"
        `);
        await queryRunner.query(`
            DROP TABLE "taxi"."bookings"
        `);
        await queryRunner.query(`
            DROP INDEX "taxi"."IDX_9c2e0a8772c9e43b32f57bfcfc"
        `);
        await queryRunner.query(`
            DROP TABLE "taxi"."vehicles"
        `);
        await queryRunner.query(`
            DROP INDEX "taxi"."IDX_8e224f1b8f05ace7cfc7c76d03"
        `);
        await queryRunner.query(`
            DROP TABLE "taxi"."drivers"
        `);
    }

}
