import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavingGoal } from './saving-goal.entity';
import { SavingDeposit } from './saving-deposit.entity';
import { CreateSavingGoalDto } from './dto/create-saving-goal.dto';
import { UpdateSavingGoalDto } from './dto/update-saving-goal.dto';
import { AddSavingAmountDto } from './dto/add-saving-amount.dto';
import { currentJalaliDate, monthsBetween, parseJalaliDate } from '../budget/date.util';

@Injectable()
export class SavingsService {
  constructor(
    @InjectRepository(SavingGoal)
    private savingGoalRepository: Repository<SavingGoal>,
    @InjectRepository(SavingDeposit)
    private savingDepositRepository: Repository<SavingDeposit>,
  ) {}

  // ===== تاریخ شمسی امروز، به فرمت «YYYY/MM/DD» (برای ثبت رکورد واریز) =====
  private todayJalaliString(): string {
    const { y, m, d } = currentJalaliDate();
    return `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }

  // ===== محاسبه‌ی وضعیت نمایشی یک هدف: درصد پیشرفت، نیاز ماهانه و رنگ وضعیت =====
  private serialize(goal: SavingGoal) {
    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const remaining = Math.max(targetAmount - currentAmount, 0);
    const isAchieved = currentAmount >= targetAmount;
    const rawPercent = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
    const progressPercent = Math.round(rawPercent);
    const progressBarPercent = Math.min(100, Math.max(0, progressPercent));

    let isExpired = false;
    let monthlyNeed: number | null = null;

    if (!isAchieved && goal.deadline) {
      const deadline = parseJalaliDate(goal.deadline);
      const today = currentJalaliDate();
      if (deadline) {
        const monthsLeft = monthsBetween(today, deadline);
        if (monthsLeft < 0 || (monthsLeft === 0 && deadline.d < today.d)) {
          isExpired = true;
        } else {
          monthlyNeed = Math.ceil(remaining / Math.max(monthsLeft, 1));
        }
      }
    }

    let status: 'green' | 'orange' | 'red';
    if (isAchieved) status = 'green';
    else if (isExpired) status = 'red';
    else if (progressPercent >= 50) status = 'green';
    else if (progressPercent >= 25) status = 'orange';
    else status = 'red';

    return {
      id: goal.id,
      title: goal.title,
      targetAmount,
      currentAmount,
      remaining,
      deadline: goal.deadline,
      reminder: goal.reminder,
      progressPercent,
      progressBarPercent,
      isAchieved,
      isExpired,
      monthlyNeed,
      status,
      createdAt: goal.createdAt,
    };
  }

  private async findOwned(userId: number, id: number): Promise<SavingGoal> {
    const goal = await this.savingGoalRepository.findOne({ where: { id, userId } });
    if (!goal) {
      throw new NotFoundException('هدف پس‌انداز یافت نشد');
    }
    return goal;
  }

  // ===== لیست اهداف + خلاصه‌ی آماری بالای صفحه =====
  async getOverview(userId: number) {
    const goals = await this.savingGoalRepository.find({
      where: { userId },
      order: { id: 'DESC' },
    });

    const serialized = goals.map((g) => this.serialize(g));
    const summary = {
      totalGoals: serialized.length,
      achievedGoals: serialized.filter((g) => g.isAchieved).length,
      totalGoalAmount: serialized.reduce((sum, g) => sum + g.targetAmount, 0),
      totalSaved: serialized.reduce((sum, g) => sum + g.currentAmount, 0),
    };

    return { summary, goals: serialized };
  }

  // ===== ثبت هدف پس‌انداز جدید =====
  async create(userId: number, dto: CreateSavingGoalDto) {
    const goal = this.savingGoalRepository.create({
      userId,
      title: dto.title,
      targetAmount: dto.targetAmount,
      currentAmount: dto.currentAmount || 0,
      deadline: dto.deadline || null,
      reminder: !!dto.reminder,
    });

    const saved = await this.savingGoalRepository.save(goal);

    // اگه هنگام ثبت، مبلغ فعلی هم وارد شده باشه، به‌عنوان یک واریز اولیه ثبت می‌شه
    // تا در محاسبه‌ی بودجه‌ی همین ماه هم لحاظ بشه.
    if (dto.currentAmount && dto.currentAmount > 0) {
      await this.savingDepositRepository.save(
        this.savingDepositRepository.create({
          savingGoalId: saved.id,
          userId,
          amount: dto.currentAmount,
          date: this.todayJalaliString(),
        }),
      );
    }

    return this.getOverview(userId);
  }

  // ===== ویرایش هدف =====
  async update(userId: number, id: number, dto: UpdateSavingGoalDto) {
    const goal = await this.findOwned(userId, id);

    if (dto.title !== undefined) goal.title = dto.title;
    if (dto.targetAmount !== undefined) goal.targetAmount = dto.targetAmount;
    if (dto.deadline !== undefined) goal.deadline = dto.deadline || null;
    if (dto.reminder !== undefined) goal.reminder = dto.reminder;

    // اگه مبلغ فعلی هم صراحتاً از این مسیر ویرایش بشه، به‌جای جایگزینی مستقیم،
    // تفاوتش با مقدار قبلی به‌صورت یک رکورد «واریز» (مثبت یا منفی) ثبت می‌شه.
    // چون صفحه‌ی بودجه، «هزینه‌ی سرمایه‌گذاری» رو از روی همین رکوردهای واریز و
    // برای ماه جاری جمع می‌زنه؛ اگه اینجا فقط goal.currentAmount عوض بشه بدون
    // ثبت رکورد واریز، بودجه‌ی ماه با مبلغ واقعی پس‌انداز هم‌خوانی نخواهد داشت.
    if (dto.currentAmount !== undefined) {
      const delta = Number(dto.currentAmount) - Number(goal.currentAmount);
      if (delta !== 0) {
        await this.savingDepositRepository.save(
          this.savingDepositRepository.create({
            savingGoalId: goal.id,
            userId,
            amount: delta,
            date: this.todayJalaliString(),
          }),
        );
      }
      goal.currentAmount = dto.currentAmount;
    }

    await this.savingGoalRepository.save(goal);
    return this.getOverview(userId);
  }

  // ===== حذف هدف =====
  async remove(userId: number, id: number) {
    const goal = await this.findOwned(userId, id);
    await this.savingGoalRepository.remove(goal);
    return this.getOverview(userId);
  }

  // ===== افزودن مبلغ به یک هدف (و ثبت واریز برای لحاظ شدن در بودجه) =====
  async addAmount(userId: number, id: number, dto: AddSavingAmountDto) {
    const goal = await this.findOwned(userId, id);

    goal.currentAmount = Number(goal.currentAmount) + Number(dto.amount);
    await this.savingGoalRepository.save(goal);

    await this.savingDepositRepository.save(
      this.savingDepositRepository.create({
        savingGoalId: goal.id,
        userId,
        amount: dto.amount,
        date: this.todayJalaliString(),
      }),
    );

    return this.getOverview(userId);
  }
}
