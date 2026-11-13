import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGuard, JwtAuthGuard, ProductAccess } from '../common/access';
import { Booking, Driver } from './taxi.entities';

@ApiTags('taxi')
@ApiBearerAuth()
@Controller('taxi')
@UseGuards(JwtAuthGuard, AccessGuard)
@ProductAccess('taxi')
export class TaxiController {
  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
  ) {}

  @Get('drivers')
  listDrivers() {
    return this.drivers.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  @Get('bookings')
  listBookings() {
    return this.bookings.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
