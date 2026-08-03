import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLoanDto {
  @IsNotEmpty({ message: 'عنوان وام الزامی است' })
  @IsString({ message: 'عنوان نامعتبر است' })
  @MaxLength(150)
  title: string;

  @IsNotEmpty({ message: 'مبلغ کل وام الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ کل باید عدد باشد' })
  @Min(1, { message: 'مبلغ کل باید بزرگ‌تر از صفر باشد' })
  totalAmount: number;

  @IsNotEmpty({ message: 'تعداد اقساط الزامی است' })
  @Type(() => Number)
  @IsInt({ message: 'تعداد اقساط باید عدد صحیح باشد' })
  @Min(1, { message: 'تعداد اقساط باید حداقل ۱ باشد' })
  installmentsCount: number;

  // تاریخ سررسید اولین قسط؛ اگر ارسال نشود از امروز محاسبه می‌شود
  @IsOptional()
  @IsString()
  @MaxLength(16)
  firstDueDate?: string;

  // اگر این وام از قبل بوده و بخشی از اقساطش پرداخت شده، تعداد اقساط پرداخت‌شده تا الان.
  // اگر ۰ یا خالی وارد شود، هیچ چیزی از قبل حساب نمی‌شود (وام کاملاً جدید تلقی می‌شود).
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'تعداد اقساط پرداخت‌شده باید عدد صحیح باشد' })
  @Min(0, { message: 'تعداد اقساط پرداخت‌شده نمی‌تواند منفی باشد' })
  alreadyPaidCount?: number;
}
