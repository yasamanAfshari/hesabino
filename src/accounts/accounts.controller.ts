import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  // ===== ایجاد حساب جدید =====
  @Post()
  async create(@Req() req: any, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(req.user.userId, dto);
  }

  // ===== لیست حساب‌ها (به‌همراه موجودی لحظه‌ای هر کدام) =====
  @Get()
  async findAll(@Req() req: any, @Query('includeArchived') includeArchived?: string) {
    return this.accountsService.findAll(req.user.userId, includeArchived === 'true');
  }

  // ===== خلاصه‌ی کلی حساب‌ها (برای داشبورد / سرمایه خالص) =====
  @Get('summary')
  async summary(@Req() req: any) {
    return this.accountsService.summary(req.user.userId);
  }

  // ===== دریافت یک حساب خاص =====
  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.accountsService.findOne(req.user.userId, id);
  }

  // ===== ویرایش حساب =====
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(req.user.userId, id, dto);
  }

  // ===== بازگرداندن حساب آرشیوشده =====
  @Patch(':id/restore')
  async restore(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.accountsService.restore(req.user.userId, id);
  }

  // ===== آرشیو حساب (حذف امن) =====
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.accountsService.archive(req.user.userId, id);
    return { message: 'حساب آرشیو شد' };
  }
}
