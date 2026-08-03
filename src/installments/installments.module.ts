import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loan } from './loan.entity';
import { InstallmentsService } from './installments.service';
import { InstallmentsController } from './installments.controller';
import { AuthModule } from '../auth/auth.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [TypeOrmModule.forFeature([Loan]), AuthModule, TransactionsModule],
  providers: [InstallmentsService],
  controllers: [InstallmentsController],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
