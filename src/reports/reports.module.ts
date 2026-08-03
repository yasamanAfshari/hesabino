import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transactions/transactions.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AuthModule } from '../auth/auth.module';
import { DebtsModule } from '../debts/debts.module';
import { ChequesModule } from '../cheques/cheques.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    AuthModule,
    DebtsModule,
    ChequesModule,
    AiModule,
  ],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
