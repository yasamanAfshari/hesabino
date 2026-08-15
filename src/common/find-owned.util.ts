import { NotFoundException } from '@nestjs/common';
import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';

/**
 * رکورد رو با شرط «id + مالکِ userId» از ریپازیتوری پیدا می‌کنه؛ اگه پیدا نشد
 * (چه اصلاً وجود نداشته باشه، چه مال کاربر دیگه‌ای باشه) NotFoundException
 * با پیام اختصاصیِ همون ماژول پرتاب می‌کنه.
 *
 * این تابع جایگزینِ متد تکراری findOwned/findOwnedPerson/... شده که توی
 * سرویس‌های assets، cheques، debts، installments، persons، savings و
 * subscriptions عیناً تکرار شده بود.
 */
export async function findOwnedOrThrow<
  T extends ObjectLiteral & { id: number; userId: number },
>(
  repository: Repository<T>,
  userId: number,
  id: number,
  notFoundMessage: string,
): Promise<T> {
  const entity = await repository.findOne({
    where: { id, userId } as unknown as FindOptionsWhere<T>,
  });
  if (!entity) {
    throw new NotFoundException(notFoundMessage);
  }
  return entity;
}
