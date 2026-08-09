import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Budget } from './budget.entity';
import { BudgetCategory } from './budget-category.entity';
import { Transaction } from '../transactions/transactions.entity';
import { SavingDeposit } from '../savings/saving-deposit.entity';
import { BUDGET_CATEGORIES, DEFAULT_BUDGET_ALLOCATION } from './budget.constants';
import { currentJalaliMonthKey, toEnglishDigits, toPersianDigits } from './date.util';
import { CalculateBudgetDto } from './dto/calculate-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

// دسته‌ای که مبلغ پس‌انداز شده توش لحاظ می‌شه (چون از نظر بودجه‌بندی، پس‌انداز
// همون سرمایه‌گذاریه)
const SAVINGS_BUDGET_CATEGORY = 'سرمایه‌گذاری';

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(Budget)
    private budgetRepository: Repository<Budget>,
    @InjectRepository(BudgetCategory)
    private budgetCategoryRepository: Repository<BudgetCategory>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(SavingDeposit)
    private savingDepositRepository: Repository<SavingDeposit>,
  ) {}

  // ===== جمع هزینه‌های واقعی ماه جاری، به تفکیک دسته‌بندی =====
  // چون تاریخ تراکنش‌ها یک رشته‌ی آزاد شمسی است (و ممکنه با ارقام فارسی ذخیره شده باشه)،
  // مقایسه‌ی ماه رو بعد از یکسان‌سازی ارقام و روی پیشوند «YYYY/MM» انجام می‌دیم.
  // مبلغی که همین ماه به هر هدف پس‌انداز اضافه شده هم به دسته‌ی «سرمایه‌گذاری» اضافه می‌شه.
  private async getSpentByCategory(
    userId: number,
    monthKey: string,
  ): Promise<Record<string, number>> {
    // تاریخ تراکنش‌ها ممکنه با ارقام فارسی یا انگلیسی ذخیره شده باشه، پس هر دو
    // حالت پیشوند رو مستقیماً در کوئری دیتابیس فیلتر می‌کنیم (به‌جای خوندن کل
    // تاریخچه‌ی تراکنش‌های کاربر و فیلتر کردن توی جاوااسکریپت که با رشد داده کند می‌شه).
    const persianMonthKey = toPersianDigits(monthKey);

    const expenses = await this.transactionsRepository.find({
      where: [
        { userId, type: 'expense', date: Like(`${monthKey}%`) },
        { userId, type: 'expense', date: Like(`${persianMonthKey}%`) },
      ],
    });

    const spent: Record<string, number> = {};
    for (const category of BUDGET_CATEGORIES) spent[category] = 0;

    for (const tx of expenses) {
      // بررسی نهایی با یکسان‌سازی ارقام، برای حالت‌های نادر تاریخ با ارقام ترکیبی
      const normalizedDate = toEnglishDigits(tx.date || '');
      if (!normalizedDate.startsWith(monthKey)) continue;

      const category = tx.category && spent[tx.category] !== undefined ? tx.category : 'سایر';
      spent[category] += Number(tx.amount) || 0;
    }

    // تاریخ واریزهای پس‌انداز همیشه توسط خود سرور و با ارقام انگلیسی تولید می‌شه
    // (نگاه کنید به SavingsService.todayJalaliString)، پس نیازی به حالت فارسی نیست.
    const deposits = await this.savingDepositRepository.find({
      where: { userId, date: Like(`${monthKey}%`) },
    });
    for (const deposit of deposits) {
      spent[SAVINGS_BUDGET_CATEGORY] += Number(deposit.amount) || 0;
    }

    return spent;
  }

  // ===== جمع درآمد ثبت‌شده‌ی ماه جاری (از تراکنش‌های صفحه‌ی درآمد)؛ برای پیش‌فرض
  // زدن اینپوت «درآمد این ماه» توی صفحه‌ی بودجه، به‌جای اینکه کاربر دوباره دستی
  // همون عددی که قبلاً توی صفحه‌ی درآمد ثبت کرده رو تایپ کنه =====
  private async getRegisteredIncome(userId: number, monthKey: string): Promise<number> {
    const persianMonthKey = toPersianDigits(monthKey);
    const incomes = await this.transactionsRepository.find({
      where: [
        { userId, type: 'income', date: Like(`${monthKey}%`) },
        { userId, type: 'income', date: Like(`${persianMonthKey}%`) },
      ],
    });
    return incomes
      .filter((tx) => toEnglishDigits(tx.date || '').startsWith(monthKey))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }

  private async findCurrentBudget(userId: number): Promise<Budget | null> {
    const month = currentJalaliMonthKey();
    return this.budgetRepository.findOne({ where: { userId, month } });
  }

  // ===== خروجی استاندارد صفحه‌ی بودجه: کارت‌های بالا + وضعیت هر دسته =====
  async getOverview(userId: number) {
    const month = currentJalaliMonthKey();
    const [budget, spentByCategory, registeredIncome] = await Promise.all([
      this.findCurrentBudget(userId),
      this.getSpentByCategory(userId, month),
      this.getRegisteredIncome(userId, month),
    ]);

    const income = budget ? Number(budget.income) : 0;
    const categoriesSource: { category: string; percentage: number; amount: number }[] = budget
      ? budget.categories.map((c) => ({
          category: c.category,
          percentage: Number(c.percentage),
          amount: Number(c.amount),
        }))
      : [];

    // دسته‌هایی که هنوز بودجه‌ای براشون تعیین نشده هم نمایش داده می‌شن (با بودجه‌ی صفر)
    // تا کاربر هزینه‌ی خارج از بودجه رو هم ببینه.
    const byName = new Map(categoriesSource.map((c) => [c.category, c]));
    const categories = BUDGET_CATEGORIES.map((name) => {
      const entry = byName.get(name) || { category: name, percentage: 0, amount: 0 };
      const spent = spentByCategory[name] || 0;
      const progressPercent = entry.amount > 0 ? Math.round((spent / entry.amount) * 100) : spent > 0 ? 100 : 0;
      return {
        category: name,
        percentage: entry.percentage,
        amount: entry.amount,
        spent,
        remaining: entry.amount - spent,
        progressPercent,
        isOverBudget: spent > entry.amount,
      };
    });

    const totalBudget = categories.reduce((sum, c) => sum + c.amount, 0);
    const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

    return {
      month,
      income,
      registeredIncome,
      totalBudget,
      spent: totalSpent,
      remaining: totalBudget - totalSpent,
      hasBudget: !!budget,
      categories,
    };
  }

  // ===== محاسبه‌ی خودکار: از روی درآمد و درصدهای پیش‌فرض هر دسته =====
  async calculate(userId: number, dto: CalculateBudgetDto) {
    const income = Number(dto.income);
    const categories = BUDGET_CATEGORIES.map((category) => {
      const percentage = DEFAULT_BUDGET_ALLOCATION[category];
      return {
        category,
        percentage,
        amount: Math.round((income * percentage) / 100),
      };
    });

    await this.saveBudget(userId, income, categories);
    return this.getOverview(userId);
  }

  // ===== هماهنگ‌سازی خودکار بودجه با درآمد ثبت‌شده: هر بار که یک تراکنش درآمدی این
  // ماه ثبت/ویرایش/حذف می‌شه صدا زده می‌شه تا کاربر مجبور نباشه خودش دستی روی
  // «محاسبه خودکار» بزنه. اگه بودجه‌ای برای این ماه هنوز ثبت نشده، با درصدهای
  // پیش‌فرض یکی می‌سازه؛ اگه از قبل بودجه‌ای با درصد دلخواه کاربر ثبت شده،
  // همون درصدها رو نگه می‌داره و فقط مبلغ هر دسته رو با درآمد جدید متناسب می‌کنه.
  async syncIncomeForMonth(userId: number): Promise<void> {
    const month = currentJalaliMonthKey();
    const registeredIncome = await this.getRegisteredIncome(userId, month);
    const budget = await this.budgetRepository.findOne({ where: { userId, month }, relations: { categories: true } });

    if (!budget) {
      if (registeredIncome > 0) {
        await this.calculate(userId, { income: registeredIncome } as CalculateBudgetDto);
      }
      return;
    }

    if (Number(budget.income) === registeredIncome) return;

    const categories = (budget.categories || []).map((c) => ({
      category: c.category,
      percentage: Number(c.percentage),
      amount: Math.round((registeredIncome * Number(c.percentage)) / 100),
    }));

    await this.saveBudget(userId, registeredIncome, categories);
  }

  // ===== ثبت/ویرایش دستی هر دسته =====
  async update(userId: number, dto: UpdateBudgetDto) {
    const income = Number(dto.income);

    const categories = dto.categories.map((c) => {
      let percentage = c.percentage;
      let amount = c.amount;

      if (amount === undefined && percentage !== undefined) {
        amount = income > 0 ? Math.round((income * percentage) / 100) : 0;
      } else if (percentage === undefined && amount !== undefined) {
        percentage = income > 0 ? Math.round(((amount / income) * 100 + Number.EPSILON) * 100) / 100 : 0;
      } else if (percentage === undefined && amount === undefined) {
        percentage = 0;
        amount = 0;
      }

      return { category: c.category, percentage: percentage as number, amount: amount as number };
    });

    await this.saveBudget(userId, income, categories);
    return this.getOverview(userId);
  }

  // ===== ذخیره‌ی بودجه‌ی ماه جاری (ایجاد یا به‌روزرسانی) =====
  private async saveBudget(
    userId: number,
    income: number,
    categories: { category: string; percentage: number; amount: number }[],
  ) {
    const month = currentJalaliMonthKey();
    let budget = await this.budgetRepository.findOne({ where: { userId, month } });

    if (!budget) {
      budget = this.budgetRepository.create({ userId, month, income, categories: [] });
    }

    // به‌جای حذف و ساخت دوباره‌ی همه‌ی ردیف‌های دسته‌بندی در هر بار ذخیره،
    // ردیف‌های موجود رو (با تطبیق نام دسته) به‌روزرسانی می‌کنیم تا هم نوشتار
    // دیتابیس کمتر بشه و هم شناسه‌ی ردیف‌ها حفظ بشه.
    const existingByName = new Map((budget.categories || []).map((c) => [c.category, c]));

    budget.income = income;
    budget.categories = categories.map((c) => {
      const existing = existingByName.get(c.category);
      if (existing) {
        existing.percentage = c.percentage;
        existing.amount = c.amount;
        return existing;
      }
      return this.budgetCategoryRepository.create({
        category: c.category,
        percentage: c.percentage,
        amount: c.amount,
      });
    });

    return this.budgetRepository.save(budget);
  }
}