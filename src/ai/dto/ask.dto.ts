import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AskDto {
  @IsNotEmpty({ message: 'سوال نمی‌تواند خالی باشد' })
  @IsString({ message: 'سوال نامعتبر است' })
  @MaxLength(400)
  question: string;
}
