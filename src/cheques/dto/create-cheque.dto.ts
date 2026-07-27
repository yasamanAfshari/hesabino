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

export class CreateChequeDto {
  @IsNotEmpty({ message: 'شماره چک الزامی است' })
  @IsString({ message: 'شماره چک نامعتبر است' })
  @MaxLength(64)
  number: string;

  @IsIn(['received', 'paid'], {
    message: 'نوع چک باید دریافتی (received) یا پرداختی (paid) باشد',
  })
  type: 'received' | 'paid';

  @IsNotEmpty({ message: 'مبلغ الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  counterparty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank?: string;

  @IsNotEmpty({ message: 'تاریخ الزامی است' })
  @IsString({ message: 'تاریخ نامعتبر است' })
  @MaxLength(32)
  date: string;

  @IsOptional()
  @IsIn(['pending', 'cashed', 'bounced'], {
    message: 'وضعیت باید یکی از pending، cashed یا bounced باشد',
  })
  status?: 'pending' | 'cashed' | 'bounced';

  @IsOptional()
  @IsBoolean()
  reminder?: boolean;
}
