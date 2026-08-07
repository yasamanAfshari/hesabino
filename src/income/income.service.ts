import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Transaction } from '../transactions/transactions.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { INCOME_CATEGORIES } from '../transactions/income-categories.constant';
import { AddIncomeDto } from './dto/add-income.dto';
import { currentJalaliMonthKey, toEnglishDigits, toPersianDigits } from '../common/jalali.util';

@Injectable()
export class IncomeService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private transactionsService: TransactionsService,
  ) {}

  // ===== یک ماه شمسی را یک ماه به عقب می‌برد (برای مقایسه‌ی روند با ماه قبل) =====
  private prevMonthKey(monthKey: string): string {
    const [yStr, mStr] = monthKey.split('/');
    let y = Number(yStr);
    let m = Number(mStr) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    return `${y}/${String(m).padStart(2, '0')}`;
  }

  // ===== تراکنش‌های درآمدی یک ماه مشخص =====
  private async getMonthIncomeTransactions(userId: number, monthKey: string): Promise<Transaction[]> {
    const persianMonthKey = toPersianDigits(monthKey);
    const transactions = await this.transactionsRepository.find({
      where: [
        { userId, type: 'income', date: Like(`${monthKey}%`) },
        { userId, type: 'income', date: Like(`${persianMonthKey}%`) },
      ],
      order: { id: 'DESC' },
    });
    return transactions.filter((tx) => toEnglishDigits(tx.date || '').startsWith(monthKey));
  }

  // ===== لیست همه‌ی ماه‌هایی که حداقل یک تراکنش درآمد دارند، برای پر کردن سلکت انتخاب ماه =====
  // (ماه جاری همیشه توی لیست هست، حتی اگه هنوز درآمدی برایش ثبت نشده باشد)
  private async getAvailableMonths(userId: number): Promise<string[]> {
    const transactions = await this.transactionsRepository.find({
      where: { userId, type: 'income' },
    });
    const months = new Set<string>();
    for (const tx of transactions) {
      const normalized = toEnglishDigits(tx.date || '');
      const match = normalized.match(/^(\d{3,4})\/(\d{1,2})/);
      if (!match) continue;
      months.add(`${match[1]}/${match[2].padStart(2, '0')}`);
    }
    months.add(currentJalaliMonthKey());
    return Array.from(months).sort().reverse();
  }

  // ===== خروجی کامل و منحصر به هر ماه: جمع درآمد، ریزِ درآمد به تفکیک دسته، مقایسه با
  // ماه قبل، لیست تراکنش‌های درآمدیِ همون ماه و لیست ماه‌هایی که می‌شود بینشان جابه‌جا شد =====
  async getOverview(userId: number, month?: string) {
    const currentKey = currentJalaliMonthKey();
    const monthKey = month && /^\d{3,4}\/\d{1,2}$/.test(month)
      ? month.replace(/\/(\d)$/, '/0$1')
      : currentKey;

    const [transactions, availableMonths, prevTransactions] = await Promise.all([
      this.getMonthIncomeTransactions(userId, monthKey),
      this.getAvailableMonths(userId),
      this.getMonthIncomeTransactions(userId, this.prevMonthKey(monthKey)),
    ]);

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0;
      const category = tx.category || 'سایر';
      byCategory[category] = (byCategory[category] || 0) + amount;
      total += amount;
    }

    const categoryBreakdown = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));

    const prevTotal = prevTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const changePercent = prevTotal > 0
      ? Math.round(((total - prevTotal) / prevTotal) * 100)
      : (total > 0 ? 100 : 0);

    return {
      month: monthKey,
      isCurrentMonth: monthKey === currentKey,
      total,
      categoryBreakdown,
      previousMonth: { month: this.prevMonthKey(monthKey), total: prevTotal, changePercent },
      transactions: transactions.map((tx) => ({ ...tx, amount: Number(tx.amount) })),
      availableMonths,
      categories: INCOME_CATEGORIES,
    };
  }

  // ===== ثبت دستی یک درآمد؛ از همون مسیر ثبت تراکنش عبور می‌کند تا همه‌جای اپ
  // (داشبورد، گزارش‌ها، لیست تراکنش‌ها) بلافاصله این درآمد را ببینند =====
  async addIncome(userId: number, dto: AddIncomeDto) {
    return this.transactionsService.create(userId, {
      date: dto.date,
      title: dto.title,
      type: 'income',
      category: dto.category,
      accountId: dto.accountId,
      amount: dto.amount,
      description: dto.description,
    });
  }
}
