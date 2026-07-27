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

export class UpdateChequeDto {
  @IsOptional()
  @IsNotEmpty({ message: 'شماره چک نمی‌تواند خالی باشد' })
  @IsString({ message: 'شماره چک نامعتبر است' })
  @MaxLength(64)
  number?: string;

  @IsOptional()
  @IsIn(['received', 'paid'], {
    message: 'نوع چک باید دریافتی (received) یا پرداختی (paid) باشد',
  })
  type?: 'received' | 'paid';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  counterparty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'تاریخ نمی‌تواند خالی باشد' })
  @IsString({ message: 'تاریخ نامعتبر است' })
  @MaxLength(32)
  date?: string;

  @IsOptional()
  @IsIn(['pending', 'cashed', 'bounced'], {
    message: 'وضعیت باید یکی از pending، cashed یا bounced باشد',
  })
  status?: 'pending' | 'cashed' | 'bounced';

  @IsOptional()
  @IsBoolean()
  reminder?: boolean;
}
