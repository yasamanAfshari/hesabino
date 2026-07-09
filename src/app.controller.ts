import { Controller, Get, Render } from '@nestjs/common';

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
    return { title: 'تراکنش‌ها' };
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