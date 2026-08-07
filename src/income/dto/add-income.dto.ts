import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

// ===== ثبت دستی یک درآمد؛ در واقع فقط یک لایه‌ی نازک روی ثبت تراکنشِ نوع «درآمد»‌است
// (همون کاری که از صفحه‌ی تراکنش‌ها هم می‌شه انجام داد)، تا هم از صفحه‌ی درآمد و هم از
// صفحه‌ی تراکنش‌ها بشه درآمد ثبت کرد و همه‌جا یکسان دیده بشه =====
export class AddIncomeDto {
  @IsNotEmpty({ message: 'تاریخ الزامی است' })
  @IsString({ message: 'تاریخ نامعتبر است' })
  @MaxLength(32)
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

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
