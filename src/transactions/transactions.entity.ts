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

export type TransactionType = 'income' | 'expense';

@Entity('transactions')
// این ایندکس ترکیبی مخصوص کوئری‌ای هست که BudgetService برای جمع هزینه‌های
// هر ماه (به تفکیک کاربر و نوع تراکنش) اجرا می‌کنه.
@Index(['userId', 'type', 'date'])
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  // هر تراکنش متعلق به یک کاربر است؛ با حذف کاربر، تراکنش‌هایش هم حذف می‌شوند
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  userId: number;

  // تاریخ شمسی به صورت متن، مثل «۱۴۰۳/۰۲/۱۰» (همون چیزی که تقویم فارسی سمت کاربر تولید می‌کنه)
  @Column({ type: 'varchar', length: 32 })
  date: string;

  // ساعت به صورت متن، مثل «۱۴:۳۰»
  @Column({ type: 'varchar', length: 16, nullable: true })
  time: string | null;

  // نوع مالی: درآمد (واریز) یا هزینه (برداشت)
  @Column({ type: 'enum', enum: ['income', 'expense'] })
  type: TransactionType;

  // نوع تراکنش (مثلاً خرید اینترنتی، انتقال به کارت و ...)
  @Column({ type: 'varchar', length: 100, nullable: true })
  subtype: string | null;

  // دسته‌بندی تراکنش
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  // حساب مرتبط
  @Column({ type: 'varchar', length: 100, nullable: true })
  account: string | null;

  // مبلغ به تومان (در دیتابیس decimal ذخیره می‌شود؛ درایور mysql آن را به صورت رشته برمی‌گرداند
  // که در TransactionsService.serialize() به عدد تبدیل می‌شود)
  @Column({ type: 'decimal', precision: 16, scale: 0 })
  amount: number;

  // توضیحات
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
