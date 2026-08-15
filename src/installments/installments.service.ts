import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan } from './loan.entity';
import { findOwnedOrThrow } from '../common/find-owned.util';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { TransactionsService } from '../transactions/transactions.service';
import {
  addOneJalaliMonth,
  currentJalaliDate,
  formatJalali,
  normalizeJalaliDate,
  parseJalaliDate,
  remainingDaysUntil,
  todayJalaliString,
} from '../common/jalali.util';

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Loan)
    private loansRepository: Repository<Loan>,
    private transactionsService: TransactionsService,
  ) {}

  private serialize(loan: Loan) {
    const totalAmount = Number(loan.totalAmount);
    const installmentAmount = Number(loan.installmentAmount);
    const remainingCount = Math.max(loan.installmentsCount - loan.paidCount, 0);
    const remainingAmount = remainingCount * installmentAmount;
    const progressPercent =
      loan.installmentsCount > 0
        ? Math.round((loan.paidCount / loan.installmentsCount) * 100)
        : 0;

    const daysUntilNext = loan.nextDueDate
      ? remainingDaysUntil(loan.nextDueDate)
      : null;
    const isOverdue =
      !loan.isCompleted && daysUntilNext !== null && daysUntilNext < 0;

    return {
      ...loan,
      totalAmount,
      installmentAmount,
      remainingCount,
      remainingAmount,
      progressPercent,
      daysUntilNext,
      isOverdue,
    };
  }

  // ===== لیست وام‌ها + خلاصه‌ی آماری (برای داشبورد) =====
  async getOverview(userId: number) {
    const loans = await this.loansRepository.find({
      where: { userId },
      order: { id: 'DESC' },
    });
    const serialized = loans.map((l) => this.serialize(l));
    const active = serialized.filter((l) => !l.isCompleted);

    return {
      activeCount: active.length,
      totalRemainingAmount: active.reduce(
        (sum, l) => sum + l.remainingAmount,
        0,
      ),
      overdueCount: active.filter((l) => l.isOverdue).length,
      loans: serialized,
    };
  }

  async create(userId: number, dto: CreateLoanDto) {
    const installmentAmount = Math.round(
      dto.totalAmount / dto.installmentsCount,
    );

    let firstDue = dto.firstDueDate
      ? normalizeJalaliDate(dto.firstDueDate)
      : null;
    if (!firstDue) {
      const today = currentJalaliDate();
      const next = addOneJalaliMonth(today.y, today.m, today.d);
      firstDue = formatJalali(next.y, next.m, next.d);
    }

    // اگر وام از قبل بوده و بخشی از اقساطش پرداخت شده (alreadyPaidCount)، آن‌ها را همین‌جا حساب می‌کنیم:
    // سررسید قسط بعدی به همان تعداد ماه جلو می‌رود و اگر همه پرداخت شده باشد، وام تکمیل‌شده علامت می‌خورد.
    // اگر ۰ یا خالی وارد شود، هیچ چیزی تغییر نمی‌کند (رفتار قبلی: وام کاملاً جدید).
    const alreadyPaidCount = Math.min(
      Math.max(dto.alreadyPaidCount || 0, 0),
      dto.installmentsCount,
    );

    let nextDueDate: string | null = firstDue;
    let isCompleted = false;

    if (alreadyPaidCount >= dto.installmentsCount) {
      isCompleted = true;
      nextDueDate = null;
    } else if (alreadyPaidCount > 0) {
      const parsedFirst = parseJalaliDate(firstDue);
      if (parsedFirst) {
        let cursor = { y: parsedFirst.y, m: parsedFirst.m, d: parsedFirst.d };
        for (let i = 0; i < alreadyPaidCount; i++) {
          cursor = addOneJalaliMonth(cursor.y, cursor.m, cursor.d);
        }
        nextDueDate = formatJalali(cursor.y, cursor.m, cursor.d);
      }
    }

    const loan = this.loansRepository.create({
      title: dto.title,
      totalAmount: dto.totalAmount,
      installmentsCount: dto.installmentsCount,
      installmentAmount,
      paidCount: alreadyPaidCount,
      nextDueDate,
      isCompleted,
      userId,
    } as Partial<Loan>);

    await this.loansRepository.save(loan);
    return this.getOverview(userId);
  }

  private findOwned(userId: number, id: number): Promise<Loan> {
    return findOwnedOrThrow(this.loansRepository, userId, id, 'وام یافت نشد');
  }

  async update(userId: number, id: number, dto: UpdateLoanDto) {
    const loan = await this.findOwned(userId, id);

    if (dto.paidCount > dto.installmentsCount) {
      throw new BadRequestException(
        'تعداد اقساط پرداخت‌شده نمی‌تواند از تعداد کل اقساط بیشتر باشد',
      );
    }

    loan.title = dto.title;
    loan.totalAmount = dto.totalAmount;
    loan.installmentsCount = dto.installmentsCount;
    // مبلغ هر قسط از روی مبلغ کل و تعداد اقساط مشتق می‌شه؛ پس هر بار این دو تا عوض بشن باید دوباره حساب بشه
    loan.installmentAmount = Math.round(dto.totalAmount / dto.installmentsCount);
    loan.paidCount = dto.paidCount;

    if (dto.paidCount >= dto.installmentsCount) {
      loan.isCompleted = true;
      loan.nextDueDate = null;
    } else {
      loan.isCompleted = false;
      loan.nextDueDate = normalizeJalaliDate(dto.nextDueDate) || dto.nextDueDate;
    }

    await this.loansRepository.save(loan);
    return this.getOverview(userId);
  }

  // ===== ثبت پرداخت قسط بعدی: تیک زدن قسط، کم شدن باقی‌مانده و جلو رفتن سررسید =====
  async payNextInstallment(userId: number, id: number) {
    const loan = await this.findOwned(userId, id);

    if (loan.isCompleted) {
      throw new BadRequestException('همه‌ی اقساط این وام قبلاً پرداخت شده است');
    }

    const paidInstallmentAmount = Number(loan.installmentAmount);

    loan.paidCount += 1;

    if (loan.paidCount >= loan.installmentsCount) {
      loan.isCompleted = true;
      loan.nextDueDate = null;
    } else if (loan.nextDueDate) {
      const parsed = parseJalaliDate(loan.nextDueDate);
      if (parsed) {
        const next = addOneJalaliMonth(parsed.y, parsed.m, parsed.d);
        loan.nextDueDate = formatJalali(next.y, next.m, next.d);
      }
    }

    await this.loansRepository.save(loan);

    // ثبت خودکار تراکنش هزینه برای این قسط پرداخت‌شده
    await this.transactionsService.create(userId, {
      date: todayJalaliString(),
      type: 'expense',
      title: `قسط «${loan.title}»`,
      category: 'بدهی',
      amount: paidInstallmentAmount,
      description: `پرداخت قسط ${loan.paidCount} از ${loan.installmentsCount} وام «${loan.title}»`,
    } as any);

    return this.getOverview(userId);
  }

  async remove(userId: number, id: number) {
    const loan = await this.findOwned(userId, id);
    await this.loansRepository.remove(loan);
    return this.getOverview(userId);
  }
}
