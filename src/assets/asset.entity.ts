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

// نوع دارایی؛ برای تفکیک نمایش در داشبورد (طلا، ارز، خودرو، سهام/رمزارز و ...)
export type AssetType =
  | 'gold'
  | 'currency'
  | 'vehicle'
  | 'stock'
  | 'crypto'
  | 'realestate'
  | 'other';

@Entity('assets')
@Index(['userId'])
export class Asset {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  // عنوان دارایی، مثلاً «طلای ۱۸ عیار» یا «پراید ۹۷»
  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({
    type: 'enum',
    enum: ['gold', 'currency', 'vehicle', 'stock', 'crypto', 'realestate', 'other'],
    default: 'other',
  })
  type: AssetType;

  // ارزش فعلی این دارایی به تومان (یا مستقیم توسط کاربر وارد می‌شود، یا از ضرب مقدار × نرخ واحد محاسبه می‌شود)
  @Column({ type: 'decimal', precision: 18, scale: 0 })
  value: number;

  // مقدار دارایی (مثلاً گرم طلا، یا تعداد واحد ارز)؛ فقط برای انواع gold/currency پر می‌شود
  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  quantity: number | null;

  // نرخ واحد به تومان در تاریخ ثبت (مثلاً قیمت هر گرم طلا، یا نرخ هر دلار)؛ فقط برای انواع gold/currency
  @Column({ type: 'decimal', precision: 18, scale: 0, nullable: true })
  unitPrice: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
