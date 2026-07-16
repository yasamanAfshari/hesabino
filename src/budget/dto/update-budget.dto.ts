import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BUDGET_CATEGORIES } from '../budget.constants';

export class BudgetCategoryInputDto {
  @IsIn(BUDGET_CATEGORIES, { message: 'دسته‌بندی نامعتبر است' })
  category: string;

  // اگه فرستاده نشه، از روی amount و درآمد محاسبه می‌شه
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'درصد باید عدد باشد' })
  @Min(0, { message: 'درصد نمی‌تواند منفی باشد' })
  percentage?: number;

  // اگه فرستاده نشه، از روی percentage و درآمد محاسبه می‌شه
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ باید عدد باشد' })
  @Min(0, { message: 'مبلغ نمی‌تواند منفی باشد' })
  amount?: number;
}

export class UpdateBudgetDto {
  @IsNotEmpty({ message: 'درآمد الزامی است' })
  @Type(() => Number)
  @IsNumber({}, { message: 'درآمد باید عدد باشد' })
  @Min(0, { message: 'درآمد نمی‌تواند منفی باشد' })
  income: number;

  @IsArray({ message: 'لیست دسته‌بندی‌ها نامعتبر است' })
  @ValidateNested({ each: true })
  @Type(() => BudgetCategoryInputDto)
  categories: BudgetCategoryInputDto[];
}
