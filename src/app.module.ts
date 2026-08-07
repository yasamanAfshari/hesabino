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
import { SavingsModule } from './savings/savings.module';
import { SavingGoal } from './savings/saving-goal.entity';
import { SavingDeposit } from './savings/saving-deposit.entity';
import { ChequesModule } from './cheques/cheques.module';
import { Cheque } from './cheques/cheque.entity';
import { DebtsModule } from './debts/debts.module';
import { DebtRecord } from './debts/debt-record.entity';
import { AccountsModule } from './accounts/accounts.module';
import { Account } from './accounts/accounts.entity';
import { TransfersModule } from './transfers/transfers.module';
import { Transfer } from './transfers/transfer.entity';
import { AssetsModule } from './assets/assets.module';
import { Asset } from './assets/asset.entity';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { Subscription } from './subscriptions/subscription.entity';
import { InstallmentsModule } from './installments/installments.module';
import { Loan } from './installments/loan.entity';
import { ChallengesModule } from './challenges/challenges.module';
import { Challenge } from './challenges/challenge.entity';
import { DashboardModule } from './dashboard/dashboard.module';
import { AiModule } from './ai/ai.module';
import { RemindersModule } from './reminders/reminders.module';
import { ReportsModule } from './reports/reports.module';
import { IncomeModule } from './income/income.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // محدودیت پیش‌فرض روی کل API: حداکثر ۲۰۰ درخواست در دقیقه برای هر IP.
    // عدد قبلی (۳۰ در دقیقه) برای یک اپ چندصفحه‌ای که هر صفحه چند تا فچ همزمان
    // می‌زنه (خلاصه‌ی آماری + لیست + یادآورها و...) خیلی کم بود و با استفاده‌ی
    // عادی (نه حمله) هم ۴۲۹ می‌داد. برای ورود/ثبت‌نام (که باید سخت‌گیرانه‌تر
    // باشه در برابر حدس رمز) یک محدودیت جدا و تنگ‌تر روی همون کنترلر گذاشته شده.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME', 'root'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'hesabino'),
        entities: [User, Transaction, Budget, BudgetCategory, SavingGoal, SavingDeposit, Cheque, DebtRecord, Account, Transfer, Asset, Subscription, Loan, Challenge],
        synchronize: true,
      }),
    }),
    UsersModule,
    AuthModule,
    TransactionsModule,
    BudgetModule,
    SavingsModule,
    ChequesModule,
    DebtsModule,
    AccountsModule,
    TransfersModule,
    AssetsModule,
    SubscriptionsModule,
    InstallmentsModule,
    ChallengesModule,
    DashboardModule,
    AiModule,
    RemindersModule,
    ReportsModule,
    IncomeModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}