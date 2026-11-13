import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter } from './solutions.entities';

@Injectable()
export class CounterService {
  constructor(@InjectRepository(Counter) private readonly counters: Repository<Counter>) {}

  // Atomic increment; the old read-modify-write could hand out duplicate numbers.
  async nextTicketNumber(): Promise<string> {
    const rows: { seq: number }[] = await this.counters.query(
      `INSERT INTO solutions.counters (id, seq) VALUES ($1, 1)
       ON CONFLICT (id) DO UPDATE SET seq = solutions.counters.seq + 1
       RETURNING seq`,
      ['ticketNumber'],
    );
    return `TKT-${String(rows[0].seq).padStart(4, '0')}`;
  }
}
