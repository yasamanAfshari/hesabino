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

// یک وام/تسهیلات قسطی (مثل «وام خرید خودرو»)
@Entity('loans')
@Index(['userId'])
export class Loan {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  // مبلغ کل وام
  @Column({ type: 'decimal', precision: 18, scale: 0 })
  totalAmount: number;

  @Column({ type: 'int' })
  installmentsCount: number;

  // مبلغ هر قسط
  @Column({ type: 'decimal', precision: 16, scale: 0 })
  installmentAmount: number;

  @Column({ type: 'int', default: 0 })
  paidCount: number;

  // سررسید قسط بعدی؛ تاریخ شمسی «YYYY/MM/DD»، وقتی همه‌ی اقساط پرداخت شد null می‌شود
  @Column({ type: 'varchar', length: 16, nullable: true })
  nextDueDate: string | null;

  @Column({ type: 'boolean', default: false })
  isCompleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
