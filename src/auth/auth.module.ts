import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { JWT_SECRET_ENV_KEY, INSECURE_FALLBACK_SECRET } from './constants';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>(JWT_SECRET_ENV_KEY);
        if (!secret) {
          console.warn(
            '⚠️  JWT_SECRET در فایل .env تنظیم نشده. در حال استفاده از یک مقدار پیش‌فرض ناامن هستیم؛ ' +
              'این فقط برای توسعه‌ی محلی قابل قبوله، حتماً قبل از انتشار روی سرور واقعی، .env را تنظیم کنید.',
          );
        }
        return {
          secret: secret || INSECURE_FALLBACK_SECRET,
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService], // این خط رو اضافه کن
})
export class AuthModule {}