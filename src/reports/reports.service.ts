import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../transactions/transactions.entity';
import { DebtsService } from '../debts/debts.service';
import { ChequesService } from '../cheques/cheques.service';
import { AiService } from '../ai/ai.service';
import { BUDGET_CATEGORIES } from '../budget/budget.constants';
import {
  currentJalaliDate,
  remainingDaysUntil,
  toEnglishDigits,
  toPersianDigits,
} from '../common/jalali.util';

export type ReportRange = 'month' | '3m' | '6m' | 'year' | 'all';

interface MonthBucket {
  income: number;
  expense: number;
  byCategory: Record<string, number>;
  transactionCount: number;
}

const PERSIAN_MONTH_NAMES: Record<number, string> = {
  1: 'فروردین', 2: 'اردیبهشت', 3: 'خرداد', 4: 'تیر', 5: 'مرداد', 6: 'شهریور',
  7: 'مهر', 8: 'آبان', 9: 'آذر', 10: 'دی', 11: 'بهمن', 12: 'اسفند',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private debtsService: DebtsService,
    private chequesService: ChequesService,
    private aiService: AiService,
  ) {}

  private shiftMonthKey(y: number, m: number, monthsBack: number): { y: number; m: number } {
    let ny = y;
    let nm = m;
    for (let i = 0; i < monthsBack; i++) {
      nm -= 1;
      if (nm < 1) {
        nm = 12;
        ny -= 1;
      }
    }
    return { y: ny, m: nm };
  }

  private monthKeyStr(y: number, m: number): string {
    return `${y}/${String(m).padStart(2, '0')}`;
  }

  // ===== تمام تراکنش‌های کاربر را یک‌بار می‌خواند و بر اساس ماه (YYYY/MM) دسته‌بندی می‌کند =====
  private async loadAllMonthBuckets(userId: number): Promise<Map<string, MonthBucket>> {
    const transactions = await this.transactionsRepository.find({ where: { userId } });
    const buckets = new Map<string, MonthBucket>();

    for (const tx of transactions) {
      const normalizedDate = toEnglishDigits(tx.date || '');
      const match = normalizedDate.match(/^(\d{3,4})\/(\d{1,2})/);
      if (!match) continue;
      const monthKey = `${match[1]}/${match[2].padStart(2, '0')}`;

      if (!buckets.has(monthKey)) {
        buckets.set(monthKey, { income: 0, expense: 0, byCategory: {}, transactionCount: 0 });
      }
      const bucket = buckets.get(monthKey) as MonthBucket;
      bucket.transactionCount += 1;

      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        bucket.income += amount;
      } else if (tx.type === 'expense') {
        bucket.expense += amount;
        const category = tx.category || 'سایر';
        bucket.byCategory[category] = (bucket.byCategory[category] || 0) + amount;
      }
      // رکوردهای type = 'transfer' (آینه‌ی انتقال بین حساب‌ها) نه درآمدند نه هزینه،
      // پس در این گزارش‌ها شرکت داده نمی‌شن
    }

    return buckets;
  }

  // ===== لیست ماه‌های داخل بازه‌ی انتخاب‌شده، از قدیم به جدید =====
  private resolveRangeMonthKeys(range: ReportRange, allBuckets: Map<string, MonthBucket>): string[] {
    const today = currentJalaliDate();

    if (range === 'all') {
      return Array.from(allBuckets.keys()).sort();
    }

    if (range === 'year') {
      const keys: string[] = [];
      for (let m = 1; m <= today.m; m++) keys.push(this.monthKeyStr(today.y, m));
      return keys;
    }

    const monthsBack = range === 'month' ? 0 : range === '3m' ? 2 : 5; // '6m' => 5
    const keys: string[] = [];
    for (let i = monthsBack; i >= 0; i--) {
      const { y, m } = this.shiftMonthKey(today.y, today.m, i);
      keys.push(this.monthKeyStr(y, m));
    }
    return keys;
  }

  async getReport(userId: number, range: ReportRange = 'year') {
    const allBuckets = await this.loadAllMonthBuckets(userId);
    const monthKeys = this.resolveRangeMonthKeys(range, allBuckets);

    const empty = (): MonthBucket => ({ income: 0, expense: 0, byCategory: {}, transactionCount: 0 });

    // ===== نمودار جریان مالی: فقط ماه‌هایی که واقعاً تراکنش دارند وارد نمودارهای میله‌ای/حلقه‌ای می‌شوند =====
    const cashFlow = monthKeys.map((key) => {
      const b = allBuckets.get(key) || empty();
      return {
        month: key,
        monthLabel: PERSIAN_MONTH_NAMES[Number(key.split('/')[1])] || key,
        income: b.income,
        expense: b.expense,
        hasData: b.transactionCount > 0,
      };
    });

    // ===== روند تجمعی تراز (برای نمودار خطی جریان مالی دوم): حتی ماه‌های بدون تراکنش هم اینجا می‌مانند
    // چون «بدون تغییر» خودش یک واقعیت معتبر برای خط تجمعی است، نه داده‌ی ساختگی =====
    let running = 0;
    const cumulativeTrend = cashFlow.map((m) => {
      running += m.income - m.expense;
      return { month: m.month, monthLabel: m.monthLabel, cumulativeBalance: running };
    });

    // ===== مجموع کل بازه =====
    const totalIncome = cashFlow.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = cashFlow.reduce((sum, m) => sum + m.expense, 0);
    const totalSavings = totalIncome - totalExpense;

    // ===== هزینه به تفکیک دسته، در کل بازه‌ی انتخابی =====
    const categoryTotals: Record<string, number> = {};
    for (const key of monthKeys) {
      const b = allBuckets.get(key);
      if (!b) continue;
      for (const [cat, amount] of Object.entries(b.byCategory)) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      }
    }
    const categoryBreakdown = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        percent: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
      }));
    const top5Categories = categoryBreakdown.slice(0, 5);

    // ===== جدول میانگین هزینه‌ها: مقایسه‌ی نرخ ماهانه‌ی این بازه با میانگین تاریخی واقعی هر دسته =====
    const allMonthKeysSorted = Array.from(allBuckets.keys()).sort();
    const categoryAverages = BUDGET_CATEGORIES
      .map((category) => {
        // میانگین تاریخی: مجموع کل تاریخچه‌ی این دسته تقسیم بر تعداد ماه‌هایی که واقعاً در آن‌ها خرج شده
        let allTimeTotal = 0;
        let allTimeActiveMonths = 0;
        for (const key of allMonthKeysSorted) {
          const amount = allBuckets.get(key)?.byCategory[category] || 0;
          if (amount > 0) {
            allTimeTotal += amount;
            allTimeActiveMonths += 1;
          }
        }
        const monthlyAverage = allTimeActiveMonths > 0 ? Math.round(allTimeTotal / allTimeActiveMonths) : 0;

        // نرخ در بازه‌ی انتخابی: مجموع بازه تقسیم بر تعداد ماه‌های فعال همان بازه
        const rangeExpense = categoryTotals[category] || 0;
        const activeMonthsInRange = monthKeys.filter((key) => (allBuckets.get(key)?.byCategory[category] || 0) > 0).length;
        const periodRate = activeMonthsInRange > 0 ? rangeExpense / activeMonthsInRange : 0;

        let comparisonPercent: number | null = null;
        if (monthlyAverage > 0 && rangeExpense > 0) {
          comparisonPercent = Math.round(((periodRate - monthlyAverage) / monthlyAverage) * 100);
        } else if (rangeExpense > 0 && monthlyAverage === 0) {
          comparisonPercent = 100;
        }

        return { category, monthlyAverage, rangeExpense, comparisonPercent };
      })
      .filter((row) => row.monthlyAverage > 0 || row.rangeExpense > 0)
      .sort((a, b) => b.rangeExpense - a.rangeExpense);

    // ===== خلاصه‌ی وضعیت چک و بدهی (وضعیت لحظه‌ای، مستقل از بازه‌ی انتخابی گزارش) =====
    const [debtsOverview, chequesOverview] = await Promise.all([
      this.debtsService.getOverview(userId),
      this.chequesService.getOverview(userId),
    ]);

    const pendingChequesCount = chequesOverview.cheques.filter((c: any) => c.status === 'pending').length;
    const overdueDebtsCount = debtsOverview.items.filter((d: any) => {
      if (d.type !== 'debt' || d.isPaid) return false;
      const days = remainingDaysUntil(d.dueDate);
      return days !== null && days < 0;
    }).length;

    const snapshotForAi = {
      range,
      totalIncome,
      totalExpense,
      totalSavings,
      savingsRatePercent: totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : null,
      top5Categories: top5Categories.map((c) => ({ category: c.category, amount: c.amount, percent: c.percent })),
      categoryAveragesTop3: categoryAverages.slice(0, 3),
      pendingChequesCount,
      overdueDebtsCount,
      myDebt: debtsOverview.summary.myDebt,
      receivable: debtsOverview.summary.receivable,
    };

    const aiInsights = await this.aiService.generateReportInsights(snapshotForAi);

    return {
      range,
      totals: { income: totalIncome, expense: totalExpense, savings: totalSavings },
      cashFlow,
      cumulativeTrend,
      categoryBreakdown,
      top5Categories,
      categoryAverages,
      debtsSummary: debtsOverview.summary,
      pendingChequesCount,
      overdueDebtsCount,
      insights: aiInsights.insights,
      insightsUsedAi: aiInsights.usedAi,
    };
  }
}
