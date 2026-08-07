import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // ===== خروجی یک‌جای همه‌ی داده‌های موردنیاز صفحه‌ی داشبورد =====
  // period: فیلتر سراسری بازه‌ی زمانی از هدر (امروز/هفته/ماه/سال)
  @Get()
  async getOverview(@Req() req: any, @Query('period') period?: string) {
    return this.dashboardService.getOverview(req.user.userId, period);
  }

  // ===== هزینه به تفکیک دسته برای بازه‌ی انتخابی (دکمه‌های امروز/هفته/ماه/سال) =====
  @Get('category-breakdown')
  async getCategoryBreakdown(@Req() req: any, @Query('period') period?: string) {
    return this.dashboardService.getCategoryBreakdown(req.user.userId, period || 'month');
  }
}
