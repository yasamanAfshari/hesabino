import { IsInt, IsNotEmpty, IsNumber, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// موقع ویرایش، برخلاف ثبتِ اولیه، همه‌ی فیلدها (از جمله سررسید قسط بعدی) الزامی‌ان؛
// چون فرم ویرایش همیشه با مقادیر فعلیِ وام پر می‌شه و کاربر همه‌شون رو می‌بینه/می‌تونه عوض کنه.
export class UpdateLoanDto {
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

  @IsNotEmpty({ message: 'تعداد اقساط پرداخت‌شده الزامی است' })
  @Type(() => Number)
  @IsInt({ message: 'تعداد اقساط پرداخت‌شده باید عدد صحیح باشد' })
  @Min(0, { message: 'تعداد اقساط پرداخت‌شده نمی‌تواند منفی باشد' })
  paidCount: number;

  // سررسید قسط بعدی؛ فقط وقتی همه‌ی اقساط پرداخت‌شده باشن نادیده گرفته می‌شه
  @IsNotEmpty({ message: 'تاریخ سررسید قسط بعدی الزامی است' })
  @IsString()
  @MaxLength(16)
  nextDueDate: string;
}
