import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from './budget.entity';
import { BudgetCategory } from './budget-category.entity';
import { Transaction } from '../transactions/transactions.entity';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Budget, BudgetCategory, Transaction]),
    AuthModule,
  ],
  providers: [BudgetService],
  controllers: [BudgetController],
})
export class BudgetModule {}
