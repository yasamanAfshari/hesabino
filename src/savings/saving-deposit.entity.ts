import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { SavingGoal } from './saving-goal.entity';

// ثبت هر «افزودن مبلغ» به یک هدف پس‌انداز؛ این رکوردها هستن که باعث می‌شن
// مبلغ پس‌انداز شده توی صفحه‌ی بودجه (دسته‌ی «سرمایه‌گذاری») لحاظ بشه.
@Entity('saving_deposits')
// این ایندکس ترکیبی مخصوص کوئری‌ای هست که BudgetService برای جمع واریزهای
// پس‌انداز هر ماه (به تفکیک کاربر) اجرا می‌کنه.
@Index(['userId', 'date'])
export class SavingDeposit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SavingGoal, (g) => g.deposits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'savingGoalId' })
  goal: SavingGoal;

  @Index()
  @Column()
  savingGoalId: number;

  @Index()
  @Column()
  userId: number;

  @Column({ type: 'decimal', precision: 16, scale: 0 })
  amount: number;

  // تاریخ شمسی ثبت واریز، به فرمت «YYYY/MM/DD» (برای تطبیق با ماه جاری در بودجه)
  @Column({ type: 'varchar', length: 16 })
  date: string;

  @CreateDateColumn()
  createdAt: Date;
}
