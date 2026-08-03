import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsNotEmpty({ message: 'نام اشتراک نمی‌تواند خالی باشد' })
  @IsString({ message: 'نام اشتراک نامعتبر است' })
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'روز تمدید باید عدد صحیح باشد' })
  @Min(1, { message: 'روز تمدید باید بین ۱ تا ۳۱ باشد' })
  @Max(31, { message: 'روز تمدید باید بین ۱ تا ۳۱ باشد' })
  billingDay?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
