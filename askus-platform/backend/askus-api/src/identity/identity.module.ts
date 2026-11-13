import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessGuard, JwtAuthGuard } from '../common/access';
import { IdentityController } from './identity.controller';
import { MfaMethod, OtpCode, Session, User } from './identity.entities';
import { IdentityService } from './identity.service';

// Global so every module can use JwtAuthGuard / AccessGuard.
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, OtpCode, Session, MfaMethod]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [IdentityService, JwtAuthGuard, AccessGuard],
  exports: [JwtModule, JwtAuthGuard, AccessGuard, TypeOrmModule],
})
export class IdentityModule {}
