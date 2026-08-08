import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLedgerEntryDto {
  @IsIn(['i_owe', 'they_owe'], {
    message: 'جهت تراکنش باید i_owe (من بدهکارم) یا they_owe (او بدهکار است) باشد',
  })
  direction: 'i_owe' | 'they_owe';

  @IsNotEmpty({ message: 'مبلغ الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount: number;

  @IsOptional()
  @IsString({ message: 'توضیح نامعتبر است' })
  @MaxLength(255)
  description?: string;
}
