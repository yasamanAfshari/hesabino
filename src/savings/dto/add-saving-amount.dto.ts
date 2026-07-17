import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddSavingAmountDto {
  @IsNotEmpty({ message: 'مبلغ الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(1, { message: 'مبلغ باید بزرگ‌تر از صفر باشد' })
  amount: number;
}
