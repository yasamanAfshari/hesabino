import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Challenge } from './challenge.entity';
import { Transaction } from '../transactions/transactions.entity';
import { User } from '../users/users.entity';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { UpdateChallengeDto } from './dto/update-challenge.dto';
import { daysBetweenJalali, todayJalaliString } from '../common/jalali.util';

@Injectable()
export class ChallengesService {
  constructor(
    @InjectRepository(Challenge)
    private challengesRepository: Repository<Challenge>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  // ===== ارزیابی چالش فعال بر اساس تراکنش‌های واقعی کاربر، و به‌روزرسانی وضعیت آن =====
  private async evaluate(challenge: Challenge): Promise<Challenge> {
    if (!challenge.isActive || challenge.isCompleted) return challenge;

    const today = todayJalaliString();
    const daysElapsed = daysBetweenJalali(challenge.startDate, today) ?? 0;

    // تراکنش‌های هزینه‌ی همین دسته، از زمان شروع چالش به بعد
    const expenses = await this.transactionsRepository.find({
      where: { userId: challenge.userId, type: 'expense', category: challenge.avoidCategory },
    });

    let violationDayOffset: number | null = null;
    for (const tx of expenses) {
      const offset = daysBetweenJalali(challenge.startDate, tx.date);
      if (offset === null) continue;
      if (offset >= 0 && offset < challenge.targetDays) {
        if (violationDayOffset === null || offset < violationDayOffset) {
          violationDayOffset = offset;
        }
      }
    }

    const wasCompleted = challenge.isCompleted;

    if (violationDayOffset !== null) {
      challenge.result = 'failed';
      challenge.isCompleted = true;
      challenge.isActive = false;
    } else if (daysElapsed + 1 >= challenge.targetDays) {
      challenge.result = 'completed';
      challenge.isCompleted = true;
      challenge.isActive = false;

      if (!wasCompleted) {
        const user = await this.usersRepository.findOne({ where: { id: challenge.userId } });
        if (user) {
          user.rewardPoints = (user.rewardPoints || 0) + challenge.rewardPoints;
          await this.usersRepository.save(user);
        }
      }
    } else {
      challenge.result = 'in_progress';
    }

    return this.challengesRepository.save(challenge);
  }

  private serialize(challenge: Challenge) {
    const today = todayJalaliString();
    const daysElapsed = daysBetweenJalali(challenge.startDate, today) ?? 0;
    const daysCompleted = Math.max(0, Math.min(challenge.targetDays, daysElapsed + 1));
    const progressPercent = challenge.targetDays > 0
      ? Math.round((daysCompleted / challenge.targetDays) * 100)
      : 0;

    return {
      ...challenge,
      daysCompleted,
      progressPercent: Math.min(100, progressPercent),
    };
  }

  // ===== چالش فعال کاربر (اگر باشد) به‌همراه امتیاز کل (برای داشبورد) =====
  async getOverview(userId: number) {
    let current = await this.challengesRepository.findOne({
      where: { userId, isActive: true },
      order: { id: 'DESC' },
    });

    if (current) {
      current = await this.evaluate(current);
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });

    const history = await this.challengesRepository.find({
      where: { userId },
      order: { id: 'DESC' },
      take: 5,
    });

    return {
      current: current ? this.serialize(current) : null,
      totalPoints: user ? user.rewardPoints : 0,
      history: history.map((c) => this.serialize(c)),
    };
  }

  // ===== شروع چالش جدید (چالش فعال قبلی در صورت وجود متوقف می‌شود) =====
  async create(userId: number, dto: CreateChallengeDto) {
    const today = todayJalaliString();

    // اگر کاربر همین امروز در این دسته هزینه‌ای ثبت کرده باشد، چالش از همان لحظه‌ی
    // ثبت شکست‌خورده محسوب می‌شود (چون evaluate روز صفر را هم بررسی می‌کند) و در
    // فراخوانی بعدی getOverview دیگر isActive نیست و از لیست ناپدید می‌شود؛ در نتیجه
    // پیام «چالش ثبت شد» گمراه‌کننده بود. برای جلوگیری از این حالت، همینجا جلوی
    // ثبت چالش را می‌گیریم.
    const usedTodayInCategory = await this.transactionsRepository.findOne({
      where: {
        userId,
        type: 'expense',
        category: dto.avoidCategory,
        date: today,
      },
    });
    if (usedTodayInCategory) {
      throw new BadRequestException(
        `امروز در دستهٔ «${dto.avoidCategory}» هزینه ثبت کرده‌اید،
برای همین شروع چالش پرهیز از این دسته از امروز ممکن نیست.
می‌توانید فردا دوباره امتحان کنید یا دستهٔ دیگری را انتخاب کنید.`,
      );
    }

    const activeExisting = await this.challengesRepository.find({
      where: { userId, isActive: true },
    });
    for (const c of activeExisting) {
      c.isActive = false;
      await this.challengesRepository.save(c);
    }

    const challenge = this.challengesRepository.create({
      userId,
      title: dto.title,
      avoidCategory: dto.avoidCategory,
      targetDays: dto.targetDays || 7,
      rewardPoints: dto.rewardPoints || 100,
      startDate: today,
      isActive: true,
      isCompleted: false,
      result: 'in_progress',
    } as Partial<Challenge>);

    await this.challengesRepository.save(challenge);
    return this.getOverview(userId);
  }

  // ===== انصراف از چالش جاری =====
  async cancel(userId: number, id: number) {
    const challenge = await this.challengesRepository.findOne({ where: { id, userId } });
    if (!challenge) {
      throw new NotFoundException('چالش یافت نشد');
    }
    if (challenge.isCompleted) {
      throw new BadRequestException('این چالش قبلاً به پایان رسیده است');
    }
    challenge.isActive = false;
    await this.challengesRepository.save(challenge);
    return this.getOverview(userId);
  }

  // ===== ویرایش چالش (عنوان/دسته/مدت/امتیاز جایزه) =====
  async update(userId: number, id: number, dto: UpdateChallengeDto) {
    const challenge = await this.challengesRepository.findOne({ where: { id, userId } });
    if (!challenge) {
      throw new NotFoundException('چالش یافت نشد');
    }
    Object.assign(challenge, dto);
    await this.challengesRepository.save(challenge);
    return this.getOverview(userId);
  }

  // ===== حذف کامل چالش =====
  async remove(userId: number, id: number) {
    const challenge = await this.challengesRepository.findOne({ where: { id, userId } });
    if (!challenge) {
      throw new NotFoundException('چالش یافت نشد');
    }
    await this.challengesRepository.remove(challenge);
    return this.getOverview(userId);
  }
}