import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/access';
import { CustomerTicketsService } from './customer-tickets.service';

class CreateCustomerTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  ticketType?: string;

  @IsOptional()
  @IsIn(['High', 'Medium', 'Low'])
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

class ReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  note: string;
}

@ApiTags('solutions-customer-tickets')
@ApiBearerAuth()
@Controller('customer-tickets')
@UseGuards(JwtAuthGuard)
export class CustomerTicketsController {
  constructor(private readonly service: CustomerTicketsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user.id);
  }

  @Post()
  create(@Body() dto: CreateCustomerTicketDto, @CurrentUser() user: AuthUser) {
    return this.service.create(user.id, dto);
  }

  @Post(':id/comment')
  addComment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyDto, @CurrentUser() user: AuthUser) {
    return this.service.addComment(id, user.id, dto.note);
  }
}
