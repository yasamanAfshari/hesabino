import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { join } from 'path';
import expressLayouts from 'express-ejs-layouts';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
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

  // فعال‌سازی express-ejs-layouts تا main.ejs به‌عنوان layout مشترک همه صفحات اعمال بشه
  app.use(expressLayouts);
  app.set('layout', 'main');

  await app.listen(3000);
  console.log('🚀 Server is running on http://localhost:3000');
}
bootstrap();