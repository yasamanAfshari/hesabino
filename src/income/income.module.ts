import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/transactions.entity';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { AuthModule } from '../auth/auth.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    AuthModule,
    TransactionsModule,
    AccountsModule,
  ],
  providers: [IncomeService],
  controllers: [IncomeController],
})
export class IncomeModule {}