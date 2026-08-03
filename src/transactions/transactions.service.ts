import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './transactions.entity';
import { Transfer } from '../transfers/transfer.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AccountsService } from '../accounts/accounts.service';

export interface TransactionQuery {
  search?: string;
  type?: 'income' | 'expense' | 'transfer';
  category?: string;
  date?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Transfer)
    private transfersRepository: Repository<Transfer>,
    private accountsService: AccountsService,
  ) {}

  // ===== خروجی استاندارد: تبدیل amount (که از دیتابیس به صورت رشته می‌آید) به عدد
  // و افزودن نام حساب مرتبط (از روی رابطه‌ی accountRef) برای نمایش در فرانت =====
  private serialize(transaction: Transaction) {
    return {
      ...transaction,
      amount: Number(transaction.amount),
      accountName: transaction.accountRef ? transaction.accountRef.name : null,
    };
  }

  // ===== بررسی کافی‌بودن موجودی حساب قبل از ثبت یک برداشت (هزینه) =====
  // چون هیچ اتصالی به بانک واقعی وجود ندارد و موجودی صرفاً از روی همین تراکنش‌ها
  // محاسبه می‌شود، تنها راه جلوگیری از منفی‌شدن حساب همین اعتبارسنجی است.
  private async ensureSufficientBalance(
    userId: number,
    accountId: number,
    amount: number,
  ) {
    const balance = await this.accountsService.getBalance(userId, accountId);
    if (amount > balance) {
      throw new BadRequestException(
        `موجودی حساب کافی نیست (موجودی فعلی: ${Math.round(balance).toLocaleString('en-US')} تومان)`,
      );
    }
  }

  // ===== ثبت تراکنش جدید =====
  async create(userId: number, dto: CreateTransactionDto) {
    if (dto.accountId && dto.type === 'expense') {
      await this.ensureSufficientBalance(userId, dto.accountId, dto.amount);
    }

    const transaction = this.transactionsRepository.create({
      ...dto,
      userId,
    });
    const saved = await this.transactionsRepository.save(transaction);
    return this.findOne(userId, saved.id);
  }

  // ===== لیست تراکنش‌های کاربر (با فیلتر اختیاری) =====
  async findAll(userId: number, query: TransactionQuery = {}) {
    const qb = this.transactionsRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.accountRef', 'accountRef')
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
      relations: { accountRef: true },
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

    // این رکورد فقط آینه‌ی یک انتقال بین حساب‌هاست؛ ویرایشش از همین‌جا معنی نداره
    // (چون خودِ مبلغ/تاریخ واقعی توی رکورد Transfer نگه‌داری می‌شه)
    if (transaction.transferId) {
      throw new BadRequestException(
        'این رکورد مربوط به یک انتقال بین حساب‌هاست؛ برای ویرایش یا حذف آن به صفحه‌ی حساب‌ها بروید',
      );
    }

    const finalAccountId =
      dto.accountId !== undefined ? dto.accountId : transaction.accountId;
    const finalType = dto.type || transaction.type;
    const finalAmount =
      dto.amount !== undefined ? dto.amount : Number(transaction.amount);

    if (finalAccountId && finalType === 'expense') {
      // موجودی فعلی حساب مقصد را می‌گیریم؛ اگر همین تراکنش قبلاً روی همین حساب
      // اثر داشته، آن اثر را برمی‌گردانیم تا موجودی «بدون این تراکنش» به دست بیاید
      let balance = await this.accountsService.getBalance(
        userId,
        finalAccountId,
      );
      if (transaction.accountId === finalAccountId) {
        if (transaction.type === 'income') {
          balance -= Number(transaction.amount);
        } else if (transaction.type === 'expense') {
          balance += Number(transaction.amount);
        }
      }

      if (finalAmount > balance) {
        throw new BadRequestException(
          `موجودی حساب کافی نیست (موجودی فعلی: ${Math.round(balance).toLocaleString('en-US')} تومان)`,
        );
      }
    }

    Object.assign(transaction, dto);
    const saved = await this.transactionsRepository.save(transaction);
    return this.findOne(userId, saved.id);
  }

  // ===== حذف تراکنش =====
  async remove(userId: number, id: number): Promise<void> {
    const transaction = await this.findOneOwned(userId, id);

    // این رکورد آینه‌ی یک انتقال بین حساب‌هاست؛ برای حذف درست، خودِ رکورد Transfer
    // حذف می‌شود (که با CASCADE همین رکورد نمایشی رو هم خودکار پاک می‌کنه)
    if (transaction.transferId) {
      await this.transfersRepository.delete({ id: transaction.transferId, userId });
      return;
    }

    await this.transactionsRepository.remove(transaction);
  }
}
