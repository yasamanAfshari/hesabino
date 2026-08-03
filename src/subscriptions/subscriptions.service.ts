import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import {
  currentJalaliDate,
  daysInJalaliMonth,
  formatJalali,
  jalaliToGregorian,
} from '../common/jalali.util';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionsRepository: Repository<Subscription>,
  ) {}

  // ===== تاریخ تمدید بعدی و تعداد روزهای باقی‌مانده، بر اساس روز تمدید ماهانه =====
  private computeNextCharge(billingDay: number) {
    const today = currentJalaliDate();
    const dimThisMonth = daysInJalaliMonth(today.y, today.m);
    const clampedDay = Math.min(billingDay, dimThisMonth);

    let targetY = today.y;
    let targetM = today.m;
    let targetD = clampedDay;

    if (today.d > clampedDay) {
      targetM += 1;
      if (targetM > 12) {
        targetM = 1;
        targetY += 1;
      }
      const dimNextMonth = daysInJalaliMonth(targetY, targetM);
      targetD = Math.min(billingDay, dimNextMonth);
    }

    const nextChargeDate = formatJalali(targetY, targetM, targetD);
    const targetGregorian = jalaliToGregorian(targetY, targetM, targetD);
    const todayGregorian = jalaliToGregorian(today.y, today.m, today.d);
    const daysLeft = Math.round(
      (targetGregorian.getTime() - todayGregorian.getTime()) / 86400000,
    );

    return { nextChargeDate, daysLeft };
  }

  private serialize(sub: Subscription) {
    const { nextChargeDate, daysLeft } = this.computeNextCharge(sub.billingDay);
    return {
      ...sub,
      amount: Number(sub.amount),
      nextChargeDate,
      daysLeft,
      isUrgent: daysLeft <= 3,
    };
  }

  // ===== لیست اشتراک‌های فعال + مجموع ماهانه (برای داشبورد) =====
  async getOverview(userId: number) {
    const subs = await this.subscriptionsRepository.find({
      where: { userId },
      order: { id: 'DESC' },
    });
    const serialized = subs
      .map((s) => this.serialize(s))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const active = serialized.filter((s) => s.isActive);

    return {
      activeCount: active.length,
      monthlyTotal: active.reduce((sum, s) => sum + s.amount, 0),
      subscriptions: serialized,
    };
  }

  async create(userId: number, dto: CreateSubscriptionDto) {
    const sub = this.subscriptionsRepository.create({
      ...dto,
      isActive: dto.isActive === undefined ? true : dto.isActive,
      userId,
    } as Partial<Subscription>);
    await this.subscriptionsRepository.save(sub);
    return this.getOverview(userId);
  }

  private async findOwned(userId: number, id: number): Promise<Subscription> {
    const sub = await this.subscriptionsRepository.findOne({ where: { id, userId } });
    if (!sub) {
      throw new NotFoundException('اشتراک یافت نشد');
    }
    return sub;
  }

  async update(userId: number, id: number, dto: UpdateSubscriptionDto) {
    const sub = await this.findOwned(userId, id);
    Object.assign(sub, dto);
    await this.subscriptionsRepository.save(sub);
    return this.getOverview(userId);
  }

  async remove(userId: number, id: number) {
    const sub = await this.findOwned(userId, id);
    await this.subscriptionsRepository.remove(sub);
    return this.getOverview(userId);
  }

  // ===== برای استفاده‌ی داخلی داشبورد =====
  async getActiveMonthlyTotal(userId: number): Promise<number> {
    const subs = await this.subscriptionsRepository.find({ where: { userId, isActive: true } });
    return subs.reduce((sum, s) => sum + Number(s.amount), 0);
  }
}
