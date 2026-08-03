import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { CategorizeDto } from './dto/categorize.dto';
import { AskDto } from './dto/ask.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly dashboardService: DashboardService,
  ) {}

  // ===== وضعیت فعال/غیرفعال بودن هوش مصنوعی (برای نمایش مناسب در رابط کاربری) =====
  @Get('status')
  status() {
    return { enabled: this.aiService.isEnabled };
  }

  // ===== دسته‌بندی خودکار تراکنش از روی عنوان، مثلاً «اسنپ» → «حمل و نقل» =====
  @Post('categorize')
  async categorize(@Body() dto: CategorizeDto) {
    return this.aiService.categorizeTransaction(dto.title, dto.type);
  }

  // ===== تحلیل و پیشنهاد هوشمند بر اساس وضعیت مالی واقعی همین ماه کاربر =====
  @Get('insight')
  async insight(@Req() req: any) {
    const dashboard = await this.dashboardService.getOverview(req.user.userId);
    const snapshot = this.aiService.buildSnapshot(dashboard);
    return this.aiService.generateMonthlyInsight(snapshot);
  }

  // ===== چت مالی: پاسخ به سوال آزاد کاربر بر اساس داده‌های واقعی‌اش =====
  @Post('ask')
  async ask(@Req() req: any, @Body() dto: AskDto) {
    const dashboard = await this.dashboardService.getOverview(req.user.userId);
    const snapshot = this.aiService.buildSnapshot(dashboard);
    return this.aiService.answerQuestion(dto.question, snapshot);
  }
}
