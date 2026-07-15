import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transactions.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

export interface TransactionQuery {
  search?: string;
  type?: 'income' | 'expense';
  category?: string;
  date?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
  ) {}

  // ===== خروجی استاندارد: تبدیل amount (که از دیتابیس به صورت رشته می‌آید) به عدد =====
  private serialize(transaction: Transaction) {
    return {
      ...transaction,
      amount: Number(transaction.amount),
    };
  }

  // ===== ثبت تراکنش جدید =====
  async create(userId: number, dto: CreateTransactionDto) {
    const transaction = this.transactionsRepository.create({
      ...dto,
      userId,
    });
    const saved = await this.transactionsRepository.save(transaction);
    return this.serialize(saved);
  }

  // ===== لیست تراکنش‌های کاربر (با فیلتر اختیاری) =====
  async findAll(userId: number, query: TransactionQuery = {}) {
    const qb = this.transactionsRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId });

    if (query.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }

    if (query.category) {
      qb.andWhere('t.category = :category', { category: query.category });
    }

    if (query.date) {
      qb.andWhere('t.date = :date', { date: query.date });
    }

    if (query.search) {
      qb.andWhere(
        '(t.description LIKE :search OR t.category LIKE :search OR t.subtype LIKE :search OR t.account LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('t.id', 'DESC');

    const transactions = await qb.getMany();
    return transactions.map((t) => this.serialize(t));
  }

  // ===== یک تراکنش خاص (فقط اگر متعلق به همین کاربر باشد) =====
  async findOneOwned(userId: number, id: number): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id, userId },
    });
    if (!transaction) {
      throw new NotFoundException('تراکنش یافت نشد');
    }
    return transaction;
  }

  async findOne(userId: number, id: number) {
    const transaction = await this.findOneOwned(userId, id);
    return this.serialize(transaction);
  }

  // ===== ویرایش تراکنش =====
  async update(userId: number, id: number, dto: UpdateTransactionDto) {
    const transaction = await this.findOneOwned(userId, id);
    Object.assign(transaction, dto);
    const saved = await this.transactionsRepository.save(transaction);
    return this.serialize(saved);
  }

  // ===== حذف تراکنش =====
  async remove(userId: number, id: number): Promise<void> {
    const transaction = await this.findOneOwned(userId, id);
    await this.transactionsRepository.remove(transaction);
  }
}
