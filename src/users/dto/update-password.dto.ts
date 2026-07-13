import { MinLength, IsNotEmpty } from 'class-validator';

export class UpdatePasswordDto {
  @IsNotEmpty({ message: 'رمز عبور فعلی الزامی است' })
  currentPassword: string;

  @MinLength(6, { message: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد' })
  newPassword: string;
}
