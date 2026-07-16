import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CalculateBudgetDto {
  @IsNotEmpty({ message: 'درآمد الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'درآمد باید عدد باشد' })
  @Min(0, { message: 'درآمد نمی‌تواند منفی باشد' })
  income: number;
}
