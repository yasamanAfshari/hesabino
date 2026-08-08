import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Person } from './person.entity';

// جهت هر تراکنش نسبت به کاربر:
// i_owe    => من به این شخص بدهکار شدم (مانده به نفع اون بالا می‌ره)
// they_owe => این شخص به من بدهکار شد (مانده به نفع من بالا می‌ره)
export type LedgerDirection = 'i_owe' | 'they_owe';

// یک ردیفِ خرد از حساب‌کتاب با یک شخص؛ مانده‌ی نهایی از جمع همین ردیف‌ها به
// دست میاد، نه این‌که مستقیم ذخیره بشه؛ چون ممکنه این تراکنش‌ها کم‌کم و زیاد
// روی هم جمع بشن.
@Entity('person_ledger_entries')
@Index(['userId', 'personId'])
export class PersonLedgerEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Person, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @Index()
  @Column()
  personId: number;

  // تکرارِ userId (علاوه بر personId) عمداً هست تا مالکیت هر ردیف مستقیم و
  // بدون join قابل بررسی باشه (هم‌راستا با الگوی بقیه‌ی ماژول‌ها).
  @Index()
  @Column()
  userId: number;

  @Column({ type: 'enum', enum: ['i_owe', 'they_owe'] })
  direction: LedgerDirection;

  @Column({ type: 'decimal', precision: 16, scale: 0 })
  amount: number;

  // توضیح اختیاری برای هر تراکنش خرد (مثلاً «قسط اول»، «ناهار دیروز»)
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
