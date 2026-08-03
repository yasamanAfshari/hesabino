import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transfer } from './transfer.entity';
import { Account } from '../accounts/accounts.entity';
import { Transaction } from '../transactions/transactions.entity';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer, Account, Transaction]),
    AuthModule,
    AccountsModule,
  ],
  providers: [TransfersService],
  controllers: [TransfersController],
  exports: [TransfersService],
})
export class TransfersModule {}
