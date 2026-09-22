import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppRole, AuthUser, IS_PUBLIC_KEY, ROLES_KEY } from './auth.decorators.js';

// Registered globally (APP_GUARD): every route needs a valid Bearer token
// unless marked @Public(); @Roles() further restricts by role.
const ROLE_LABELS: Record<string, string> = {
  admin: 'administrateur',
  manager: 'manager',
  caissier: 'caissier',
  serveur: 'serveur',
  barman: 'barman',
  cuisinier: 'cuisinier',
  menage: 'agent d’entretien',
};
const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Connexion requise');

    let user: AuthUser;
    try {
      user = await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }
    request.user = user;

    const roles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, targets);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException(`Accès réservé : ${roles.map(roleLabel).join(', ')}`);
    }
    return true;
  }
}
