import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePersonDto {
  @IsOptional()
  @IsString({ message: 'نام شخص نامعتبر است' })
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString({ message: 'توضیح نامعتبر است' })
  @MaxLength(255)
  note?: string;
}
