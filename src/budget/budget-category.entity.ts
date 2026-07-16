import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Budget } from './budget.entity';

// سهم یک دسته‌بندی خرج (مثل «خوراک») از بودجه‌ی یک ماه مشخص
@Entity('budget_categories')
export class BudgetCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Budget, (b) => b.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budgetId' })
  budget: Budget;

  @Index()
  @Column()
  budgetId: number;

  // نام دسته؛ یکی از BUDGET_CATEGORIES در budget.constants.ts
  @Column({ type: 'varchar', length: 100 })
  category: string;

  // درصد این دسته از کل درآمد
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentage: number;

  // مبلغ تخصیص‌یافته به این دسته (تومان)
  @Column({ type: 'decimal', precision: 16, scale: 0, default: 0 })
  amount: number;
}
