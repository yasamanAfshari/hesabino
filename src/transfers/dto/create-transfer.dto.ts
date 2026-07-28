import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsNotEmpty({ message: 'حساب مبدأ الزامی است' })
  @Type(() => Number)
  @IsInt({ message: 'حساب مبدأ نامعتبر است' })
  fromAccountId: number;

  @IsNotEmpty({ message: 'حساب مقصد الزامی است' })
  @Type(() => Number)
  @IsInt({ message: 'حساب مقصد نامعتبر است' })
  toAccountId: number;

  @IsNotEmpty({ message: 'مبلغ الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(1, { message: 'مبلغ باید بزرگ‌تر از صفر باشد' })
  amount: number;

  @IsNotEmpty({ message: 'تاریخ الزامی است' })
  @IsString({ message: 'تاریخ نامعتبر است' })
  @MaxLength(32)
  date: string;

  @IsOptional()
  @IsString()
  description?: string;
}
