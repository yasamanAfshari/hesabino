import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingGoal } from './saving-goal.entity';
import { SavingDeposit } from './saving-deposit.entity';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavingGoal, SavingDeposit]),
    AuthModule,
  ],
  providers: [SavingsService],
  controllers: [SavingsController],
  exports: [TypeOrmModule],
})
export class SavingsModule {}
