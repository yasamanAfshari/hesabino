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
import { SavingDeposit } from './saving-deposit.entity';

// یک هدف پس‌انداز (مثلاً «خرید طلا») به همراه مبلغ هدف و مبلغ فعلی ذخیره‌شده
@Entity('saving_goals')
export class SavingGoal {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  // مبلغ هدف (تومان)
  @Column({ type: 'decimal', precision: 16, scale: 0 })
  targetAmount: number;

  // مبلغ فعلی ذخیره‌شده (تومان) - با هر «افزودن مبلغ» بیشتر می‌شه
  @Column({ type: 'decimal', precision: 16, scale: 0, default: 0 })
  currentAmount: number;

  // مهلت رسیدن به هدف؛ تاریخ شمسی به فرمت «YYYY/MM/DD» (اختیاری)
  @Column({ type: 'varchar', length: 16, nullable: true })
  deadline: string | null;

  @Column({ type: 'boolean', default: false })
  reminder: boolean;

  @OneToMany(() => SavingDeposit, (d) => d.goal)
  deposits: SavingDeposit[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
