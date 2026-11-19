import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Staff hierarchy (Employee/Agent -> one Admin) and browser presence.
 *
 * Existing staff stay UNASSIGNED: no authoritative mapping exists, so none is guessed.
 *
 * Note for `migration:generate`: the FK "FK_users_reporting_admin" and CHECK "CHK_users_not_own_admin" are database-level safeguards that the
 * entities do not model, so TypeORM will propose dropping them. Do not accept those two lines.
 *
 * Rollback (down) drops the four presence tables, the assignment audit table and
 * users.reporting_admin_id. That discards every assignment, audit row, consent decision and
 * presence record created since the migration; it never touches monitoring, attendance or payroll tables.
 */
export class AddStaffHierarchyPresence1795800000000 implements MigrationInterface {
  name = 'AddStaffHierarchyPresence1795800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "identity"."users" ADD COLUMN IF NOT EXISTS "reporting_admin_id" uuid`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_8a3e62323d1f00bb739533c52c" ON "identity"."users" ("reporting_admin_id")`);
    await q.query(`DO $$ BEGIN
      ALTER TABLE "identity"."users" ADD CONSTRAINT "FK_users_reporting_admin" FOREIGN KEY ("reporting_admin_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
    await q.query(`DO $$ BEGIN
      ALTER TABLE "identity"."users" ADD CONSTRAINT "CHK_users_not_own_admin" CHECK ("reporting_admin_id" IS NULL OR "reporting_admin_id" <> "id");
      EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

    await q.query(`CREATE TABLE "solutions"."staff_assignment_audit" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "actor_id" uuid NOT NULL, "subject_id" uuid NOT NULL, "old_admin_id" uuid, "new_admin_id" uuid, "reason" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_staff_assignment_audit" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_b279cc3d2e8158aa9962d621df" ON "solutions"."staff_assignment_audit" ("subject_id")`);
    await q.query(`CREATE INDEX "IDX_9464a8b873486108ed054ce366" ON "solutions"."staff_assignment_audit" ("subject_id", "created_at")`);

    await q.query(`CREATE TABLE "solutions"."presence_consents" ("user_id" uuid NOT NULL, "notice_version" character varying(20) NOT NULL, "decision" character varying(12) NOT NULL, "decided_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_presence_consents" PRIMARY KEY ("user_id"))`);

    await q.query(`CREATE TABLE "solutions"."presence_sessions" ("id" character varying(40) NOT NULL, "user_id" uuid NOT NULL, "in_view" boolean NOT NULL DEFAULT false, "seq" integer NOT NULL DEFAULT 0, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, "end_reason" character varying(20), CONSTRAINT "PK_presence_sessions" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_b70fb60f7a2a3a3a934dd46801" ON "solutions"."presence_sessions" ("user_id", "ended_at")`);

    await q.query(`CREATE TABLE "solutions"."presence_states" ("user_id" uuid NOT NULL, "state" character varying(12) NOT NULL DEFAULT 'offline', "state_since" TIMESTAMP WITH TIME ZONE NOT NULL, "background_since" TIMESTAMP WITH TIME ZONE, "last_seen_at" TIMESTAMP WITH TIME ZONE, "version" bigint NOT NULL DEFAULT 0, CONSTRAINT "PK_presence_states" PRIMARY KEY ("user_id"))`);

    await q.query(`CREATE TABLE "solutions"."presence_transitions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "from_state" character varying(12), "to_state" character varying(12) NOT NULL, "at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_presence_transitions" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_983558bd185f68daf2655871cd" ON "solutions"."presence_transitions" ("user_id", "at")`);
    await q.query(`CREATE INDEX "IDX_c729753f502d7e5a26021fae28" ON "solutions"."presence_transitions" ("at")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "solutions"."presence_transitions"`);
    await q.query(`DROP TABLE "solutions"."presence_states"`);
    await q.query(`DROP TABLE "solutions"."presence_sessions"`);
    await q.query(`DROP TABLE "solutions"."presence_consents"`);
    await q.query(`DROP TABLE "solutions"."staff_assignment_audit"`);
    await q.query(`ALTER TABLE "identity"."users" DROP CONSTRAINT IF EXISTS "CHK_users_not_own_admin"`);
    await q.query(`ALTER TABLE "identity"."users" DROP CONSTRAINT IF EXISTS "FK_users_reporting_admin"`);
    await q.query(`DROP INDEX IF EXISTS "identity"."IDX_8a3e62323d1f00bb739533c52c"`);
    await q.query(`ALTER TABLE "identity"."users" DROP COLUMN IF EXISTS "reporting_admin_id"`);
  }
}
