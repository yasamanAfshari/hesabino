import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { CalculateBudgetDto } from './dto/calculate-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  // ===== وضعیت کامل بودجه‌ی ماه جاری (کارت‌های بالا + وضعیت هر دسته) =====
  @Get()
  async getOverview(@Req() req: any) {
    return this.budgetService.getOverview(req.user.userId);
  }

  // ===== محاسبه‌ی خودکار بودجه‌ی هر دسته از روی درآمد =====
  @Post('calculate')
  async calculate(@Req() req: any, @Body() dto: CalculateBudgetDto) {
    return this.budgetService.calculate(req.user.userId, dto);
  }

  // ===== ثبت/ویرایش دستی بودجه‌ی هر دسته =====
  @Put()
  async update(@Req() req: any, @Body() dto: UpdateBudgetDto) {
    return this.budgetService.update(req.user.userId, dto);
  }
}
