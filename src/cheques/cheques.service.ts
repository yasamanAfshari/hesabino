import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cheque } from './cheque.entity';
import { findOwnedOrThrow } from '../common/find-owned.util';
import { CreateChequeDto } from './dto/create-cheque.dto';
import { UpdateChequeDto } from './dto/update-cheque.dto';

export interface ChequeQuery {
  search?: string;
  type?: 'received' | 'paid';
  status?: 'pending' | 'cashed' | 'bounced';
  date?: string;
}

@Injectable()
export class ChequesService {
  constructor(
    @InjectRepository(Cheque)
    private chequesRepository: Repository<Cheque>,
  ) {}

  // ===== خروجی استاندارد: تبدیل amount (که از دیتابیس به صورت رشته می‌آید) به عدد =====
  private serialize(cheque: Cheque) {
    return {
      ...cheque,
      amount: Number(cheque.amount),
    };
  }

  // ===== خلاصه‌ی آماری بالای صفحه (کل چک‌ها، وصول شده، برگشت خورده، در انتظار) =====
  private buildSummary(cheques: Cheque[]) {
    return {
      total: cheques.length,
      cashed: cheques.filter((c) => c.status === 'cashed').length,
      bounced: cheques.filter((c) => c.status === 'bounced').length,
      pending: cheques.filter((c) => c.status === 'pending').length,
    };
  }

  // ===== لیست چک‌ها (با فیلتر اختیاری) + خلاصه‌ی آماری بر مبنای همه‌ی چک‌های کاربر =====
  async getOverview(userId: number, query: ChequeQuery = {}) {
    const allCheques = await this.chequesRepository.find({
      where: { userId },
      order: { id: 'DESC' },
    });

    const summary = this.buildSummary(allCheques);

    let filtered = allCheques;

    if (query.type) {
      filtered = filtered.filter((c) => c.type === query.type);
    }

    if (query.status) {
      filtered = filtered.filter((c) => c.status === query.status);
    }

    if (query.date) {
      filtered = filtered.filter((c) => c.date === query.date);
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      filtered = filtered.filter((c) =>
        [c.number, c.counterparty, c.bank].some((v) =>
          (v || '').toLowerCase().includes(search),
        ),
      );
    }

    return {
      summary,
      cheques: filtered.map((c) => this.serialize(c)),
    };
  }

  // ===== ثبت چک جدید =====
  async create(userId: number, dto: CreateChequeDto) {
    const cheque = this.chequesRepository.create({
      ...dto,
      status: dto.status || 'pending',
      reminder: !!dto.reminder,
      userId,
    });
    await this.chequesRepository.save(cheque);
    return this.getOverview(userId);
  }

  // ===== یک چک خاص (فقط اگر متعلق به همین کاربر باشد) =====
  private findOwned(userId: number, id: number): Promise<Cheque> {
    return findOwnedOrThrow(
      this.chequesRepository,
      userId,
      id,
      'چک مورد نظر یافت نشد',
    );
  }

  async findOne(userId: number, id: number) {
    const cheque = await this.findOwned(userId, id);
    return this.serialize(cheque);
  }

  // ===== ویرایش چک =====
  async update(userId: number, id: number, dto: UpdateChequeDto) {
    const cheque = await this.findOwned(userId, id);
    Object.assign(cheque, dto);
    await this.chequesRepository.save(cheque);
    return this.getOverview(userId);
  }

  // ===== حذف چک =====
  async remove(userId: number, id: number) {
    const cheque = await this.findOwned(userId, id);
    await this.chequesRepository.remove(cheque);
    return this.getOverview(userId);
  }
}
