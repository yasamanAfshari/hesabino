import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  // ===== لیست اشخاص + مانده‌ی هرکدوم + خلاصه‌ی کلی =====
  @Get()
  async listPeople(@Req() req: any) {
    return this.personsService.listPeople(req.user.userId);
  }

  // ===== ثبت شخص جدید =====
  @Post()
  async createPerson(@Req() req: any, @Body() dto: CreatePersonDto) {
    return this.personsService.createPerson(req.user.userId, dto);
  }

  // ===== جزئیات یک شخص + لیست تراکنش‌های خرد =====
  @Get(':id')
  async getPersonDetail(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.personsService.getPersonDetail(req.user.userId, id);
  }

  // ===== ویرایش نام/توضیح شخص =====
  @Patch(':id')
  async updatePerson(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.personsService.updatePerson(req.user.userId, id, dto);
  }

  // ===== حذف شخص =====
  @Delete(':id')
  async removePerson(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.personsService.removePerson(req.user.userId, id);
  }

  // ===== افزودن تراکنش خرد جدید به حساب یک شخص =====
  @Post(':id/entries')
  async addEntry(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLedgerEntryDto,
  ) {
    return this.personsService.addEntry(req.user.userId, id, dto);
  }

  // ===== ویرایش یک تراکنش خرد =====
  @Patch(':id/entries/:entryId')
  async updateEntry(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: UpdateLedgerEntryDto,
  ) {
    return this.personsService.updateEntry(req.user.userId, id, entryId, dto);
  }

  // ===== حذف یک تراکنش خرد =====
  @Delete(':id/entries/:entryId')
  async removeEntry(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Param('entryId', ParseIntPipe) entryId: number,
  ) {
    return this.personsService.removeEntry(req.user.userId, id, entryId);
  }
}
