import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CategorizeDto {
  @IsNotEmpty({ message: 'عنوان تراکنش الزامی است' })
  @IsString({ message: 'عنوان نامعتبر است' })
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: 'income' | 'expense';
}
