import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessGuard, AuthUser, CurrentUser, JwtAuthGuard } from '../common/access';
import { BusinessService } from './business.service';
import { RESOURCES, SETTINGS } from './registry';

const actor = (u: AuthUser) => ({ id: u.id, roles: u.roles as string[], permissions: u.permissions });

/**
 * One REST surface for every Business Suite list:
 *   GET    /api/business/:list          all rows the caller may see
 *   POST   /api/business/:list          create (or upsert where the list defines a natural key)
 *   PATCH  /api/business/:list/:id      partial update
 *   DELETE /api/business/:list/:id
 * Access, validation, relationships and approval rules come from ./registry.
 */
@ApiTags('business')
@ApiBearerAuth()
@Controller('business')
@UseGuards(JwtAuthGuard, AccessGuard)
export class BusinessController {
  constructor(private readonly svc: BusinessService) {}

  @Get()
  catalogue() {
    return {
      lists: RESOURCES.map((r) => ({ key: r.key, table: `business.${r.table}`, read: r.read, write: r.write, approval: Boolean(r.approval), fields: r.fields.map((f) => f.api) })),
      settings: Object.keys(SETTINGS),
    };
  }

  @Get(':list')
  list(@Param('list') list: string, @CurrentUser() user: AuthUser) {
    return this.svc.list(list, actor(user));
  }

  @Post(':list')
  create(@Param('list') list: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.svc.create(list, body ?? {}, actor(user));
  }

  @Patch(':list/:id')
  update(@Param('list') list: string, @Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.svc.update(list, id, body ?? {}, actor(user));
  }

  @Delete(':list/:id')
  @HttpCode(204)
  async remove(@Param('list') list: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.svc.remove(list, id, actor(user));
  }
}
