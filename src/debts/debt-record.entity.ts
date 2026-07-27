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

// نوع رکورد: بدهی (من به کسی بدهکارم) یا طلب (کسی به من بدهکار است)
export type DebtRecordType = 'debt' | 'receivable';

@Entity('debt_records')
@Index(['userId', 'type'])
export class DebtRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  userId: number;

  // بدهی یا طلب
  @Column({ type: 'enum', enum: ['debt', 'receivable'] })
  type: DebtRecordType;

  // طرف حساب (شخص یا شرکت طرف بدهی/طلب)
  @Column({ type: 'varchar', length: 150 })
  counterparty: string;

  // مبلغ
  @Column({ type: 'decimal', precision: 16, scale: 0 })
  amount: number;

  // تاریخ سررسید (شمسی، به صورت متن، مثل «۱۴۰۳/۰۵/۱۵»)
  @Column({ type: 'varchar', length: 32 })
  dueDate: string;

  // آیا پرداخت/وصول شده؟ وضعیتِ «سررسید گذشته» به‌صورت خودکار و بر مبنای
  // تاریخ سررسید محاسبه می‌شود، نه اینکه به‌صورت دستی ذخیره شود.
  @Column({ type: 'boolean', default: false })
  isPaid: boolean;

  // یادآور سررسید
  @Column({ type: 'boolean', default: false })
  reminder: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
