import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  // ===== ثبت انتقال جدید بین دو حساب =====
  @Post()
  async create(@Req() req: any, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(req.user.userId, dto);
  }

  // ===== لیست انتقال‌ها =====
  @Get()
  async findAll(@Req() req: any) {
    return this.transfersService.findAll(req.user.userId);
  }

  // ===== یک انتقال خاص =====
  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.transfersService.findOne(req.user.userId, id);
  }

  // ===== حذف انتقال =====
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.transfersService.remove(req.user.userId, id);
    return { message: 'انتقال حذف شد' };
  }
}
