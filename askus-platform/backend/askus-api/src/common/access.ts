import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ADMIN_ROLE_PRODUCT, Permission, Product, Role } from './roles';

export interface AuthUser {
  id: string;
  name: string;
  roles: Role[];
  permissions: string[];
}

export type AuthedRequest = Request & { user: AuthUser };

const ROLES_KEY = 'roles';
const PRODUCT_KEY = 'product';
const PERMISSION_KEY = 'permission';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
// Employees/Agents need the permission granted; Admin and Super Admin pass.
export const Permissions = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
export const ProductAccess = (product: Product) => SetMetadata(PRODUCT_KEY, product);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<AuthedRequest>().user,
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; roles: Role[]; permissions?: string[]; name?: string }>(token);
      req.user = { id: payload.sub, name: payload.name ?? 'User', roles: payload.roles, permissions: payload.permissions ?? [] };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

// SuperAdmin passes everything. Admin passes everything except Super Admin-only routes. Product admins
// only reach their own product; Employees/Agents also need the route's permission.
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!user) throw new UnauthorizedException();
    if (user.roles.includes(Role.SuperAdmin)) return true;

    const targets = [ctx.getHandler(), ctx.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    const product = this.reflector.getAllAndOverride<Product | undefined>(PRODUCT_KEY, targets);

    const isAdmin = user.roles.includes(Role.Admin);
    const held = isAdmin ? [...user.roles, Role.Employee, Role.Agent] : user.roles;
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, targets);

    if (roles?.length && !roles.some((r) => held.includes(r))) throw new ForbiddenException();
    if (permission && !isAdmin && !user.permissions.includes(permission)) throw new ForbiddenException();
    if (product && !user.roles.some((r) => ADMIN_ROLE_PRODUCT[r] === product)) throw new ForbiddenException();
    return true;
  }
}
