import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

// یک «شخص» که کاربر باهاش حساب‌کتاب داره (ممکنه طی زمان چندین تراکنش خرد
// باهاش ثبت بشه؛ خودِ مانده از روی مجموع تراکنش‌های PersonLedgerEntry محاسبه می‌شه).
@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  userId: number;

  // نام طرف حساب
  @Column({ type: 'varchar', length: 150 })
  name: string;

  // توضیح اختیاری (مثلاً «همکار»، «برادرم» و ...)
  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
