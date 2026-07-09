import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'نام کامل الزامی است' })
  fullname: string;

  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email: string;

  @MinLength(6, { message: 'رمز عبور باید حداقل ۶ کاراکتر باشد' })
  password: string;
}