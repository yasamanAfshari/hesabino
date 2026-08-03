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
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // ===== ثبت تراکنش جدید =====
  @Post()
  async create(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(req.user.userId, dto);
  }

  // ===== لیست تراکنش‌ها (با فیلتر اختیاری از طریق کوئری‌استرینگ) =====
  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('type') type?: 'income' | 'expense' | 'transfer',
    @Query('category') category?: string,
    @Query('date') date?: string,
  ) {
    return this.transactionsService.findAll(req.user.userId, {
      search,
      type,
      category,
      date,
    });
  }

  // ===== دریافت یک تراکنش خاص =====
  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.findOne(req.user.userId, id);
  }

  // ===== ویرایش تراکنش =====
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(req.user.userId, id, dto);
  }

  // ===== حذف تراکنش =====
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.transactionsService.remove(req.user.userId, id);
    return { message: 'تراکنش با موفقیت حذف شد' };
  }
}
