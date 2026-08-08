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
  formatJalali,
  gregorianToJalali,
  jalaliToGregorian,
  normalizeJalaliDate,
  remainingDaysUntil,
  toEnglishDigits,
  weekdayNameFromJalali,
} from '../common/jalali.util';

// «today» و «week» دقت روزانه دارن (دقیقاً هم‌راستا با فیلتر سراسری هدر)،
// بقیه دقت ماهانه دارن (برای نمودارهای روند چند‌ماهه)
export type ReportRange = 'today' | 'week' | 'month' | '3m' | '6m' | 'year' | 'all';
type Granularity = 'day' | 'month';

interface PeriodBucket {
  income: number;
  expense: number;
  byCategory: Record<string, number>;
  transactionCount: number;
}

const PERSIAN_MONTH_NAMES: Record<number, string> = {
  1: 'فروردین', 2: 'اردیبهشت', 3: 'خرداد', 4: 'تیر', 5: 'مرداد', 6: 'شهریور',
  7: 'مهر', 8: 'آبان', 9: 'آذر', 10: 'دی', 11: 'بهمن', 12: 'اسفند',
};

const emptyBucket = (): PeriodBucket => ({ income: 0, expense: 0, byCategory: {}, transactionCount: 0 });

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

  private resolveGranularity(range: ReportRange): Granularity {
    return range === 'today' || range === 'week' ? 'day' : 'month';
  }

  // ===== همه‌ی تراکنش‌های کاربر، یک‌بار خونده و بر اساس ماه (YYYY/MM) دسته‌بندی می‌شن =====
  private async loadAllMonthBuckets(userId: number): Promise<Map<string, PeriodBucket>> {
    const transactions = await this.transactionsRepository.find({ where: { userId } });
    const buckets = new Map<string, PeriodBucket>();

    for (const tx of transactions) {
      const normalizedDate = toEnglishDigits(tx.date || '');
      const match = normalizedDate.match(/^(\d{3,4})\/(\d{1,2})/);
      if (!match) continue;
      const monthKey = `${match[1]}/${match[2].padStart(2, '0')}`;
      this.applyTxToBucket(buckets, monthKey, tx);
    }

    return buckets;
  }

  // ===== همه‌ی تراکنش‌های کاربر، بر اساس روز دقیق (YYYY/MM/DD) دسته‌بندی می‌شن =====
  // برای بازه‌های «امروز» و «این هفته» که دقت ماهانه براشون بی‌معنیه
  private async loadAllDayBuckets(userId: number): Promise<Map<string, PeriodBucket>> {
    const transactions = await this.transactionsRepository.find({ where: { userId } });
    const buckets = new Map<string, PeriodBucket>();

    for (const tx of transactions) {
      const dayKey = normalizeJalaliDate(tx.date || '');
      if (!dayKey) continue;
      this.applyTxToBucket(buckets, dayKey, tx);
    }

    return buckets;
  }

  private applyTxToBucket(buckets: Map<string, PeriodBucket>, key: string, tx: Transaction): void {
    if (!buckets.has(key)) buckets.set(key, emptyBucket());
    const bucket = buckets.get(key) as PeriodBucket;
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

  // ===== لیست ماه‌های داخل بازه‌ی انتخاب‌شده، از قدیم به جدید =====
  private resolveRangeMonthKeys(range: ReportRange, allBuckets: Map<string, PeriodBucket>): string[] {
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

  // ===== لیست روزهای داخل بازه‌ی انتخاب‌شده («today» یا «week»)، از قدیم به جدید =====
  private resolveRangeDayKeys(range: 'today' | 'week'): string[] {
    const today = currentJalaliDate();
    if (range === 'today') {
      return [formatJalali(today.y, today.m, today.d)];
    }

    // week: ۷ روز اخیر شامل امروز، با محاسبه‌ی دقیق روی تقویم میلادی
    // (چون تفریق ساده روی روز جلالی توی مرز ماه‌ها/سال‌ها خطا می‌ده)
    const keys: string[] = [];
    const startGregorian = jalaliToGregorian(today.y, today.m, today.d);
    for (let i = 6; i >= 0; i--) {
      const g = new Date(startGregorian);
      g.setDate(g.getDate() - i);
      const [jy, jm, jd] = gregorianToJalali(g.getFullYear(), g.getMonth() + 1, g.getDate());
      keys.push(formatJalali(jy, jm, jd));
    }
    return keys;
  }

  private labelForKey(key: string, granularity: Granularity, range: ReportRange): string {
    if (granularity === 'day') {
      if (range === 'today') return 'امروز';
      return weekdayNameFromJalali(key) || key;
    }
    return PERSIAN_MONTH_NAMES[Number(key.split('/')[1])] || key;
  }

  // ===== خودِ محاسبات گزارش، مستقل از دقت (روز/ماه)؛ همون منطق قبلی، فقط پارامتری‌شده
  // روی «کدوم سطل‌ها» و «کدوم کلیدهای بازه» تا هم برای دقت روزانه و هم ماهانه یکی باشه =====
  private buildReportFromBuckets(
    range: ReportRange,
    granularity: Granularity,
    allBuckets: Map<string, PeriodBucket>,
    rangeKeys: string[],
  ) {
    const cashFlow = rangeKeys.map((key) => {
      const b = allBuckets.get(key) || emptyBucket();
      return {
        month: key,
        monthLabel: this.labelForKey(key, granularity, range),
        income: b.income,
        expense: b.expense,
        hasData: b.transactionCount > 0,
      };
    });

    let running = 0;
    const cumulativeTrend = cashFlow.map((m) => {
      running += m.income - m.expense;
      return { month: m.month, monthLabel: m.monthLabel, cumulativeBalance: running };
    });

    const totalIncome = cashFlow.reduce((sum, m) => sum + m.income, 0);
    const totalExpense = cashFlow.reduce((sum, m) => sum + m.expense, 0);
    const totalSavings = totalIncome - totalExpense;

    const categoryTotals: Record<string, number> = {};
    for (const key of rangeKeys) {
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

    // ===== جدول میانگین هزینه‌ها: نرخ این بازه در برابر میانگین تاریخیِ واقعیِ هر دسته،
    // با همون واحد زمانی (روزانه برای «امروز»/«این هفته»، ماهانه برای بقیه‌ی بازه‌ها) =====
    const allKeysSorted = Array.from(allBuckets.keys()).sort();
    const categoryAverages = BUDGET_CATEGORIES
      .map((category) => {
        let allTimeTotal = 0;
        let allTimeActivePeriods = 0;
        for (const key of allKeysSorted) {
          const amount = allBuckets.get(key)?.byCategory[category] || 0;
          if (amount > 0) {
            allTimeTotal += amount;
            allTimeActivePeriods += 1;
          }
        }
        const periodAverage = allTimeActivePeriods > 0 ? Math.round(allTimeTotal / allTimeActivePeriods) : 0;

        const rangeExpense = categoryTotals[category] || 0;
        const activePeriodsInRange = rangeKeys.filter((key) => (allBuckets.get(key)?.byCategory[category] || 0) > 0).length;
        const periodRate = activePeriodsInRange > 0 ? rangeExpense / activePeriodsInRange : 0;

        let comparisonPercent: number | null = null;
        if (periodAverage > 0 && rangeExpense > 0) {
          comparisonPercent = Math.round(((periodRate - periodAverage) / periodAverage) * 100);
        } else if (rangeExpense > 0 && periodAverage === 0) {
          comparisonPercent = 100;
        }

        return { category, periodAverage, rangeExpense, comparisonPercent };
      })
      .filter((row) => row.periodAverage > 0 || row.rangeExpense > 0)
      .sort((a, b) => b.rangeExpense - a.rangeExpense);

    return {
      totals: { income: totalIncome, expense: totalExpense, savings: totalSavings },
      cashFlow,
      cumulativeTrend,
      categoryBreakdown,
      top5Categories,
      categoryAverages,
    };
  }

  // ===== بخش‌های سریع گزارش (بدون AI): همه‌چیز به‌جز تحلیل هوشمند =====
  // این تابع هم از getReport و هم از getReportInsights صدا زده می‌شه؛ چون فقط
  // خواندن از دیتابیس و محاسبات ساده‌ست (نه AI)، سریعه و تکرارش مشکلی نداره.
  private async computeReportCore(userId: number, range: ReportRange) {
    const granularity = this.resolveGranularity(range);

    const allBuckets = granularity === 'day'
      ? await this.loadAllDayBuckets(userId)
      : await this.loadAllMonthBuckets(userId);
    const rangeKeys = granularity === 'day'
      ? this.resolveRangeDayKeys(range as 'today' | 'week')
      : this.resolveRangeMonthKeys(range, allBuckets);

    const computed = this.buildReportFromBuckets(range, granularity, allBuckets, rangeKeys);

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
      totalIncome: computed.totals.income,
      totalExpense: computed.totals.expense,
      totalSavings: computed.totals.savings,
      savingsRatePercent: computed.totals.income > 0 ? Math.round((computed.totals.savings / computed.totals.income) * 100) : null,
      top5Categories: computed.top5Categories.map((c) => ({ category: c.category, amount: c.amount, percent: c.percent })),
      categoryAveragesTop3: computed.categoryAverages.slice(0, 3),
      pendingChequesCount,
      overdueDebtsCount,
      myDebt: debtsOverview.summary.myDebt,
      receivable: debtsOverview.summary.receivable,
    };

    return {
      range,
      granularity,
      ...computed,
      debtsSummary: debtsOverview.summary,
      pendingChequesCount,
      overdueDebtsCount,
      snapshotForAi,
    };
  }

  // ===== گزارش اصلی: سریع و بدون وابستگی به AI، چون داشبورد/نمودارها ربطی به تحلیل هوشمند ندارن =====
  async getReport(userId: number, range: ReportRange = 'year') {
    const { snapshotForAi, ...core } = await this.computeReportCore(userId, range);
    return core;
  }

  // ===== تحلیل هوشمند به‌صورت جدا: چون صدا زدن AI (اوللاما) ممکنه چند ثانیه طول بکشه، بهتره
  // بلاک‌کننده‌ی نمایش اصلیِ گزارش نباشه؛ فرانت این رو جدا و بعد از گزارش اصلی صدا می‌زنه =====
  private insightsCache = new Map<string, { data: { insights: any[]; usedAi: boolean }; expiresAt: number }>();
  private readonly insightsCacheTtlMs = 5 * 60 * 1000; // ۵ دقیقه

  async getReportInsights(userId: number, range: ReportRange = 'year') {
    const cacheKey = `${userId}:${range}`;
    const cached = this.insightsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const { snapshotForAi } = await this.computeReportCore(userId, range);
    const data = await this.aiService.generateReportInsights(snapshotForAi);
    this.insightsCache.set(cacheKey, { data, expiresAt: Date.now() + this.insightsCacheTtlMs });
    return data;
  }
}
