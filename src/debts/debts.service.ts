import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtRecord } from './debt-record.entity';
import { findOwnedOrThrow } from '../common/find-owned.util';
import { CreateDebtRecordDto } from './dto/create-debt-record.dto';
import { UpdateDebtRecordDto } from './dto/update-debt-record.dto';
import { remainingDaysUntil } from './date.util';

// وضعیت رکورد فقط «پرداخت شده / پرداخت نشده» است؛ سررسید گذشته یک وضعیتِ جدا از
// پرداخت نیست، بلکه یک برچسبِ اضافه روی رکوردهای پرداخت‌نشده‌ست (فیلد isOverdue).
// چون کاربر با دیدن «status» می‌خواد اول از همه بدونه پرداخت شده یا نه.
export type DebtStatus = 'unpaid' | 'paid';

@Injectable()
export class DebtsService {
  constructor(
    @InjectRepository(DebtRecord)
    private debtsRepository: Repository<DebtRecord>,
  ) {}

  // ===== محاسبه‌ی وضعیت، روزهای باقی‌مانده و سررسید-گذشته-بودن برای یک رکورد =====
  private computeStatus(record: DebtRecord): {
    status: DebtStatus;
    remainingDays: number | null;
    isOverdue: boolean;
  } {
    // اگه پرداخت/وصول شده، دیگه محاسبه‌ی روزهای باقی‌مانده (که ممکنه منفی هم باشه) معنی نداره؛
    // فرانت‌اند با remainingDays === null یه «-» نشون میده.
    if (record.isPaid) {
      return { status: 'paid', remainingDays: null, isOverdue: false };
    }
    const remainingDays = remainingDaysUntil(record.dueDate);
    const isOverdue = remainingDays !== null && remainingDays < 0;
    return { status: 'unpaid', remainingDays, isOverdue };
  }

  private serialize(record: DebtRecord) {
    const { status, remainingDays, isOverdue } = this.computeStatus(record);
    return {
      ...record,
      amount: Number(record.amount),
      status,
      remainingDays,
      isOverdue,
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

  private findOwned(userId: number, id: number): Promise<DebtRecord> {
    return findOwnedOrThrow(
      this.debtsRepository,
      userId,
      id,
      'رکورد مورد نظر یافت نشد',
    );
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
