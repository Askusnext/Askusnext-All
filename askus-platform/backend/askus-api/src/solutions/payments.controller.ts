import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { PaymentsService } from './payments.service';

class CreateOrderDto {
  @IsUUID()
  ticketId: string;
}

class VerifyOrderDto extends CreateOrderDto {
  @IsString()
  orderId: string;
}

@ApiTags('solutions-payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, AccessGuard)
@Roles(Role.Employee)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('create-order')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.payments.createOrder(dto.ticketId);
  }

  @Post('verify')
  verify(@Body() dto: VerifyOrderDto, @CurrentUser() user: AuthUser) {
    return this.payments.verify(dto.ticketId, dto.orderId, user.name);
  }
}
