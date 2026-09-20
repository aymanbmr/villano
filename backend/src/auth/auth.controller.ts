import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { AuthUser, Public } from './auth.decorators.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Lets the frontend validate a stored token at startup
  @Get('me')
  me(@Req() req: Request & { user: AuthUser }) {
    return req.user;
  }
}
