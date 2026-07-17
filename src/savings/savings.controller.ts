import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SavingsService } from './savings.service';
import { CreateSavingGoalDto } from './dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from './dto/update-saving-goal.dto';
import { AddSavingAmountDto } from './dto/add-saving-amount.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  // ===== لیست اهداف پس‌انداز + خلاصه‌ی آماری بالای صفحه =====
  @Get()
  async getOverview(@Req() req: any) {
    return this.savingsService.getOverview(req.user.userId);
  }

  // ===== ثبت هدف جدید =====
  @Post()
  async create(@Req() req: any, @Body() dto: CreateSavingGoalDto) {
    return this.savingsService.create(req.user.userId, dto);
  }

  // ===== ویرایش هدف =====
  @Put(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSavingGoalDto,
  ) {
    return this.savingsService.update(req.user.userId, id, dto);
  }

  // ===== حذف هدف =====
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.savingsService.remove(req.user.userId, id);
  }

  // ===== افزودن مبلغ به هدف =====
  @Post(':id/deposit')
  async addAmount(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddSavingAmountDto,
  ) {
    return this.savingsService.addAmount(req.user.userId, id, dto);
  }
}
