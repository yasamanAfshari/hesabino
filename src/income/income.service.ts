import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Transaction } from '../transactions/transactions.entity';
import { TransactionsService } from '../transactions/transactions.service';
import { AccountsService } from '../accounts/accounts.service';
import { INCOME_CATEGORIES } from '../transactions/income-categories.constant';
import { AddIncomeDto } from './dto/add-income.dto';
import { currentJalaliMonthKey, toEnglishDigits, toPersianDigits } from '../common/jalali.util';

@Injectable()
export class IncomeService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private transactionsService: TransactionsService,
    private accountsService: AccountsService,
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
      relations: { accountRef: true },
      order: { id: 'DESC' },
    });
    return transactions.filter((tx) => toEnglishDigits(tx.date || '').startsWith(monthKey));
  }

  // ===== خروجی استاندارد یک تراکنش درآمدی برای فرانت: amount عددی + نام حساب مرتبط =====
  private serializeTransaction(tx: Transaction) {
    return {
      ...tx,
      amount: Number(tx.amount),
      accountName: tx.accountRef ? tx.accountRef.name : null,
    };
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

  // ===== جمع هزینه‌های یک ماه مشخص، به تفکیک حساب برداشت‌شده =====
  private async getMonthExpenseByAccount(userId: number, monthKey: string): Promise<Map<number, number>> {
    const persianMonthKey = toPersianDigits(monthKey);
    const expenses = await this.transactionsRepository.find({
      where: [
        { userId, type: 'expense', date: Like(`${monthKey}%`) },
        { userId, type: 'expense', date: Like(`${persianMonthKey}%`) },
      ],
    });

    const map = new Map<number, number>();
    for (const tx of expenses) {
      if (!toEnglishDigits(tx.date || '').startsWith(monthKey)) continue;
      if (tx.accountId == null) continue;
      map.set(tx.accountId, (map.get(tx.accountId) || 0) + (Number(tx.amount) || 0));
    }
    return map;
  }

  // ===== وضعیت هر حساب در همین ماه: کل برداشت (هزینه) ازش و باقی‌مونده (درآمدی که
  // همین ماه به این حساب واریز شده منهای برداشتی که همین ماه ازش شده) =====
  private async getAccountWithdrawals(
    userId: number,
    monthKey: string,
    incomeByAccount: Record<string, { accountName: string; amount: number }>,
  ) {
    const accounts = await this.accountsService.findAll(userId, false);
    if (!accounts.length) return [];

    const withdrawnByAccount = await this.getMonthExpenseByAccount(userId, monthKey);

    return accounts.map((a) => {
      const income = incomeByAccount[String(a.id)]?.amount || 0;
      const withdrawn = withdrawnByAccount.get(a.id) || 0;
      return {
        accountId: a.id,
        accountName: a.name,
        withdrawn,
        remaining: income - withdrawn,
      };
    });
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
    // ===== ریز درآمد به تفکیک حساب مقصد (کلید: accountId یا 'none' برای تراکنش‌های بدون حساب) =====
    const byAccount: Record<string, { accountName: string; amount: number }> = {};
    let total = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0;
      const category = tx.category || 'سایر';
      byCategory[category] = (byCategory[category] || 0) + amount;

      const accountKey = tx.accountId != null ? String(tx.accountId) : 'none';
      const accountName = tx.accountRef ? tx.accountRef.name : 'بدون حساب';
      if (!byAccount[accountKey]) {
        byAccount[accountKey] = { accountName, amount: 0 };
      }
      byAccount[accountKey].amount += amount;

      total += amount;
    }

    const accountWithdrawals = await this.getAccountWithdrawals(userId, monthKey, byAccount);

    const categoryBreakdown = Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));

    const accountBreakdown = Object.entries(byAccount)
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([accountId, { accountName, amount }]) => ({
        accountId: accountId === 'none' ? null : Number(accountId),
        accountName,
        amount,
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
      accountBreakdown,
      accountWithdrawals,
      previousMonth: { month: this.prevMonthKey(monthKey), total: prevTotal, changePercent },
      transactions: transactions.map((tx) => this.serializeTransaction(tx)),
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