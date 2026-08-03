import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/transactions.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { BudgetModule } from '../budget/budget.module';
import { SavingsModule } from '../savings/savings.module';
import { DebtsModule } from '../debts/debts.module';
import { ChequesModule } from '../cheques/cheques.module';
import { AssetsModule } from '../assets/assets.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InstallmentsModule } from '../installments/installments.module';
import { ChallengesModule } from '../challenges/challenges.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    AuthModule,
    AccountsModule,
    BudgetModule,
    SavingsModule,
    DebtsModule,
    ChequesModule,
    AssetsModule,
    SubscriptionsModule,
    InstallmentsModule,
    ChallengesModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
