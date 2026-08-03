import { Controller, Get, Render } from '@nestjs/common';
import { BUDGET_CATEGORIES } from './budget/budget.constants';
import { INCOME_CATEGORIES } from './transactions/income-categories.constant';

@Controller()
export class AppController {
  @Get()
  @Render('dashboard')
  root() {
    return { title: 'داشبورد حسابینو' };
  }

   @Get('login')
  @Render('login')
  login() {
    return { layout: false };
  }

  @Get('transactions')
  @Render('transactions')
  transactions() {
    // دسته‌بندی‌ها از همون منبع واحدی خونده می‌شن که BudgetService استفاده می‌کنه،
    // تا هیچ‌وقت لیست دسته‌های فرم تراکنش با دسته‌های صفحه‌ی بودجه ناهم‌خوان نشه.
    return {
      title: 'تراکنش‌ها',
      categories: BUDGET_CATEGORIES,
      incomeCategories: INCOME_CATEGORIES,
    };
  }

  @Get('accounts')
  @Render('accounts')
  accounts() {
    return { title: 'حساب‌ها' };
  }

  @Get('budget')
  @Render('budget')
  budget() {
    return { title: 'بودجه' };
  }

  @Get('savings')
  @Render('savings')
  savings() {
    return { title: 'پس‌انداز' };
  }

  @Get('cheques')
  @Render('cheques')
  cheques() {
    return { title: 'چک‌ها' };
  }

  @Get('debts')
  @Render('debts')
  debts() {
    return { title: 'بدهی‌ها' };
  }

  @Get('reminders')
  @Render('reminders')
  reminders() {
    return { title: 'یادآوری‌ها' };
  }

  @Get('reports')
  @Render('reports')
  reports() {
    return { title: 'گزارشات' };
  }

  @Get('settings')
  @Render('settings')
  settings() {
    return { title: 'تنظیمات' };
  }
}