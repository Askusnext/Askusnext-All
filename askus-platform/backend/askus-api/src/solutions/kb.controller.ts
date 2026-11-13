import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessGuard, JwtAuthGuard, Roles } from '../common/access';
import { Role } from '../common/roles';
import { KBCategory } from './solutions.entities';
import { KbService } from './kb.service';

const CATEGORIES = ['O2Taxi', 'AlphaaInsurance', 'AlphaaLoans', 'General'];

class CreateArticleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: KBCategory;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: KBCategory;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

@ApiTags('solutions-kb')
@Controller('kb')
export class KbController {
  constructor(private readonly kb: KbService) {}

  @Get()
  findPublished(@Query('category') category?: string, @Query('search') search?: string) {
    return this.kb.findPublished(category, search);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @Roles(Role.SuperAdmin)
  @Get('admin/all')
  findAllAdmin() {
    return this.kb.findAllAdmin();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.kb.findBySlug(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @Roles(Role.SuperAdmin)
  @Post()
  create(@Body() dto: CreateArticleDto) {
    return this.kb.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @Roles(Role.SuperAdmin)
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateArticleDto) {
    return this.kb.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AccessGuard)
  @Roles(Role.SuperAdmin)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.kb.remove(id);
  }
}
