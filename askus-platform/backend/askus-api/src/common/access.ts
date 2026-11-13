import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ADMIN_ROLE_PRODUCT, Product, Role } from './roles';

export interface AuthUser {
  id: string;
  name: string;
  roles: Role[];
}

export type AuthedRequest = Request & { user: AuthUser };

const ROLES_KEY = 'roles';
const PRODUCT_KEY = 'product';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
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
      const payload = await this.jwt.verifyAsync<{ sub: string; roles: Role[]; name?: string }>(token);
      req.user = { id: payload.sub, name: payload.name ?? 'User', roles: payload.roles };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

// SuperAdmin passes everything; product admins only reach their own product.
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

    if (roles?.length && !roles.some((r) => user.roles.includes(r))) throw new ForbiddenException();
    if (product && !user.roles.some((r) => ADMIN_ROLE_PRODUCT[r] === product)) throw new ForbiddenException();
    return true;
  }
}
