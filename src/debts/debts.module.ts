import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtRecord } from './debt-record.entity';
import { DebtsService } from './debts.service';
import { DebtsController } from './debts.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([DebtRecord]), AuthModule],
  providers: [DebtsService],
  controllers: [DebtsController],
  exports: [TypeOrmModule, DebtsService],
})
export class DebtsModule {}
