import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './person.entity';
import { PersonLedgerEntry } from './person-ledger-entry.entity';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Person, PersonLedgerEntry]), AuthModule],
  providers: [PersonsService],
  controllers: [PersonsController],
  exports: [TypeOrmModule, PersonsService],
})
export class PersonsModule {}
