import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTransactionDto {
  @IsOptional()
  @IsNotEmpty({ message: 'تاریخ نمی‌تواند خالی باشد' })
  @IsString({ message: 'تاریخ نامعتبر است' })
  @MaxLength(32)
  date?: string;

  @IsOptional()
  @IsString({ message: 'ساعت نامعتبر است' })
  @MaxLength(16)
  time?: string;

  @IsOptional()
  @IsIn(['income', 'expense'], {
    message: 'نوع مالی باید درآمد (income) یا هزینه (expense) باشد',
  })
  type?: 'income' | 'expense';

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
