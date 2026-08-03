import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateChallengeDto {
  @IsOptional()
  @IsString({ message: 'عنوان نامعتبر است' })
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString({ message: 'دسته‌بندی نامعتبر است' })
  @MaxLength(100)
  avoidCategory?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'مدت چالش باید عدد صحیح باشد' })
  @Min(1)
  @Max(60)
  targetDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'امتیاز جایزه باید عدد صحیح باشد' })
  @Min(0)
  rewardPoints?: number;
}
