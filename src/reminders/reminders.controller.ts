import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  // ===== همه‌ی یادآورهای کاربر: هم موارد تیک‌خورده‌ی دستی (چک/بدهی/پس‌انداز) هم موارد خودکار (اشتراک/قسط) =====
  @Get()
  async getAll(@Req() req: any) {
    return this.remindersService.getAllReminders(req.user.userId);
  }
}
