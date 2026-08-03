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

// اشتراک‌های تکرارشونده‌ی ماهانه (Spotify، Netflix، باشگاه و ...)
@Entity('subscriptions')
@Index(['userId'])
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  // مبلغ هر تمدید (تومان)
  @Column({ type: 'decimal', precision: 16, scale: 0 })
  amount: number;

  // روز تمدید در ماه شمسی (۱ تا ۳۱)
  @Column({ type: 'int' })
  billingDay: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
