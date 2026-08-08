import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ReportsService, ReportRange } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const VALID_RANGES: ReportRange[] = ['today', 'week', 'month', '3m', '6m', 'year', 'all'];

@UseGuards(JwtAuthGuard)
@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async getReport(@Req() req: any, @Query('range') range?: string) {
    const safeRange: ReportRange = VALID_RANGES.includes(range as ReportRange) ? (range as ReportRange) : 'year';
    return this.reportsService.getReport(req.user.userId, safeRange);
  }

  // جدا از گزارش اصلی، چون صدا زدن AI ممکنه چند ثانیه طول بکشه و نباید
  // نمایش نمودارها و اعداد اصلی گزارش رو معطل نگه داره
  @Get('insights')
  async getInsights(@Req() req: any, @Query('range') range?: string) {
    const safeRange: ReportRange = VALID_RANGES.includes(range as ReportRange) ? (range as ReportRange) : 'year';
    return this.reportsService.getReportInsights(req.user.userId, safeRange);
  }
}
