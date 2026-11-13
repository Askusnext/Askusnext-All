import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  log(entry: { actorId?: string; action: string; resource?: string; metadata?: Record<string, unknown> }) {
    return this.logs.save(
      this.logs.create({
        actorId: entry.actorId ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        metadata: entry.metadata ?? null,
      }),
    );
  }

  recent(limit = 100) {
    return this.logs.find({ order: { createdAt: 'DESC' }, take: limit });
  }
}
