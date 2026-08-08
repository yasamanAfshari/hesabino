import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePersonDto {
  @IsNotEmpty({ message: 'نام شخص الزامی است' })
  @IsString({ message: 'نام شخص نامعتبر است' })
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString({ message: 'توضیح نامعتبر است' })
  @MaxLength(255)
  note?: string;
}
