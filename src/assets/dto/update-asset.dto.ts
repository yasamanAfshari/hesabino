import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const ASSET_TYPES = ['gold', 'currency', 'vehicle', 'stock', 'crypto', 'realestate', 'other'];

export class UpdateAssetDto {
  @IsOptional()
  @IsNotEmpty({ message: 'عنوان دارایی نمی‌تواند خالی باشد' })
  @IsString({ message: 'عنوان نامعتبر است' })
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsIn(ASSET_TYPES, { message: 'نوع دارایی نامعتبر است' })
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ارزش باید عدد باشد' })
  @Min(0, { message: 'ارزش نمی‌تواند منفی باشد' })
  value?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مقدار باید عدد باشد' })
  @Min(0, { message: 'مقدار نمی‌تواند منفی باشد' })
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'نرخ واحد باید عدد باشد' })
  @Min(0, { message: 'نرخ واحد نمی‌تواند منفی باشد' })
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
