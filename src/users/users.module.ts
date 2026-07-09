import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module'; // این خط رو اضافه کن

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    AuthModule, // این خط رو اضافه کن
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}