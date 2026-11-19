import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remembers WHY someone is Offline: they closed the tab or signed out, or the connection was simply lost
 * (laptop closed, asleep, network off). Two nullable columns; nothing existing is changed.
 */
export class AddPresenceOfflineReason1795900000000 implements MigrationInterface {
  name = 'AddPresenceOfflineReason1795900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "solutions"."presence_states" ADD COLUMN IF NOT EXISTS "offline_reason" character varying(8)`);
    await q.query(`ALTER TABLE "solutions"."presence_transitions" ADD COLUMN IF NOT EXISTS "reason" character varying(8)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "solutions"."presence_transitions" DROP COLUMN IF EXISTS "reason"`);
    await q.query(`ALTER TABLE "solutions"."presence_states" DROP COLUMN IF EXISTS "offline_reason"`);
  }
}
