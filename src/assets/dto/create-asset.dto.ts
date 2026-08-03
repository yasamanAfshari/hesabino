import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

const ASSET_TYPES = ['gold', 'currency', 'vehicle', 'stock', 'crypto', 'realestate', 'other'];

export class CreateAssetDto {
  @IsNotEmpty({ message: 'عنوان دارایی الزامی است' })
  @IsString({ message: 'عنوان نامعتبر است' })
  @MaxLength(150)
  title: string;

  @IsIn(ASSET_TYPES, { message: 'نوع دارایی نامعتبر است' })
  type: string;

  // برای انواع gold/currency اختیاری است (چون از quantity × unitPrice محاسبه می‌شود)؛
  // برای بقیه‌ی انواع الزامی است.
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ارزش باید عدد باشد' })
  @Min(0, { message: 'ارزش نمی‌تواند منفی باشد' })
  value?: number;

  // مقدار (مثلاً گرم طلا یا تعداد واحد ارز)
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مقدار باید عدد باشد' })
  @Min(0, { message: 'مقدار نمی‌تواند منفی باشد' })
  quantity?: number;

  // نرخ واحد به تومان (مثلاً قیمت هر گرم طلا در روز ثبت، یا نرخ هر واحد ارز)
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
