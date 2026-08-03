import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLoanDto {
  @IsOptional()
  @IsNotEmpty({ message: 'عنوان وام نمی‌تواند خالی باشد' })
  @IsString({ message: 'عنوان نامعتبر است' })
  @MaxLength(150)
  title?: string;
}
