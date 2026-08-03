import { Injectable } from '@nestjs/common';
import { ChequesService } from '../cheques/cheques.service';
import { DebtsService } from '../debts/debts.service';
import { SavingsService } from '../savings/savings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { InstallmentsService } from '../installments/installments.service';
import { remainingDaysUntil } from '../common/jalali.util';

export type ReminderPriority = 'overdue' | 'today' | 'soon' | 'scheduled';
export type ReminderSourceType = 'cheque' | 'debt' | 'saving' | 'subscription' | 'installment';

export interface ReminderItem {
  id: string;
  sourceType: ReminderSourceType;
  title: string;
  subtitle: string | null;
  amount: number | null;
  date: string | null;
  daysLeft: number | null;
  priority: ReminderPriority;
  link: string;
  // آیا این آیتم به‌خاطر تیک «یادآور» کاربر اینجاست، یا به‌صورت خودکار (سررسید نزدیک)؟
  isManual: boolean;
}

function priorityFromDays(days: number | null): ReminderPriority {
  if (days === null) return 'scheduled';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 3) return 'soon';
  return 'scheduled';
}

@Injectable()
export class RemindersService {
  constructor(
    private chequesService: ChequesService,
    private debtsService: DebtsService,
    private savingsService: SavingsService,
    private subscriptionsService: SubscriptionsService,
    private installmentsService: InstallmentsService,
  ) {}

  async getAllReminders(userId: number): Promise<{
    manual: ReminderItem[];
    automatic: ReminderItem[];
    counts: { overdue: number; today: number; soon: number; total: number };
  }> {
    const [chequesOverview, debtsOverview, savingsOverview, subscriptionsOverview, installmentsOverview] =
      await Promise.all([
        this.chequesService.getOverview(userId),
        this.debtsService.getOverview(userId),
        this.savingsService.getOverview(userId),
        this.subscriptionsService.getOverview(userId),
        this.installmentsService.getOverview(userId),
      ]);

    const manual: ReminderItem[] = [];

    // ===== چک‌هایی که کاربر برایشان یادآور را فعال کرده =====
    for (const cheque of chequesOverview.cheques) {
      if (!cheque.reminder || cheque.status !== 'pending') continue;
      const days = remainingDaysUntil(cheque.date);
      manual.push({
        id: `cheque-${cheque.id}`,
        sourceType: 'cheque',
        title: `چک ${cheque.type === 'received' ? 'دریافتی' : 'پرداختی'} شماره ${cheque.number}`,
        subtitle: cheque.counterparty ? `طرف حساب: ${cheque.counterparty}` : null,
        amount: cheque.amount,
        date: cheque.date,
        daysLeft: days,
        priority: priorityFromDays(days),
        link: '/cheques',
        isManual: true,
      });
    }

    // ===== بدهی/طلب‌هایی که کاربر برایشان یادآور را فعال کرده =====
    for (const debt of debtsOverview.items) {
      if (!debt.reminder || debt.isPaid) continue;
      const days = remainingDaysUntil(debt.dueDate);
      manual.push({
        id: `debt-${debt.id}`,
        sourceType: 'debt',
        title: debt.type === 'debt' ? `بدهی به ${debt.counterparty}` : `طلب از ${debt.counterparty}`,
        subtitle: null,
        amount: debt.amount,
        date: debt.dueDate,
        daysLeft: days,
        priority: priorityFromDays(days),
        link: '/debts',
        isManual: true,
      });
    }

    // ===== اهداف پس‌اندازی که کاربر برایشان یادآور را فعال کرده =====
    for (const goal of savingsOverview.goals) {
      if (!goal.reminder || !goal.deadline || goal.isAchieved) continue;
      const days = remainingDaysUntil(goal.deadline);
      manual.push({
        id: `saving-${goal.id}`,
        sourceType: 'saving',
        title: `هدف پس‌انداز «${goal.title}»`,
        subtitle: `${goal.progressPercent}% تکمیل‌شده`,
        amount: goal.remaining,
        date: goal.deadline,
        daysLeft: days,
        priority: priorityFromDays(days),
        link: '/savings',
        isManual: true,
      });
    }

    manual.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

    // ===== یادآورهای خودکار: اشتراک/قسط نزدیک به سررسید (این دو بخش تیک یادآور جداگانه ندارند) =====
    const automatic: ReminderItem[] = [];

    for (const sub of subscriptionsOverview.subscriptions) {
      if (!sub.isActive || sub.daysLeft > 14) continue;
      automatic.push({
        id: `subscription-${sub.id}`,
        sourceType: 'subscription',
        title: `اشتراک «${sub.title}»`,
        subtitle: 'تمدید خودکار',
        amount: sub.amount,
        date: sub.nextChargeDate,
        daysLeft: sub.daysLeft,
        priority: priorityFromDays(sub.daysLeft),
        link: '/settings',
        isManual: false,
      });
    }

    for (const loan of installmentsOverview.loans) {
      if (loan.isCompleted || loan.daysUntilNext === null || loan.daysUntilNext > 14) continue;
      automatic.push({
        id: `installment-${loan.id}`,
        sourceType: 'installment',
        title: `قسط «${loan.title}»`,
        subtitle: null,
        amount: loan.installmentAmount,
        date: loan.nextDueDate,
        daysLeft: loan.daysUntilNext,
        priority: priorityFromDays(loan.daysUntilNext),
        link: '/settings',
        isManual: false,
      });
    }

    automatic.sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));

    const all = [...manual, ...automatic];
    const counts = {
      overdue: all.filter((r) => r.priority === 'overdue').length,
      today: all.filter((r) => r.priority === 'today').length,
      soon: all.filter((r) => r.priority === 'soon').length,
      total: all.length,
    };

    return { manual, automatic, counts };
  }
}
