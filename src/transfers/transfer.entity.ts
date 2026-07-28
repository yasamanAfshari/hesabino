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
import { Account } from '../accounts/accounts.entity';

// انتقال بین دو حساب؛ برخلاف تراکنش، این عملیات نه درآمد است و نه هزینه،
// بلکه صرفاً جابه‌جایی پول بین دو حساب متعلق به همان کاربر است.
@Entity('transfers')
@Index(['userId'])
export class Transfer {
  @PrimaryGeneratedColumn()
  id: number;

  // هر انتقال متعلق به یک کاربر است؛ با حذف کاربر، انتقال‌هایش هم حذف می‌شوند
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  // حساب مبدأ؛ اگر حساب آرشیو/حذف شود، ارجاع خالی می‌شود ولی سابقه‌ی انتقال باقی می‌ماند
  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fromAccountId' })
  fromAccount: Account | null;

  @Index()
  @Column({ nullable: true })
  fromAccountId: number | null;

  // حساب مقصد
  @ManyToOne(() => Account, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'toAccountId' })
  toAccount: Account | null;

  @Index()
  @Column({ nullable: true })
  toAccountId: number | null;

  // عنوان کوتاه انتقال (مثلاً «شارژ کیف پول»)؛ معادل «Name of transfer»
  @Column({ type: 'varchar', length: 150, nullable: true })
  title: string | null;

  // مبلغ به تومان (یا واحد پول حساب مبدأ)
  @Column({ type: 'decimal', precision: 16, scale: 0 })
  amount: number;

  // تاریخ شمسی به صورت متن، مثل «۱۴۰۳/۰۲/۱۰» (هم‌شکل با تراکنش‌ها)
  @Column({ type: 'varchar', length: 32 })
  date: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
