import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from './person.entity';
import { PersonLedgerEntry } from './person-ledger-entry.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { UpdateLedgerEntryDto } from './dto/update-ledger-entry.dto';

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person)
    private personsRepository: Repository<Person>,
    @InjectRepository(PersonLedgerEntry)
    private entriesRepository: Repository<PersonLedgerEntry>,
  ) {}

  // ===== محاسبه‌ی مانده‌ی یک شخص از روی رکوردهای بدهی/طلبش =====
  // net > 0  یعنی طرف به من بدهکاره (طلب من)
  // net < 0  یعنی من به طرف بدهکارم (بدهی من)
  private computeNet(entries: PersonLedgerEntry[]) {
    const theyOwe = entries
      .filter((e) => e.direction === 'they_owe')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const iOwe = entries
      .filter((e) => e.direction === 'i_owe')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    return { theyOwe, iOwe, net: theyOwe - iOwe };
  }

  // ترتیب ثبت (بر مبنای id) رو حفظ می‌کنه
  private sortEntries(entries: PersonLedgerEntry[]) {
    return [...entries].sort((a, b) => a.id - b.id);
  }

  // ===== خلاصه‌ی کلی برای بالای صفحه‌ی بدهی‌ها: سهم اشخاص از بدهی/طلب کلی =====
  // مانده‌ی مثبتِ هر شخص به «طلب» و مانده‌ی منفیِ هر شخص به «بدهی» اضافه می‌شه؛
  // یعنی برخلاف رکوردهای معمولِ بدهی/طلب، این‌جا فقط خالص هر شخص مهمه، نه
  // تک‌تک تراکنش‌های خردش.
  private buildOverallSummary(peopleNets: number[]) {
    const debt = peopleNets.filter((n) => n < 0).reduce((sum, n) => sum + Math.abs(n), 0);
    const receivable = peopleNets.filter((n) => n > 0).reduce((sum, n) => sum + n, 0);
    return { debt, receivable, net: receivable - debt };
  }

  // ===== لیست همه‌ی اشخاص + مانده‌ی هرکدوم + خلاصه‌ی کلی =====
  async listPeople(userId: number) {
    const people = await this.personsRepository.find({
      where: { userId },
      order: { id: 'DESC' },
    });
    const entries = await this.entriesRepository.find({ where: { userId } });

    const items = people.map((p) => {
      const personEntries = entries.filter((e) => e.personId === p.id);
      const { theyOwe, iOwe, net } = this.computeNet(personEntries);
      return {
        id: p.id,
        name: p.name,
        note: p.note,
        theyOwe,
        iOwe,
        net,
        entriesCount: personEntries.length,
      };
    });

    return {
      summary: this.buildOverallSummary(items.map((i) => i.net)),
      people: items,
    };
  }

  private async findOwnedPerson(userId: number, id: number): Promise<Person> {
    const person = await this.personsRepository.findOne({ where: { id, userId } });
    if (!person) {
      throw new NotFoundException('شخص مورد نظر یافت نشد');
    }
    return person;
  }

  // ===== ثبت شخص جدید =====
  async createPerson(userId: number, dto: CreatePersonDto) {
    const person = this.personsRepository.create({
      name: dto.name,
      note: dto.note || null,
      userId,
    });
    const saved = await this.personsRepository.save(person);
    const overview = await this.listPeople(userId);
    return { ...overview, personId: saved.id };
  }

  // ===== ویرایش نام/توضیح شخص =====
  async updatePerson(userId: number, id: number, dto: UpdatePersonDto) {
    const person = await this.findOwnedPerson(userId, id);
    if (dto.name !== undefined) person.name = dto.name;
    if (dto.note !== undefined) person.note = dto.note || null;
    await this.personsRepository.save(person);
    return this.listPeople(userId);
  }

  // ===== حذف شخص (تراکنش‌های خردش هم به‌واسطه‌ی CASCADE حذف می‌شن) =====
  async removePerson(userId: number, id: number) {
    const person = await this.findOwnedPerson(userId, id);
    await this.personsRepository.remove(person);
    return this.listPeople(userId);
  }

  // ===== جزئیات یک شخص: اطلاعات + لیست تراکنش‌های خرد + مانده‌ی روبه‌رو =====
  async getPersonDetail(userId: number, id: number) {
    const person = await this.findOwnedPerson(userId, id);
    const entries = await this.entriesRepository.find({ where: { userId, personId: id } });
    const sorted = this.sortEntries(entries);

    let running = 0;
    const items = sorted.map((e) => {
      const signedAmount = e.direction === 'they_owe' ? Number(e.amount) : -Number(e.amount);
      running += signedAmount;
      return {
        id: e.id,
        direction: e.direction,
        amount: Number(e.amount),
        description: e.description,
        balanceAfter: running,
      };
    });

    const { theyOwe, iOwe, net } = this.computeNet(entries);

    return {
      person: { id: person.id, name: person.name, note: person.note },
      summary: { theyOwe, iOwe, net },
      entries: items.reverse(), // جدیدترین بالا
    };
  }

  // ===== افزودن یک تراکنش خرد به حساب یک شخص =====
  async addEntry(userId: number, personId: number, dto: CreateLedgerEntryDto) {
    await this.findOwnedPerson(userId, personId);
    const entry = this.entriesRepository.create({
      personId,
      userId,
      direction: dto.direction,
      amount: dto.amount,
      description: dto.description || null,
    });
    await this.entriesRepository.save(entry);
    return this.getPersonDetail(userId, personId);
  }

  private async findOwnedEntry(userId: number, personId: number, entryId: number): Promise<PersonLedgerEntry> {
    const entry = await this.entriesRepository.findOne({ where: { id: entryId, userId, personId } });
    if (!entry) {
      throw new NotFoundException('تراکنش مورد نظر یافت نشد');
    }
    return entry;
  }

  // ===== ویرایش یک تراکنش خرد =====
  async updateEntry(userId: number, personId: number, entryId: number, dto: UpdateLedgerEntryDto) {
    const entry = await this.findOwnedEntry(userId, personId, entryId);
    if (dto.direction !== undefined) entry.direction = dto.direction;
    if (dto.amount !== undefined) entry.amount = dto.amount;
    if (dto.description !== undefined) entry.description = dto.description || null;
    await this.entriesRepository.save(entry);
    return this.getPersonDetail(userId, personId);
  }

  // ===== حذف یک تراکنش خرد =====
  async removeEntry(userId: number, personId: number, entryId: number) {
    const entry = await this.findOwnedEntry(userId, personId, entryId);
    await this.entriesRepository.remove(entry);
    return this.getPersonDetail(userId, personId);
  }
}
