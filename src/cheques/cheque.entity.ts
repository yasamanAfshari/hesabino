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

// نوع چک: دریافتی (received) یا پرداختی (paid)
export type ChequeType = 'received' | 'paid';

// وضعیت چک: در انتظار / وصول شده / برگشت خورده
export type ChequeStatus = 'pending' | 'cashed' | 'bounced';

@Entity('cheques')
@Index(['userId', 'status'])
export class Cheque {
  @PrimaryGeneratedColumn()
  id: number;

  // هر چک متعلق به یک کاربر است؛ با حذف کاربر، چک‌هایش هم حذف می‌شوند
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  userId: number;

  // شماره چک
  @Column({ type: 'varchar', length: 64 })
  number: string;

  // نوع چک: دریافتی یا پرداختی
  @Column({ type: 'enum', enum: ['received', 'paid'] })
  type: ChequeType;

  // مبلغ چک (ریال/تومان بسته به تنظیمات کاربر؛ در دیتابیس decimal ذخیره می‌شود)
  @Column({ type: 'decimal', precision: 16, scale: 0 })
  amount: number;

  // طرف حساب (نام شخص یا شرکت طرف چک)
  @Column({ type: 'varchar', length: 150, nullable: true })
  counterparty: string | null;

  // نام بانک
  @Column({ type: 'varchar', length: 100, nullable: true })
  bank: string | null;

  // تاریخ سررسید چک؛ تاریخ شمسی به صورت متن، مثل «۱۴۰۳/۰۵/۱۵»
  @Column({ type: 'varchar', length: 32 })
  date: string;

  // وضعیت چک
  @Column({ type: 'enum', enum: ['pending', 'cashed', 'bounced'], default: 'pending' })
  status: ChequeStatus;

  // یادآور سررسید
  @Column({ type: 'boolean', default: false })
  reminder: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
