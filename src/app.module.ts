import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { User } from './users/users.entity';
import { TransactionsModule } from './transactions/transactions.module';
import { Transaction } from './transactions/transactions.entity';
import { BudgetModule } from './budget/budget.module';
import { Budget } from './budget/budget.entity';
import { BudgetCategory } from './budget/budget-category.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // محدودیت پیش‌فرض روی کل API: حداکثر ۳۰ درخواست در دقیقه برای هر IP
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'hesabino'),
        entities: [User, Transaction, Budget, BudgetCategory],
        synchronize: true,
      }),
    }),
    UsersModule,
    AuthModule,
    TransactionsModule,
    BudgetModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}