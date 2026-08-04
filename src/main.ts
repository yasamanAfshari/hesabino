import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { join } from 'path';
import expressLayouts from 'express-ejs-layouts';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(
    helmet({
      // چون فایل‌های CSS/JS این پروژه از همون سرور با روش معمولی (نه nonce/hash) لود می‌شن،
      // CSP پیش‌فرض helmet رو غیرفعال می‌کنیم تا چیزی بلاک نشه؛ بقیه‌ی هدرهای امنیتی (مثل
      // X-Frame-Options، X-Content-Type-Options و...) فعال می‌مونن.
      contentSecurityPolicy: false,
    }),
  );

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const message = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .join(' | ');
        return new BadRequestException(message || 'اطلاعات ارسالی نامعتبر است');
      },
    }),
  );

  const viewsPath = join(__dirname, '..', 'views');
  console.log('📁 Views path:', viewsPath); // ← این خط را اضافه کنید

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(viewsPath);
  app.setViewEngine('ejs');

  // نسخه‌ای برای cache-busting فایل‌های استاتیک (JS/CSS) — با هر بار بالا اومدن سرور
  // عوض می‌شه، تا مرورگر کاربرها بعد از هر دیپلوی مجبور بشن نسخه‌ی تازه رو دانلود کنن
  // و به مشکل «فایل قدیمی از کش مرورگر» (مثل باگ فیلترهای صفحه‌ی debts) دچار نشیم.
  const assetVersion = Date.now();
  app.use((req, res, next) => {
    res.locals.assetVersion = assetVersion;
    next();
  });

  // فعال‌سازی express-ejs-layouts تا main.ejs به‌عنوان layout مشترک همه صفحات اعمال بشه
  app.use(expressLayouts);
  app.set('layout', 'main');

  await app.listen(3000);
  console.log('🚀 Server is running on http://localhost:3000');
}
bootstrap();