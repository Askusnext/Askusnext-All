import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessGuard, JwtAuthGuard, ProductAccess } from '../common/access';
import { OrganicOrder, OrganicProduct } from './organic.entities';

@ApiTags('organic')
@ApiBearerAuth()
@Controller('organic')
@UseGuards(JwtAuthGuard, AccessGuard)
@ProductAccess('organic')
export class OrganicController {
  constructor(
    @InjectRepository(OrganicProduct) private readonly products: Repository<OrganicProduct>,
    @InjectRepository(OrganicOrder) private readonly orders: Repository<OrganicOrder>,
  ) {}

  @Get('products')
  listProducts() {
    return this.products.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  @Get('orders')
  listOrders() {
    return this.orders.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
