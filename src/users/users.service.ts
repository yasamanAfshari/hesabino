import { ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) { }

    async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
        const { fullname, email, password } = createUserDto;

        const existing = await this.findByEmail(email);
        if (existing) {
            throw new ConflictException('این ایمیل قبلاً ثبت‌نام کرده است');
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = this.usersRepository.create({
                fullname,
                email,
                password: hashedPassword,
            });

            const saved = await this.usersRepository.save(user);
            const { password: _pw, ...result } = saved;
            return result;
        } catch (err) {
            // مثلاً رکورد تکراری که دقیقاً هم‌زمان با چک بالا ثبت شده باشه (race condition)
            if (err?.code === 'ER_DUP_ENTRY' || err?.driverError?.code === 'ER_DUP_ENTRY') {
                throw new ConflictException('این ایمیل قبلاً ثبت‌نام کرده است');
            }
            throw new InternalServerErrorException('خطا در ثبت‌نام. لطفاً دوباره تلاش کنید.');
        }
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async findById(id: number): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find();
    }

    async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
        const user = await this.findByEmail(email);
        if (user && (await bcrypt.compare(password, user.password))) {
            const { password: _pw, ...result } = user;
            return result;
        }
        return null;
    }

    // ===== ویرایش پروفایل (نام / ایمیل) =====
    async updateProfile(id: number, dto: UpdateUserDto): Promise<Omit<User, 'password'>> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('کاربر یافت نشد');
        }

        if (dto.email && dto.email !== user.email) {
            const existing = await this.findByEmail(dto.email);
            if (existing) {
                throw new ConflictException('این ایمیل قبلاً توسط کاربر دیگری استفاده شده است');
            }
            user.email = dto.email;
        }

        if (dto.fullname) {
            user.fullname = dto.fullname;
        }

        const saved = await this.usersRepository.save(user);
        const { password: _pw, ...result } = saved;
        return result;
    }

    // ===== تغییر رمز عبور =====
    async updatePassword(id: number, currentPassword: string, newPassword: string): Promise<void> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('کاربر یافت نشد');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new UnauthorizedException('رمز عبور فعلی اشتباه است');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await this.usersRepository.save(user);
    }

    // ===== به‌روزرسانی عکس پروفایل =====
    async updateAvatar(id: number, avatarUrl: string): Promise<Omit<User, 'password'>> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('کاربر یافت نشد');
        }

        user.avatarUrl = avatarUrl;
        const saved = await this.usersRepository.save(user);
        const { password: _pw, ...result } = saved;
        return result;
    }

    // ===== حذف حساب کاربری =====
    async remove(id: number): Promise<void> {
        const user = await this.findById(id);
        if (!user) {
            throw new NotFoundException('کاربر یافت نشد');
        }
        await this.usersRepository.remove(user);
    }
}
