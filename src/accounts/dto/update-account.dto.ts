import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { AccountType } from '../accounts.entity';

const ACCOUNT_TYPES: AccountType[] = [
  'cash',
  'bank',
  'digital_wallet',
  'crypto',
  'other',
];

export class UpdateAccountDto {
  @IsOptional()
  @IsNotEmpty({ message: 'نام حساب نمی‌تواند خالی باشد' })
  @IsString({ message: 'نام حساب نامعتبر است' })
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(ACCOUNT_TYPES, { message: 'نوع حساب نامعتبر است' })
  type?: AccountType;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'موجودی اولیه باید عدد باشد' })
  openingBalance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}