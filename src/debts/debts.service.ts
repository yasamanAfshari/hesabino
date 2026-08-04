import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtRecord } from './debt-record.entity';
import { CreateDebtRecordDto } from './dto/create-debt-record.dto';
import { UpdateDebtRecordDto } from './dto/update-debt-record.dto';
import { remainingDaysUntil } from './date.util';

export type DebtStatus = 'unpaid' | 'paid' | 'overdue';

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(DebtRecord)
    private debtsRepository: Repository<DebtRecord>,
  ) {}

  // ===== محاسبه‌ی وضعیت و روزهای باقی‌مانده برای یک رکورد =====
  private computeStatus(record: DebtRecord): { status: DebtStatus; remainingDays: number | null } {
    // اگه پرداخت/وصول شده، دیگه محاسبه‌ی روزهای باقی‌مانده (که ممکنه منفی هم باشه) معنی نداره؛
    // فرانت‌اند با remainingDays === null یه «-» نشون میده.
    if (record.isPaid) {
      return { status: 'paid', remainingDays: null };
    }
    const remainingDays = remainingDaysUntil(record.dueDate);
    if (remainingDays !== null && remainingDays < 0) {
      return { status: 'overdue', remainingDays };
    }
    return { status: 'unpaid', remainingDays };
  }

  private serialize(record: DebtRecord) {
    const { status, remainingDays } = this.computeStatus(record);
    return {
      ...record,
      amount: Number(record.amount),
      status,
      remainingDays,
    };
  }

  // ===== خلاصه‌ی آماری بالای صفحه: بدهی من، طلب از دیگران، خالص =====
  private buildSummary(records: DebtRecord[]) {
    const myDebt = records
      .filter((r) => r.type === 'debt' && !r.isPaid)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    const receivable = records
      .filter((r) => r.type === 'receivable' && !r.isPaid)
      .reduce((sum, r) => sum + Number(r.amount), 0);

    return {
      myDebt,
      receivable,
      net: receivable - myDebt,
    };
  }

  // ===== لیست کامل بدهی‌ها و طلب‌های کاربر + خلاصه‌ی آماری =====
  async getOverview(userId: number) {
    const records = await this.debtsRepository.find({
      where: { userId },
      order: { id: 'DESC' },
    });

    return {
      summary: this.buildSummary(records),
      items: records.map((r) => this.serialize(r)),
    };
  }

  // ===== ثبت بدهی/طلب جدید =====
  async create(userId: number, dto: CreateDebtRecordDto) {
    const record = this.debtsRepository.create({
      ...dto,
      isPaid: !!dto.isPaid,
      reminder: !!dto.reminder,
      userId,
    });
    await this.debtsRepository.save(record);
    return this.getOverview(userId);
  }

  private async findOwned(userId: number, id: number): Promise<DebtRecord> {
    const record = await this.debtsRepository.findOne({ where: { id, userId } });
    if (!record) {
      throw new NotFoundException('رکورد مورد نظر یافت نشد');
    }
    return record;
  }

  async findOne(userId: number, id: number) {
    const record = await this.findOwned(userId, id);
    return this.serialize(record);
  }

  // ===== ویرایش بدهی/طلب =====
  async update(userId: number, id: number, dto: UpdateDebtRecordDto) {
    const record = await this.findOwned(userId, id);
    Object.assign(record, dto);
    await this.debtsRepository.save(record);
    return this.getOverview(userId);
  }

  // ===== حذف بدهی/طلب =====
  async remove(userId: number, id: number) {
    const record = await this.findOwned(userId, id);
    await this.debtsRepository.remove(record);
    return this.getOverview(userId);
  }
}
