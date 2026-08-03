import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transfer } from './transfer.entity';
import { Account } from '../accounts/accounts.entity';
import { Transaction } from '../transactions/transactions.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Transfer)
    private transfersRepository: Repository<Transfer>,
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private accountsService: AccountsService,
  ) {}

  // ===== خروجی استاندارد: تبدیل amount به عدد + برچسب نام حساب‌ها برای نمایش =====
  private serialize(transfer: Transfer) {
    return {
      ...transfer,
      amount: Number(transfer.amount),
      fromAccountName: transfer.fromAccount ? transfer.fromAccount.name : null,
      toAccountName: transfer.toAccount ? transfer.toAccount.name : null,
    };
  }

  // ===== اطمینان از این‌که هر دو حساب متعلق به همین کاربر هستند =====
  private async ensureOwnedAccounts(
    userId: number,
    fromAccountId: number,
    toAccountId: number,
  ): Promise<{ fromAccount: Account; toAccount: Account }> {
    if (fromAccountId === toAccountId) {
      throw new BadRequestException(
        'حساب مبدأ و مقصد نمی‌توانند یکسان باشند',
      );
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.accountsRepository.findOne({
        where: { id: fromAccountId, userId },
      }),
      this.accountsRepository.findOne({ where: { id: toAccountId, userId } }),
    ]);

    if (!fromAccount) {
      throw new NotFoundException('حساب مبدأ یافت نشد');
    }
    if (!toAccount) {
      throw new NotFoundException('حساب مقصد یافت نشد');
    }

    return { fromAccount, toAccount };
  }

  // ===== ثبت انتقال جدید بین دو حساب =====
  async create(userId: number, dto: CreateTransferDto) {
    const { fromAccount, toAccount } = await this.ensureOwnedAccounts(
      userId,
      dto.fromAccountId,
      dto.toAccountId,
    );

    // چون هیچ اتصالی به بانک واقعی وجود ندارد، تنها راه جلوگیری از منفی‌شدن
    // حساب مبدأ همین بررسی است: موجودی فعلی باید حداقل به‌اندازه‌ی مبلغ انتقال باشد
    const fromBalance = await this.accountsService.getBalance(
      userId,
      dto.fromAccountId,
    );
    if (dto.amount > fromBalance) {
      throw new BadRequestException(
        `موجودی حساب مبدأ کافی نیست (موجودی فعلی: ${Math.round(fromBalance).toLocaleString('en-US')} تومان)`,
      );
    }

    const transfer = this.transfersRepository.create({
      ...dto,
      userId,
    });
    const saved = await this.transfersRepository.save(transfer);

    // یک رکورد نمایشی توی تراکنش‌ها هم ثبت می‌شه تا انتقال توی لیست تراکنش‌ها هم دیده بشه.
    // این رکورد در محاسبه‌ی موجودی حساب‌ها شرکت نمی‌کنه (AccountsService فقط
    // income/expense رو جمع می‌زنه)، پس هیچ اثر تکراری روی موجودی نمی‌ذاره.
    const mirrorTransaction = this.transactionsRepository.create({
      userId,
      date: dto.date,
      type: 'transfer',
      title:
        dto.title || `انتقال از ${fromAccount.name} به ${toAccount.name}`,
      amount: dto.amount,
      description: dto.description || null,
      transferId: saved.id,
    });
    await this.transactionsRepository.save(mirrorTransaction);

    return this.findOne(userId, saved.id);
  }

  // ===== لیست انتقال‌های کاربر (جدیدترین اول) =====
  async findAll(userId: number) {
    const transfers = await this.transfersRepository.find({
      where: { userId },
      relations: { fromAccount: true, toAccount: true },
      order: { id: 'DESC' },
    });
    return transfers.map((t) => this.serialize(t));
  }

  async findOneOwned(userId: number, id: number): Promise<Transfer> {
    const transfer = await this.transfersRepository.findOne({
      where: { id, userId },
      relations: { fromAccount: true, toAccount: true },
    });
    if (!transfer) {
      throw new NotFoundException('انتقال یافت نشد');
    }
    return transfer;
  }

  async findOne(userId: number, id: number) {
    const transfer = await this.findOneOwned(userId, id);
    return this.serialize(transfer);
  }

  // ===== حذف انتقال (موجودی هر دو حساب چون به‌صورت لحظه‌ای محاسبه می‌شود، خودکار اصلاح می‌شود) =====
  async remove(userId: number, id: number): Promise<void> {
    const transfer = await this.findOneOwned(userId, id);
    await this.transactionsRepository.delete({ userId, transferId: id });
    await this.transfersRepository.remove(transfer);
  }
}
