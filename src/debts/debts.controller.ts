import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DebtsService } from './debts.service';
import { CreateDebtRecordDto } from './dto/create-debt-record.dto';
import { UpdateDebtRecordDto } from './dto/update-debt-record.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  // ===== لیست بدهی‌ها/طلب‌ها + خلاصه‌ی آماری بالای صفحه =====
  @Get()
  async getOverview(@Req() req: any) {
    return this.debtsService.getOverview(req.user.userId);
  }

  // ===== ثبت بدهی/طلب جدید =====
  @Post()
  async create(@Req() req: any, @Body() dto: CreateDebtRecordDto) {
    return this.debtsService.create(req.user.userId, dto);
  }

  // ===== دریافت یک رکورد خاص =====
  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.debtsService.findOne(req.user.userId, id);
  }

  // ===== ویرایش بدهی/طلب =====
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDebtRecordDto,
  ) {
    return this.debtsService.update(req.user.userId, id, dto);
  }

  // ===== حذف بدهی/طلب =====
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.debtsService.remove(req.user.userId, id);
  }
}
