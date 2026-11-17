import { MigrationInterface, QueryRunner } from "typeorm";

// Staff accounts made before contact verification existed have both contacts on file but no
// verified timestamps, so they were asked for a mobile and an email OTP again. Their contacts were
// entered by an Admin, the same trust given to staff created since, so mark them verified.
// Customer-only accounts are left alone: they still prove both contacts on their first sign-in.
export class VerifyExistingStaffContacts1795200000000 implements MigrationInterface {
    name = 'VerifyExistingStaffContacts1795200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "identity"."users"
            SET "email_verified_at" = COALESCE("email_verified_at", now()),
                "mobile_verified_at" = COALESCE("mobile_verified_at", now())
            WHERE "email" IS NOT NULL
              AND "mobile" IS NOT NULL
              AND "roles" <> 'CUSTOMER'
              AND ("email_verified_at" IS NULL OR "mobile_verified_at" IS NULL)
        `);
    }

    // Data-only backfill: the rows it touched cannot be told apart afterwards, so there is nothing to undo.
    public async down(): Promise<void> {}
}
