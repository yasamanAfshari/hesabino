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

export type ChallengeResult = 'in_progress' | 'completed' | 'failed';

// چالش مالی هفتگی (گیمیفیکیشن)؛ مثلاً «۷ روز بدون هزینه‌ی رستوران»
@Entity('challenges')
@Index(['userId'])
export class Challenge {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  // دسته‌بندی‌ای که کاربر باید در طول چالش از خرج کردن در آن پرهیز کند
  @Column({ type: 'varchar', length: 100 })
  avoidCategory: string;

  @Column({ type: 'int' })
  targetDays: number;

  // تاریخ شمسی شروع چالش «YYYY/MM/DD»
  @Column({ type: 'varchar', length: 16 })
  startDate: string;

  @Column({ type: 'int', default: 100 })
  rewardPoints: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({
    type: 'enum',
    enum: ['in_progress', 'completed', 'failed'],
    default: 'in_progress',
  })
  result: ChallengeResult;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
