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

export type AccountType =
  | 'cash'
  | 'bank'
  | 'card'
  | 'digital_wallet'
  | 'crypto'
  | 'other';

@Entity('accounts')
@Index(['userId'])
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  // هر حساب متعلق به یک کاربر است؛ با حذف کاربر، حساب‌هایش هم حذف می‌شوند
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  // نام حساب، مثلاً «بانک ملت» یا «کیف پول»
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['cash', 'bank', 'card', 'digital_wallet', 'crypto', 'other'],
    default: 'bank',
  })
  type: AccountType;

  // واحد پول این حساب (هر حساب واحد پول خودش را دارد)
  @Column({ type: 'varchar', length: 10, default: 'IRR' })
  currency: string;

  // موجودی اولیه (سرمایه اولیه) هنگام ایجاد حساب؛ این مقدار درآمد محسوب نمی‌شود
  // و صرفاً نقطه‌ی شروع محاسبه‌ی موجودی لحظه‌ای است.
  // موجودی لحظه‌ای هیچ‌وقت به‌صورت مستقیم ذخیره نمی‌شود؛ همیشه از روی
  // openingBalance + مجموع تراکنش‌های این حساب در AccountsService محاسبه می‌گردد.
  @Column({ type: 'decimal', precision: 16, scale: 0, default: 0 })
  openingBalance: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  // آرشیو به‌جای حذف واقعی (Soft Delete)، تا سابقه‌ی تراکنش‌های مرتبط خراب نشود
  @Column({ type: 'boolean', default: false })
  isArchived: boolean;

  // ترتیب نمایش حساب‌ها در لیست/داشبورد
  @Column({ type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
