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

export class CreateDebtRecordDto {
  @IsIn(['debt', 'receivable'], {
    message: 'نوع رکورد باید بدهی (debt) یا طلب (receivable) باشد',
  })
  type: 'debt' | 'receivable';

  @IsNotEmpty({ message: 'طرف حساب الزامی است' })
  @IsString({ message: 'طرف حساب نامعتبر است' })
  @MaxLength(150)
  counterparty: string;

  @IsNotEmpty({ message: 'مبلغ الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount: number;

  @IsNotEmpty({ message: 'تاریخ سررسید الزامی است' })
  @IsString({ message: 'تاریخ سررسید نامعتبر است' })
  @MaxLength(32)
  dueDate: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @IsOptional()
  @IsBoolean()
  reminder?: boolean;
}
