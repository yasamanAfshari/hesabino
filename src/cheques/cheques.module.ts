import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cheque } from './cheque.entity';
import { ChequesService } from './cheques.service';
import { ChequesController } from './cheques.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cheque]), AuthModule],
  providers: [ChequesService],
  controllers: [ChequesController],
  exports: [TypeOrmModule],
})
export class ChequesModule {}
