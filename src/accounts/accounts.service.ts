import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './accounts.entity';
import { Transaction } from '../transactions/transactions.entity';
import { Transfer } from '../transfers/transfer.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Transfer)
    private transfersRepository: Repository<Transfer>,
  ) {}

  // ===== موجودی لحظه‌ای یک حساب =====
  // هیچ‌وقت موجودی به‌صورت مستقیم در دیتابیس ذخیره نمی‌شود؛ همیشه از این فرمول
  // محاسبه می‌شود تا با حذف/ویرایش/افزودن تراکنش‌ها و انتقال‌ها همیشه درست بماند:
  //   موجودی = موجودی اولیه + مجموع درآمدها - مجموع هزینه‌ها
  //            + مجموع انتقال‌های واریزی به این حساب - مجموع انتقال‌های برداشتی از این حساب
  private async computeBalance(accountId: number): Promise<number> {
    const { incomeSum, expenseSum } = await this.transactionsRepository
      .createQueryBuilder('t')
      .select(
        "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)",
        'incomeSum',
      )
      .addSelect(
        "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)",
        'expenseSum',
      )
      .where('t.accountId = :accountId', { accountId })
      .getRawOne();

    const { transferInSum, transferOutSum } = await this.transfersRepository
      .createQueryBuilder('tr')
      .select(
        'SUM(CASE WHEN tr.toAccountId = :accountId THEN tr.amount ELSE 0 END)',
        'transferInSum',
      )
      .addSelect(
        'SUM(CASE WHEN tr.fromAccountId = :accountId THEN tr.amount ELSE 0 END)',
        'transferOutSum',
      )
      .where('tr.fromAccountId = :accountId OR tr.toAccountId = :accountId', {
        accountId,
      })
      .getRawOne();

    return (
      Number(incomeSum || 0) -
      Number(expenseSum || 0) +
      Number(transferInSum || 0) -
      Number(transferOutSum || 0)
    );
  }

  // ===== خروجی استاندارد: تبدیل مقادیر decimal (که به‌صورت رشته از دیتابیس می‌آیند) به عدد + محاسبه‌ی موجودی =====
  private async serialize(account: Account) {
    const openingBalance = Number(account.openingBalance);
    const balance = openingBalance + (await this.computeBalance(account.id));
    return {
      ...account,
      openingBalance,
      balance,
    };
  }

  // ===== موجودی لحظه‌ای یک حساب خاص (برای استفاده در سایر ماژول‌ها مثل تراکنش‌ها/انتقال‌ها،
  // که قبل از ثبت هزینه یا انتقال باید از کافی‌بودن موجودی مطمئن شوند) =====
  async getBalance(userId: number, accountId: number): Promise<number> {
    const account = await this.findOneOwned(userId, accountId);
    const openingBalance = Number(account.openingBalance);
    return openingBalance + (await this.computeBalance(accountId));
  }

  // ===== ایجاد حساب جدید =====
  async create(userId: number, dto: CreateAccountDto) {
    const account = this.accountsRepository.create({
      ...dto,
      userId,
    });
    const saved = await this.accountsRepository.save(account);
    return this.serialize(saved);
  }

  // ===== لیست حساب‌های کاربر =====
  async findAll(userId: number, includeArchived = false) {
    const qb = this.accountsRepository
      .createQueryBuilder('a')
      .where('a.userId = :userId', { userId });

    if (!includeArchived) {
      qb.andWhere('a.isArchived = false');
    }

    qb.orderBy('a.displayOrder', 'ASC').addOrderBy('a.id', 'ASC');

    const accounts = await qb.getMany();
    return Promise.all(accounts.map((a) => this.serialize(a)));
  }

  // ===== یک حساب خاص (فقط اگر متعلق به همین کاربر باشد) =====
  async findOneOwned(userId: number, id: number): Promise<Account> {
    const account = await this.accountsRepository.findOne({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException('حساب یافت نشد');
    }
    return account;
  }

  async findOne(userId: number, id: number) {
    const account = await this.findOneOwned(userId, id);
    return this.serialize(account);
  }

  // ===== ویرایش حساب =====
  async update(userId: number, id: number, dto: UpdateAccountDto) {
    const account = await this.findOneOwned(userId, id);
    Object.assign(account, dto);
    const saved = await this.accountsRepository.save(account);
    return this.serialize(saved);
  }

  // ===== آرشیو حساب (حذف امن؛ حساب و تراکنش‌های مرتبط از بین نمی‌روند) =====
  async archive(userId: number, id: number) {
    const account = await this.findOneOwned(userId, id);
    account.isArchived = true;
    const saved = await this.accountsRepository.save(account);
    return this.serialize(saved);
  }

  // ===== بازگرداندن حساب آرشیوشده =====
  async restore(userId: number, id: number) {
    const account = await this.findOneOwned(userId, id);
    account.isArchived = false;
    const saved = await this.accountsRepository.save(account);
    return this.serialize(saved);
  }

  // ===== خلاصه‌ی کلی حساب‌ها؛ برای استفاده در داشبورد و گزارش سرمایه خالص =====
  // چون هر حساب می‌تواند واحد پول متفاوتی داشته باشد، جمع کل به تفکیک ارز
  // محاسبه می‌شود تا مبالغ به اشتباه با هم جمع نشوند.
  async summary(userId: number) {
    const accounts = await this.findAll(userId, false);

    const totalsByCurrency: Record<string, number> = {};
    for (const account of accounts) {
      totalsByCurrency[account.currency] =
        (totalsByCurrency[account.currency] || 0) + account.balance;
    }

    return {
      accounts,
      totalsByCurrency,
      accountsCount: accounts.length,
    };
  }
}
