import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChequesService } from './cheques.service';
import { CreateChequeDto } from './dto/create-cheque.dto';
import { UpdateChequeDto } from './dto/update-cheque.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/cheques')
export class ChequesController {
  constructor(private readonly chequesService: ChequesService) {}

  // ===== لیست چک‌ها + خلاصه‌ی آماری بالای صفحه (با فیلتر اختیاری از طریق کوئری‌استرینگ) =====
  @Get()
  async getOverview(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('type') type?: 'received' | 'paid',
    @Query('status') status?: 'pending' | 'cashed' | 'bounced',
    @Query('date') date?: string,
  ) {
    return this.chequesService.getOverview(req.user.userId, {
      search,
      type,
      status,
      date,
    });
  }

  // ===== ثبت چک جدید =====
  @Post()
  async create(@Req() req: any, @Body() dto: CreateChequeDto) {
    return this.chequesService.create(req.user.userId, dto);
  }

  // ===== دریافت یک چک خاص =====
  @Get(':id')
  async findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.chequesService.findOne(req.user.userId, id);
  }

  // ===== ویرایش چک =====
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChequeDto,
  ) {
    return this.chequesService.update(req.user.userId, id, dto);
  }

  // ===== حذف چک =====
  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.chequesService.remove(req.user.userId, id);
  }
}
