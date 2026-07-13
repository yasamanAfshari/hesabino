import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Get,
  Req,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { User } from './users.entity';

const AVATAR_DIR = join(process.cwd(), 'public', 'uploads', 'avatars');
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  // حداکثر ۵ تلاش در دقیقه برای هر IP، جلوگیری از حمله‌ی brute-force روی ثبت‌نام
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    const { access_token } = await this.authService.login(user);
    return { ...user, access_token };
  }

  // حداکثر ۵ تلاش در دقیقه برای هر IP، جلوگیری از حدس زدن رمز عبور
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    const user = await this.usersService.validateUser(
      loginUserDto.email,
      loginUserDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است');
    }
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@Req() req: any): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    const { password, ...result } = user;
    return result;
  }

  // ===== ویرایش نام / ایمیل =====
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  // ===== تغییر رمز عبور =====
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async updatePassword(@Req() req: any, @Body() dto: UpdatePasswordDto) {
    await this.usersService.updatePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'رمز عبور با موفقیت تغییر کرد' };
  }

  // ===== آپلود عکس پروفایل =====
  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(AVATAR_DIR)) {
            mkdirSync(AVATAR_DIR, { recursive: true });
          }
          cb(null, AVATAR_DIR);
        },
        filename: (req: any, file, cb) => {
          const userId = req.user?.userId ?? 'unknown';
          const uniqueSuffix = Date.now();
          cb(null, `user-${userId}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 }, // حداکثر ۲ مگابایت
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('فرمت عکس باید JPG، PNG یا WebP باشد') as any, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('فایلی ارسال نشده است');
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.usersService.updateAvatar(req.user.userId, avatarUrl);
  }

  // ===== حذف حساب کاربری =====
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  async remove(@Req() req: any) {
    await this.usersService.remove(req.user.userId);
    return { message: 'حساب کاربری با موفقیت حذف شد' };
  }
}
