import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSavingGoalDto {
  @IsNotEmpty({ message: 'نام هدف الزامی است' })
  @IsString({ message: 'نام هدف نامعتبر است' })
  @MaxLength(150)
  title: string;

  @IsNotEmpty({ message: 'مبلغ هدف الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ هدف باید عدد باشد' })
  @Min(1, { message: 'مبلغ هدف باید بزرگ‌تر از صفر باشد' })
  targetAmount: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ فعلی باید عدد باشد' })
  @Min(0, { message: 'مبلغ فعلی نمی‌تواند منفی باشد' })
  currentAmount?: number;

  @IsOptional()
  @IsString({ message: 'تاریخ نامعتبر است' })
  @MaxLength(16)
  deadline?: string;

  @IsOptional()
  @IsBoolean({ message: 'یادآور نامعتبر است' })
  reminder?: boolean;
}
