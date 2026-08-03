import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './asset.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

const TYPE_LABELS: Record<string, string> = {
  gold: 'طلا',
  currency: 'ارز',
  vehicle: 'خودرو',
  stock: 'سهام',
  crypto: 'رمزارز',
  realestate: 'ملک',
  other: 'سایر',
};

// انواعی که مقدار (quantity) × نرخ واحد (unitPrice) را به‌جای وارد کردن مستقیم ارزش می‌گیرند
const QUANTITY_BASED_TYPES = ['gold', 'currency'];

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private assetsRepository: Repository<Asset>,
  ) {}

  private serialize(asset: Asset) {
    return {
      ...asset,
      value: Number(asset.value),
      quantity: asset.quantity !== null && asset.quantity !== undefined ? Number(asset.quantity) : null,
      unitPrice: asset.unitPrice !== null && asset.unitPrice !== undefined ? Number(asset.unitPrice) : null,
      typeLabel: TYPE_LABELS[asset.type] || asset.type,
      isQuantityBased: QUANTITY_BASED_TYPES.includes(asset.type),
    };
  }

  // ===== برای طلا/ارز، ارزش کل از روی مقدار × نرخ واحد محاسبه می‌شود؛ برای بقیه، همان مقدار وارد شده استفاده می‌شود =====
  private resolveValue(type: string, dto: { value?: number; quantity?: number; unitPrice?: number }) {
    if (QUANTITY_BASED_TYPES.includes(type)) {
      if (dto.quantity === undefined || dto.quantity === null || dto.unitPrice === undefined || dto.unitPrice === null) {
        throw new BadRequestException('برای طلا/ارز باید مقدار و نرخ واحد وارد شود');
      }
      return {
        value: Math.round(dto.quantity * dto.unitPrice),
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
      };
    }
    if (dto.value === undefined || dto.value === null) {
      throw new BadRequestException('ارزش دارایی الزامی است');
    }
    return { value: dto.value, quantity: null, unitPrice: null };
  }

  // ===== لیست دارایی‌ها + ارزش کل + تفکیک بر اساس نوع (برای داشبورد) =====
  async getOverview(userId: number) {
    const assets = await this.assetsRepository.find({
      where: { userId },
      order: { value: 'DESC' },
    });
    const serialized = assets.map((a) => this.serialize(a));

    const totalValue = serialized.reduce((sum, a) => sum + a.value, 0);

    const byType: Record<string, number> = {};
    for (const a of serialized) {
      byType[a.type] = (byType[a.type] || 0) + a.value;
    }
    const breakdown = Object.entries(byType)
      .map(([type, value]) => ({ type, typeLabel: TYPE_LABELS[type] || type, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalValue,
      assetsCount: serialized.length,
      breakdown,
      assets: serialized,
    };
  }

  async create(userId: number, dto: CreateAssetDto) {
    const resolved = this.resolveValue(dto.type, dto);
    const asset = this.assetsRepository.create({
      title: dto.title,
      type: dto.type,
      note: dto.note ?? null,
      userId,
      ...resolved,
    } as Partial<Asset>);
    await this.assetsRepository.save(asset);
    return this.getOverview(userId);
  }

  private async findOwned(userId: number, id: number): Promise<Asset> {
    const asset = await this.assetsRepository.findOne({ where: { id, userId } });
    if (!asset) {
      throw new NotFoundException('دارایی یافت نشد');
    }
    return asset;
  }

  async update(userId: number, id: number, dto: UpdateAssetDto) {
    const asset = await this.findOwned(userId, id);
    const finalType = dto.type ?? asset.type;

    if (QUANTITY_BASED_TYPES.includes(finalType)) {
      const finalQuantity = dto.quantity ?? (asset.quantity !== null ? Number(asset.quantity) : undefined);
      const finalUnitPrice = dto.unitPrice ?? (asset.unitPrice !== null ? Number(asset.unitPrice) : undefined);
      const resolved = this.resolveValue(finalType, { quantity: finalQuantity, unitPrice: finalUnitPrice });
      Object.assign(asset, { title: dto.title ?? asset.title, note: dto.note ?? asset.note, type: finalType, ...resolved });
    } else {
      Object.assign(asset, {
        title: dto.title ?? asset.title,
        note: dto.note ?? asset.note,
        type: finalType,
        value: dto.value ?? Number(asset.value),
        quantity: null,
        unitPrice: null,
      });
    }

    await this.assetsRepository.save(asset);
    return this.getOverview(userId);
  }

  async remove(userId: number, id: number) {
    const asset = await this.findOwned(userId, id);
    await this.assetsRepository.remove(asset);
    return this.getOverview(userId);
  }

  // ===== برای استفاده‌ی داخلی داشبورد (بدون سریالایز کامل لیست) =====
  async getTotalValue(userId: number): Promise<number> {
    const assets = await this.assetsRepository.find({ where: { userId } });
    return assets.reduce((sum, a) => sum + Number(a.value), 0);
  }
}
