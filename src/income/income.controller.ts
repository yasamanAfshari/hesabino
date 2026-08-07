import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IncomeService } from './income.service';
import { AddIncomeDto } from './dto/add-income.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  // ===== خروجی کامل درآمد یک ماه (پیش‌فرض: ماه جاری)؛ month به فرمت YYYY/MM =====
  @Get()
  async getOverview(@Req() req: any, @Query('month') month?: string) {
    return this.incomeService.getOverview(req.user.userId, month);
  }

  // ===== ثبت دستی سریع یک درآمد (بدون رفتن به صفحه‌ی تراکنش‌ها) =====
  @Post()
  async addIncome(@Req() req: any, @Body() dto: AddIncomeDto) {
    return this.incomeService.addIncome(req.user.userId, dto);
  }
}
