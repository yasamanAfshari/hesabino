import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransactionDto {
  @IsNotEmpty({ message: 'تاریخ الزامی است' })
  @IsString({ message: 'تاریخ نامعتبر است' })
  @MaxLength(32)
  date: string;

  @IsOptional()
  @IsString({ message: 'ساعت نامعتبر است' })
  @MaxLength(16)
  time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsIn(['income', 'expense'], {
    message: 'نوع مالی باید درآمد (income) یا هزینه (expense) باشد',
  })
  type: 'income' | 'expense';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subtype?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  account?: string;

  // شناسه‌ی حساب (از ماژول Accounts)؛ برای محاسبه‌ی موجودی لحظه‌ای حساب استفاده می‌شود
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'شناسه حساب نامعتبر است' })
  accountId?: number;

  @IsNotEmpty({ message: 'مبلغ الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}
