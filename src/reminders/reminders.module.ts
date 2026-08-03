import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { AuthModule } from '../auth/auth.module';
import { ChequesModule } from '../cheques/cheques.module';
import { DebtsModule } from '../debts/debts.module';
import { SavingsModule } from '../savings/savings.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InstallmentsModule } from '../installments/installments.module';

@Module({
  imports: [
    AuthModule,
    ChequesModule,
    DebtsModule,
    SavingsModule,
    SubscriptionsModule,
    InstallmentsModule,
  ],
  providers: [RemindersService],
  controllers: [RemindersController],
  exports: [RemindersService],
})
export class RemindersModule {}
