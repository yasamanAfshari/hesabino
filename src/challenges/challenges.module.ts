import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Challenge } from './challenge.entity';
import { Transaction } from '../transactions/transactions.entity';
import { User } from '../users/users.entity';
import { ChallengesService } from './challenges.service';
import { ChallengesController } from './challenges.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Challenge, Transaction, User]), AuthModule],
  providers: [ChallengesService],
  controllers: [ChallengesController],
  exports: [ChallengesService],
})
export class ChallengesModule {}
