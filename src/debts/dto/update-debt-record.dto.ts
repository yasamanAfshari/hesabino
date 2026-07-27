import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDebtRecordDto {
  @IsOptional()
  @IsIn(['debt', 'receivable'], {
    message: 'نوع رکورد باید بدهی (debt) یا طلب (receivable) باشد',
  })
  type?: 'debt' | 'receivable';

  @IsOptional()
  @IsNotEmpty({ message: 'طرف حساب نمی‌تواند خالی باشد' })
  @IsString({ message: 'طرف حساب نامعتبر است' })
  @MaxLength(150)
  counterparty?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount?: number;

  @IsOptional()
  @IsNotEmpty({ message: 'تاریخ سررسید نمی‌تواند خالی باشد' })
  @IsString({ message: 'تاریخ سررسید نامعتبر است' })
  @MaxLength(32)
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  reminder?: boolean;
}
