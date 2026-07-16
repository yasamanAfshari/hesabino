import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';
import { BudgetCategory } from './budget-category.entity';

// بودجه‌ی هر کاربر برای یک ماه شمسی مشخص (مثلاً «۱۴۰۳/۰۲»)
@Entity('budgets')
@Index(['userId', 'month'], { unique: true })
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  // ماه شمسی به فرمت «YYYY/MM»، مثل «۱۴۰۳/۰۲»
  @Column({ type: 'varchar', length: 16 })
  month: string;

  // درآمد وارد شده برای همین ماه (تومان)
  @Column({ type: 'decimal', precision: 16, scale: 0, default: 0 })
  income: number;

  @OneToMany(() => BudgetCategory, (c) => c.budget, {
    cascade: true,
    eager: true,
    orphanedRowAction: 'delete',
  })
  categories: BudgetCategory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
