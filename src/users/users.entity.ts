import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  fullname: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  // امتیاز جمع‌شده از چالش‌های مالی تکمیل‌شده (گیمیفیکیشن)
  @Column({ type: 'int', default: 0 })
  rewardPoints: number;
}