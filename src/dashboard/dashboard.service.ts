import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Transaction } from '../transactions/transactions.entity';
import { AccountsService } from '../accounts/accounts.service';
import { BudgetService } from '../budget/budget.service';
import { SavingsService } from '../savings/savings.service';
import { DebtsService } from '../debts/debts.service';
import { ChequesService } from '../cheques/cheques.service';
import { AssetsService } from '../assets/assets.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InstallmentsService } from '../installments/installments.service';
import { ChallengesService } from '../challenges/challenges.service';
import { BUDGET_CATEGORIES } from '../budget/budget.constants';
import {
  DashboardPeriod,
  currentJalaliDate,
  currentJalaliMonthKey,
  daysInJalaliMonth,
  matchesPeriod,
  remainingDaysUntil,
  toEnglishDigits,
  toPersianDigits,
  todayJalaliString,
  weekdayNameFromJalali,
} from '../common/jalali.util';

const VALID_PERIODS: DashboardPeriod[] = ['today', 'week', 'month', 'year'];

interface MonthTotals {
  income: number;
  expense: number;
  byCategory: Record<string, number>;
  byWeekday: Record<string, number>;
  byDay: Record<string, number>;
  transactionCount: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private accountsService: AccountsService,
    private budgetService: BudgetService,
    private savingsService: SavingsService,
    private debtsService: DebtsService,
    private chequesService: ChequesService,
    private assetsService: AssetsService,
    private subscriptionsService: SubscriptionsService,
    private installmentsService: InstallmentsService,
    private challengesService: ChallengesService,
  ) {}

  // ===== یک ماه شمسی را n ماه به عقب می‌برد (برای نمودار جریان مالی ۶ ماه اخیر) =====
  private shiftMonthKey(monthKey: string, monthsBack: number): string {
    const [yStr, mStr] = monthKey.split('/');
    let y = Number(yStr);
    let m = Number(mStr);
    for (let i = 0; i < monthsBack; i++) {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
    return `${y}/${String(m).padStart(2, '0')}`;
  }

  // ===== جمع درآمد/هزینه‌ی یک ماه مشخص، به تفکیک دسته و روز هفته =====
  private async getMonthTotals(userId: number, monthKey: string): Promise<MonthTotals> {
    const persianMonthKey = toPersianDigits(monthKey);

    const transactions = await this.transactionsRepository.find({
      where: [
        { userId, date: Like(`${monthKey}%`) },
        { userId, date: Like(`${persianMonthKey}%`) },
      ],
    });

    const totals: MonthTotals = { income: 0, expense: 0, byCategory: {}, byWeekday: {}, byDay: {}, transactionCount: 0 };

    for (const tx of transactions) {
      const normalizedDate = toEnglishDigits(tx.date || '');
      if (!normalizedDate.startsWith(monthKey)) continue;

      totals.transactionCount += 1;
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totals.income += amount;
      } else if (tx.type === 'expense') {
        totals.expense += amount;
        const category = tx.category || 'سایر';
        totals.byCategory[category] = (totals.byCategory[category] || 0) + amount;
        totals.byDay[normalizedDate] = (totals.byDay[normalizedDate] || 0) + amount;

        const weekday = weekdayNameFromJalali(normalizedDate);
        if (weekday) {
          totals.byWeekday[weekday] = (totals.byWeekday[weekday] || 0) + amount;
        }
      }
      // رکوردهای type = 'transfer' (آینه‌ی انتقال بین حساب‌ها) نه درآمدند نه هزینه
    }

    return totals;
  }

  // ===== امتیاز سلامت مالی از عوامل واقعی موجود؛ اگر داده‌ای برای یک عامل نباشد، آن عامل اصلاً وارد میانگین نمی‌شود =====
  private computeHealthScore(params: {
    hasIncomeData: boolean;
    savingsRatePercent: number;
    expenseToIncomePercent: number;
    myDebt: number;
    hasDebtRecords: boolean;
    monthlyIncome: number;
    budgetOverview: any;
    loansOverview: any;
    goalsOverview: any;
  }) {
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

    // هر عامل یا عدد واقعی است، یا null (یعنی داده‌ای برایش ثبت نشده و در میانگین حساب نمی‌شود)
    const savingsFactor = params.hasIncomeData ? clamp((params.savingsRatePercent / 30) * 100) : null;
    const expenseFactor = params.hasIncomeData ? clamp(100 - params.expenseToIncomePercent) : null;

    // بدهی: فقط وقتی کاربر حداقل یک رکورد بدهی (چه پرداخت‌شده چه نشده) ثبت کرده باشه این عامل
    // معنا داره؛ وگرنه نمی‌شه فهمید صفر بودنش یعنی واقعاً بدون‌بدهیه یا صرفاً هنوز چیزی وارد نکرده
    // (مثلاً برای کاربر تازه‌وارد که هیچ‌چیزی ثبت نکرده، نباید همون اول ۱۰۰٪ نشون بدیم)
    const debtFactor = !params.hasDebtRecords
      ? null
      : params.myDebt <= 0
        ? 100
        : clamp(100 - (params.myDebt / (params.monthlyIncome || params.myDebt || 1)) * 100);

    // بودجه: فقط وقتی کاربر واقعاً بودجه تعیین کرده، این عامل معنا دارد
    const budgetFactor = params.budgetOverview.hasBudget && params.budgetOverview.totalBudget > 0
      ? clamp(100 - Math.max(0, params.budgetOverview.spent / params.budgetOverview.totalBudget - 1) * 200)
      : null;

    // اقساط: به همین ترتیب، فقط وقتی کاربر حداقل یک وام (فعال یا تکمیل‌شده) ثبت کرده باشه معنا داره
    const installmentFactor = params.loansOverview.loans.length === 0
      ? null
      : params.loansOverview.activeCount > 0
        ? (params.loansOverview.overdueCount > 0 ? clamp(100 - params.loansOverview.overdueCount * 30) : 95)
        : 100;

    // اهداف پس‌انداز: فقط وقتی حداقل یک هدف ثبت شده این عامل معنا دارد
    const goalsFactor = params.goalsOverview.goals.length > 0
      ? clamp(
          params.goalsOverview.goals.reduce((sum: number, g: any) => sum + g.progressPercent, 0) /
            params.goalsOverview.goals.length,
        )
      : null;

    const factors = {
      savingsRatio: savingsFactor,
      expenseToIncome: expenseFactor,
      debtManagement: debtFactor,
      budgetAdherence: budgetFactor,
      installmentPunctuality: installmentFactor,
      goalsProgress: goalsFactor,
    };

    const validValues = Object.values(factors).filter((v): v is number => v !== null);

    if (validValues.length === 0) {
      return { score: null, label: 'داده کافی نیست', factors };
    }

    const score = Math.round(validValues.reduce((sum, v) => sum + v, 0) / validValues.length);
    const label = score >= 80 ? 'خوب' : score >= 60 ? 'متوسط' : 'ضعیف';

    return { score, label, factors };
  }

  // ===== هزینه به تفکیک دسته، برای بازه‌ی انتخابیِ فیلتر سراسری هدر (امروز/هفته/ماه/سال) =====
  async getCategoryBreakdown(userId: number, period: string) {
    const normalizedPeriod: DashboardPeriod = VALID_PERIODS.includes(period as DashboardPeriod)
      ? (period as DashboardPeriod)
      : 'month';

    const transactions = await this.transactionsRepository.find({
      where: { userId, type: 'expense' },
    });

    const filtered = transactions.filter((tx) => matchesPeriod(tx.date || '', normalizedPeriod));

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const tx of filtered) {
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

    return { period: normalizedPeriod, expense: total, categoryBreakdown };
  }

  // ===== جمع درآمد/هزینه/دسته‌بندی برای بازه‌ی انتخابیِ فیلتر سراسری هدر =====
  // برای «ماه» از thisMonth (که قبلاً خونده شده) استفاده می‌کنه تا کوئری اضافه نزنه؛
  // برای بقیه‌ی بازه‌ها (امروز/هفته/سال) کل تراکنش‌های کاربر رو با matchesPeriod فیلتر می‌کنه
  private async getPeriodTotals(
    userId: number,
    period: DashboardPeriod,
    monthTotals: MonthTotals,
  ): Promise<{ income: number; expense: number; byCategory: Record<string, number>; transactionCount: number }> {
    if (period === 'month') {
      return {
        income: monthTotals.income,
        expense: monthTotals.expense,
        byCategory: monthTotals.byCategory,
        transactionCount: monthTotals.transactionCount,
      };
    }

    const transactions = await this.transactionsRepository.find({ where: { userId } });
    const result = { income: 0, expense: 0, byCategory: {} as Record<string, number>, transactionCount: 0 };

    for (const tx of transactions) {
      if (!matchesPeriod(tx.date || '', period)) continue;
      result.transactionCount += 1;
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        result.income += amount;
      } else if (tx.type === 'expense') {
        result.expense += amount;
        const category = tx.category || 'سایر';
        result.byCategory[category] = (result.byCategory[category] || 0) + amount;
      }
    }

    return result;
  }

  // ===== خروجی یک‌جای همه‌ی داده‌های داشبورد؛ period فیلتر سراسری هدر است (امروز/هفته/ماه/سال) =====
  // توجه: بخش‌هایی مثل پیش‌بینی پایان ماه، سلامت مالی، بودجه و نمودار جریان مالی ذاتاً ماهانه‌اند
  // و همیشه بر اساس «ماه جاری واقعی» محاسبه می‌شوند؛ period فقط روی کارت‌های آماری درآمد/هزینه/تراز
  // و نمودار دسته‌بندی هزینه (که در واقع همون فیلتر سابق دکمه‌های امروز/هفته/ماه/سال بود) اثر می‌گذارد
  async getOverview(userId: number, period?: string) {
    const normalizedPeriod: DashboardPeriod = VALID_PERIODS.includes(period as DashboardPeriod)
      ? (period as DashboardPeriod)
      : 'month';
    const monthKey = currentJalaliMonthKey();
    const today = currentJalaliDate();

    // ===== ماه جاری و ماه قبل (برای مقایسه‌ی روند خرج) =====
    const [thisMonth, prevMonth] = await Promise.all([
      this.getMonthTotals(userId, monthKey),
      this.getMonthTotals(userId, this.shiftMonthKey(monthKey, 1)),
    ]);

    // ===== جمع درآمد/هزینه/دسته‌بندی برای بازه‌ی انتخابیِ فیلتر سراسری هدر =====
    const periodTotals = await this.getPeriodTotals(userId, normalizedPeriod, thisMonth);

    // ===== ۶ ماه اخیر برای نمودار جریان مالی و نسبت هزینه به درآمد =====
    const cashFlow: { month: string; income: number; expense: number; hasData: boolean }[] = [];
    for (let i = 5; i >= 0; i--) {
      const key = this.shiftMonthKey(monthKey, i);
      const totals = i === 0 ? thisMonth : i === 1 ? prevMonth : await this.getMonthTotals(userId, key);
      cashFlow.push({ month: key, income: totals.income, expense: totals.expense, hasData: totals.transactionCount > 0 });
    }

    // ===== سایر ماژول‌ها (به‌صورت موازی) =====
    const [
      accountsSummary,
      budgetOverview,
      savingsOverview,
      debtsOverview,
      chequesOverview,
      assetsOverview,
      subscriptionsOverview,
      installmentsOverview,
      challengesOverview,
    ] = await Promise.all([
      this.accountsService.summary(userId),
      this.budgetService.getOverview(userId),
      this.savingsService.getOverview(userId),
      this.debtsService.getOverview(userId),
      this.chequesService.getOverview(userId),
      this.assetsService.getOverview(userId),
      this.subscriptionsService.getOverview(userId),
      this.installmentsService.getOverview(userId),
      this.challengesService.getOverview(userId),
    ]);

    const totalBalance = Object.values(accountsSummary.totalsByCurrency).reduce(
      (sum: number, v: any) => sum + Number(v),
      0,
    );

    // ===== دسته‌بندی هزینه‌ها برای بازه‌ی انتخابی، مرتب شده و با درصد سهم از کل =====
    const categoryEntries = Object.entries(periodTotals.byCategory).sort((a, b) => b[1] - a[1]);
    const categoryBreakdown = categoryEntries.map(([category, amount]) => ({
      category,
      amount,
      percent: periodTotals.expense > 0 ? Math.round((amount / periodTotals.expense) * 100) : 0,
    }));
    const topCategory = categoryBreakdown[0] || null;
    // مقایسه با ماه قبل فقط وقتی بازه‌ی انتخابی «ماه» باشد معنا دارد
    const topCategoryPrevAmount =
      normalizedPeriod === 'month' && topCategory ? prevMonth.byCategory[topCategory.category] || 0 : 0;
    const topCategoryChangePercent =
      normalizedPeriod === 'month' && topCategory
        ? topCategoryPrevAmount > 0
          ? Math.round(((topCategory.amount - topCategoryPrevAmount) / topCategoryPrevAmount) * 100)
          : topCategory.amount > 0
            ? 100
            : 0
        : null;

    // ===== پرخرج‌ترین روز هفته‌ی این ماه =====
    const weekdayEntries = Object.entries(thisMonth.byWeekday).sort((a, b) => b[1] - a[1]);
    const topWeekday = weekdayEntries[0] ? weekdayEntries[0][0] : null;

    // ===== پیش‌بینی پایان ماه: بر اساس میانگین هزینه‌ی روزانه تا امروز =====
    const daysInMonth = daysInJalaliMonth(today.y, today.m);
    const avgDailyExpense = today.d > 0 ? thisMonth.expense / today.d : 0;
    const projectedExpense = Math.round(avgDailyExpense * daysInMonth);
    const budgetTotal = budgetOverview.totalBudget || 0;
    const projectedOverBudget = budgetTotal > 0 ? projectedExpense - budgetTotal : null;
    const todayExpense = thisMonth.byDay[toEnglishDigits(todayJalaliString())] || 0;
    const dailyAllowance = budgetTotal > 0 ? Math.round(budgetTotal / daysInMonth) : null;

    // ===== نرخ پس‌انداز و تراز ماه جاری (برای محاسبه‌ی سلامت مالی؛ همیشه ماهانه، مستقل از فیلتر) =====
    const monthlyBalance = thisMonth.income - thisMonth.expense;
    const monthSavingsRatePercent = thisMonth.income > 0
      ? Math.round((monthlyBalance / thisMonth.income) * 100)
      : 0;
    const monthExpenseToIncomePercent = thisMonth.income > 0
      ? Math.round((thisMonth.expense / thisMonth.income) * 100)
      : 0;

    // ===== نرخ پس‌انداز و تراز برای بازه‌ی انتخابیِ فیلتر سراسری هدر (کارت‌های آماری بالای داشبورد) =====
    const periodBalance = periodTotals.income - periodTotals.expense;
    const periodSavingsRatePercent = periodTotals.income > 0
      ? Math.round((periodBalance / periodTotals.income) * 100)
      : 0;
    const periodExpenseToIncomePercent = periodTotals.income > 0
      ? Math.round((periodTotals.expense / periodTotals.income) * 100)
      : 0;

    // ===== نزدیک‌ترین هدف پس‌انداز (کوچک‌ترین باقی‌مانده، هنوز محقق‌نشده) =====
    const openGoals = savingsOverview.goals.filter((g: any) => !g.isAchieved);
    const closestGoal = openGoals.length
      ? openGoals.reduce((a: any, b: any) => (a.remaining < b.remaining ? a : b))
      : null;

    // ===== وضعیت سلامت مالی (همیشه بر اساس ماه جاری واقعی، مستقل از فیلتر بازه‌ی هدر) =====
    const health = this.computeHealthScore({
      hasIncomeData: thisMonth.income > 0,
      savingsRatePercent: monthSavingsRatePercent,
      expenseToIncomePercent: monthExpenseToIncomePercent,
      myDebt: debtsOverview.summary.myDebt,
      hasDebtRecords: debtsOverview.items.some((r: any) => r.type === 'debt'),
      monthlyIncome: thisMonth.income,
      budgetOverview,
      loansOverview: installmentsOverview,
      goalsOverview: savingsOverview,
    });

    // ===== هشدارهای بودجه: دسته‌های عبورکرده از سقف و نزدیک‌به‌سقف =====
    const overBudgetCategories = budgetOverview.categories.filter(
      (c: any) => c.isOverBudget && c.spent > 0,
    );
    const nearLimitCategories = budgetOverview.categories.filter(
      (c: any) => !c.isOverBudget && c.spent > 0 && c.progressPercent >= 80,
    );

    // ===== یادآورهای نزدیک: چک‌های در انتظار + بدهی‌های سررسیدنزدیک + اشتراک/اقساط نزدیک =====
    const reminders: { text: string; priority: 'today' | 'soon' | 'scheduled'; date: string | null }[] = [];

    for (const cheque of chequesOverview.cheques) {
      if (cheque.status !== 'pending') continue;
      const days = remainingDaysUntil(cheque.date);
      if (days === null || days > 14 || days < -3) continue;
      reminders.push({
        text: `چک ${cheque.type === 'received' ? 'دریافتی' : 'پرداختی'} شماره ${cheque.number}${cheque.counterparty ? ' از ' + cheque.counterparty : ''} به مبلغ ${Math.round(cheque.amount).toLocaleString('en-US')} تومان`,
        priority: days <= 0 ? 'today' : days <= 3 ? 'soon' : 'scheduled',
        date: cheque.date,
      });
    }

    for (const debt of debtsOverview.items) {
      if (debt.type !== 'debt' || debt.status === 'paid') continue;
      const days = remainingDaysUntil(debt.dueDate);
      if (days === null || days > 14 || days < -3) continue;
      reminders.push({
        text: `بدهی ${Math.round(debt.amount).toLocaleString('en-US')} تومان به ${debt.counterparty} را باید پرداخت کنید`,
        priority: days <= 0 ? 'today' : days <= 3 ? 'soon' : 'scheduled',
        date: debt.dueDate,
      });
    }

    for (const sub of subscriptionsOverview.subscriptions) {
      if (!sub.isActive || sub.daysLeft > 5) continue;
      reminders.push({
        text: `اشتراک ${sub.title} به مبلغ ${Math.round(sub.amount).toLocaleString('en-US')} تومان تمدید می‌شود`,
        priority: sub.daysLeft <= 0 ? 'today' : sub.daysLeft <= 3 ? 'soon' : 'scheduled',
        date: sub.nextChargeDate,
      });
    }

    for (const loan of installmentsOverview.loans) {
      if (loan.isCompleted || loan.daysUntilNext === null || loan.daysUntilNext > 5) continue;
      reminders.push({
        text: `قسط «${loan.title}» به مبلغ ${Math.round(loan.installmentAmount).toLocaleString('en-US')} تومان سررسید است`,
        priority: loan.daysUntilNext <= 0 ? 'today' : loan.daysUntilNext <= 3 ? 'soon' : 'scheduled',
        date: loan.nextDueDate,
      });
    }

    reminders.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // ===== خلاصه‌ی چک‌های در انتظار (برای کارت آماری «چک نزدیک») =====
    const pendingCheques = chequesOverview.cheques.filter((c: any) => c.status === 'pending');
    const pendingChequeDays = pendingCheques
      .map((c: any) => remainingDaysUntil(c.date))
      .filter((d: number | null) => d !== null) as number[];
    const chequesSummary = {
      pendingCount: pendingCheques.length,
      pendingTotal: pendingCheques.reduce((sum: number, c: any) => sum + Number(c.amount), 0),
      nearestDays: pendingChequeDays.length ? Math.min(...pendingChequeDays) : null,
    };

    // ===== آخرین تراکنش‌ها =====
    const recentTransactions = await this.transactionsRepository.find({
      where: { userId },
      order: { id: 'DESC' },
      take: 8,
    });

    return {
      month: monthKey,
      period: normalizedPeriod,
      totals: {
        balance: totalBalance,
        income: periodTotals.income,
        expense: periodTotals.expense,
        monthlyBalance: periodBalance,
        savingsRatePercent: periodSavingsRatePercent,
        expenseToIncomePercent: periodExpenseToIncomePercent,
        hasIncomeData: periodTotals.income > 0,
      },
      previousMonth: { income: prevMonth.income, expense: prevMonth.expense },
      accounts: accountsSummary,
      categoryBreakdown,
      topCategory: topCategory ? { ...topCategory, changePercent: topCategoryChangePercent } : null,
      topWeekday,
      cashFlow,
      prediction: {
        projectedExpense,
        budgetTotal,
        projectedOverBudget,
        daysElapsed: today.d,
        daysInMonth,
        todayExpense,
        dailyAllowance,
      },
      budget: budgetOverview,
      budgetAlerts: { overBudgetCategories, nearLimitCategories },
      savings: savingsOverview,
      closestGoal,
      debts: debtsOverview,
      cheques: chequesOverview,
      chequesSummary,
      assets: assetsOverview,
      subscriptions: subscriptionsOverview,
      installments: installmentsOverview,
      challenges: challengesOverview,
      health,
      reminders: reminders.slice(0, 6),
      recentTransactions: recentTransactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
    };
  }
}