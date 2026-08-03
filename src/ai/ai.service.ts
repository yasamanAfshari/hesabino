import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BUDGET_CATEGORIES } from '../budget/budget.constants';

// نگاشت ساده‌ی کلمه‌کلیدی به دسته، فقط برای حالتی که Ollama در دسترس نباشد (بدون هوش مصنوعی هم کار کنه)
const KEYWORD_FALLBACK: { keywords: string[]; category: string }[] = [
  { keywords: ['اسنپ', 'تپسی', 'تاکسی', 'اتوبوس', 'مترو', 'بنزین', 'پارکینگ'], category: 'حمل و نقل' },
  { keywords: ['دیجی‌کالا', 'دیجیکالا', 'پوشاک', 'لباس', 'کفش'], category: 'خرید و پوشاک' },
  { keywords: ['رستوران', 'کافه', 'فست‌فود', 'اسنپ‌فود', 'کافی‌شاپ'], category: 'خوراک' },
  { keywords: ['سوپرمارکت', 'میوه', 'نان', 'بقالی', 'خواروبار'], category: 'خوراک' },
  { keywords: ['سینما', 'کنسرت', 'بازی', 'اسپاتیفای', 'spotify', 'netflix', 'نتفلیکس'], category: 'تفریح و سرگرمی' },
  { keywords: ['باشگاه', 'دکتر', 'داروخانه', 'بیمارستان', 'درمانگاه'], category: 'سلامت و تناسب اندام' },
  { keywords: ['دوره', 'کتاب', 'کلاس', 'آموزش', 'دانشگاه'], category: 'آموزش و توسعه' },
  { keywords: ['اجاره', 'رهن', 'قبض', 'برق', 'آب', 'گاز', 'شارژ ساختمان'], category: 'مسکن و خدمات' },
  { keywords: ['قسط', 'وام', 'بدهی'], category: 'بدهی' },
  { keywords: ['سهام', 'طلا', 'دلار', 'رمزارز', 'بورس'], category: 'سرمایه‌گذاری' },
];

function keywordCategorize(title: string): string {
  const normalized = (title || '').toLowerCase();
  for (const entry of KEYWORD_FALLBACK) {
    if (entry.keywords.some((k) => normalized.includes(k.toLowerCase()))) {
      return entry.category;
    }
  }
  return 'سایر';
}

interface OllamaChatResponse {
  message?: { role: string; content: string };
  error?: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private enabled: boolean;
  private baseUrl: string;
  private fastModelName: string;
  private smartModelName: string;
  private timeoutMs: number;

  constructor(private configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434').replace(/\/+$/, '');
    this.fastModelName = this.configService.get<string>('OLLAMA_MODEL_FAST') || 'llama3.1';
    this.smartModelName = this.configService.get<string>('OLLAMA_MODEL_SMART') || 'llama3.1';
    this.timeoutMs = Number(this.configService.get<string>('OLLAMA_TIMEOUT_MS')) || 60000;

    this.enabled = (this.configService.get<string>('OLLAMA_ENABLED') || 'true').toLowerCase() !== 'false';

    if (this.enabled) {
      this.logger.log(`AiService با Ollama روی ${this.baseUrl} راه‌اندازی شد (fast=${this.fastModelName}, smart=${this.smartModelName})`);
    } else {
      this.logger.warn('OLLAMA_ENABLED=false است؛ ماژول هوش مصنوعی در حالت جایگزین (بدون AI) کار می‌کند.');
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  private stripJsonFences(text: string): string {
    return text.replace(/```json|```/g, '').trim();
  }

  private async chat(
    modelName: string,
    systemInstruction: string,
    userText: string,
    options: { jsonMode?: boolean; maxTokens?: number } = {},
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: modelName,
          stream: false,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userText },
          ],
          ...(options.jsonMode ? { format: 'json' } : {}),
          options: {
            num_predict: options.maxTokens ?? 500,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Ollama پاسخ ${response.status} داد: ${errText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;
      if (data.error) {
        throw new Error(data.error);
      }
      return data.message?.content?.trim() || '';
    } finally {
      clearTimeout(timeout);
    }
  }

  async categorizeTransaction(title: string, type?: 'income' | 'expense'): Promise<{ category: string; usedAi: boolean }> {
    if (!this.enabled || type === 'income') {
      return { category: keywordCategorize(title), usedAi: false };
    }

    try {
      const raw = await this.chat(
        this.fastModelName,
        'تو یک دسته‌بند تراکنش‌های مالی فارسی هستی. فقط دقیقاً یکی از نام‌های دسته‌ی داده‌شده را،' +
          ' بدون هیچ توضیح یا نشانه‌ی اضافه، به‌عنوان خروجی برگردان.',
        `دسته‌های مجاز: ${BUDGET_CATEGORIES.join('، ')}\nعنوان تراکنش: «${title}»\nمناسب‌ترین دسته کدام است؟`,
        { maxTokens: 30 },
      );

      const cleaned = raw.replace(/[«»"'.]/g, '').trim();
      const matched = BUDGET_CATEGORIES.find((c) => cleaned.includes(c));
      return { category: matched || keywordCategorize(title), usedAi: !!matched };
    } catch (err) {
      this.logger.error(`خطا در دسته‌بندی هوشمند: ${err instanceof Error ? err.message : err}`);
      return { category: keywordCategorize(title), usedAi: false };
    }
  }

  async generateMonthlyInsight(snapshot: Record<string, unknown>): Promise<{
    analysis: string | null;
    suggestion: string | null;
    usedAi: boolean;
  }> {
    if (!this.enabled) {
      return { analysis: null, suggestion: null, usedAi: false };
    }

    try {
      const raw = await this.chat(
        this.smartModelName,
        'تو یک دستیار مدیریت مالی شخصی فارسی‌زبان هستی. بر اساس خلاصه‌ی JSON وضعیت مالی کاربر که در ادامه می‌آید،' +
          ' یک تحلیل کوتاه (حداکثر ۲ جمله) و یک پیشنهاد عملی و مشخص کوتاه (حداکثر ۱ جمله) بنویس.' +
          ' لحن دوستانه و مستقیم، بدون کلی‌گویی. فقط و فقط یک JSON خام با دقیقاً همین دو کلید برگردان:' +
          ' {"analysis": "...", "suggestion": "..."} — بدون Markdown، بدون توضیح اضافه.',
        JSON.stringify(snapshot),
        { jsonMode: true, maxTokens: 400 },
      );

      const text = this.stripJsonFences(raw);
      const parsed = JSON.parse(text);
      if (typeof parsed.analysis === 'string' && typeof parsed.suggestion === 'string') {
        return { analysis: parsed.analysis, suggestion: parsed.suggestion, usedAi: true };
      }
      return { analysis: null, suggestion: null, usedAi: false };
    } catch (err) {
      this.logger.error(`خطا در تولید تحلیل هوشمند: ${err instanceof Error ? err.message : err}`);
      return { analysis: null, suggestion: null, usedAi: false };
    }
  }

  // ===== تحلیل هوشمند و پیشنهادات چندخطی برای صفحه‌ی گزارش (چند بند: هشدار/نکته‌ی مثبت) =====
  async generateReportInsights(
    snapshot: Record<string, any>,
  ): Promise<{ insights: { text: string; tone: 'warning' | 'positive' }[]; usedAi: boolean }> {
    if (this.enabled) {
      try {
        const raw = await this.chat(
          this.smartModelName,
          'تو یک تحلیل‌گر مالی شخصی فارسی‌زبان هستی. بر اساس خلاصه‌ی JSON گزارش مالی کاربر که در ادامه می‌آید،' +
            ' حداکثر ۵ نکته‌ی کوتاه (هرکدام حداکثر ۱ جمله، عدد و رقم دقیق از همان داده استفاده کن، حدس نزن) تولید کن:' +
            ' نکات هشداردهنده (خرج بیش از حد، بدهی/چک معوق، نرخ پس‌انداز پایین) را با tone="warning" و نکات مثبت' +
            ' (کنترل خوب هزینه، نرخ پس‌انداز مناسب، بدون بدهی معوق) را با tone="positive" مشخص کن.' +
            ' فقط و فقط یک JSON خام با این ساختار برگردان، بدون Markdown و بدون توضیح اضافه:' +
            ' {"insights": [{"text": "...", "tone": "warning"}, ...]}',
          JSON.stringify(snapshot),
          { jsonMode: true, maxTokens: 600 },
        );

        const text = this.stripJsonFences(raw);
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
          const cleaned = parsed.insights
            .filter((i: any) => typeof i.text === 'string' && (i.tone === 'warning' || i.tone === 'positive'))
            .slice(0, 5);
          if (cleaned.length > 0) {
            return { insights: cleaned, usedAi: true };
          }
        }
      } catch (err) {
        this.logger.error(`خطا در تولید تحلیل گزارش: ${err instanceof Error ? err.message : err}`);
      }
    }

    // ===== حالت جایگزین مبتنی بر قوانین ثابت، وقتی Ollama در دسترس نیست یا پاسخ نامعتبر داد =====
    return { insights: this.buildRuleBasedReportInsights(snapshot), usedAi: false };
  }

  private buildRuleBasedReportInsights(
    snapshot: Record<string, any>,
  ): { text: string; tone: 'warning' | 'positive' }[] {
    const insights: { text: string; tone: 'warning' | 'positive' }[] = [];
    const fmt = (n: number) => Math.round(n).toLocaleString('fa-IR');

    if (snapshot.overdueDebtsCount > 0) {
      insights.push({ text: `شما ${snapshot.overdueDebtsCount} بدهی سررسیدگذشته دارید که باید هرچه زودتر مدیریت شود.`, tone: 'warning' });
    }
    if (snapshot.pendingChequesCount > 0) {
      insights.push({ text: `${snapshot.pendingChequesCount} چک در انتظار وصول دارید، برای آن نقدینگی کنار بگذارید.`, tone: 'warning' });
    }
    for (const cat of snapshot.categoryAveragesTop3 || []) {
      if (cat.comparisonPercent !== null && cat.comparisonPercent > 30) {
        insights.push({ text: `هزینه‌ی دسته «${cat.category}» نسبت به میانگین همیشگی‌تان ${cat.comparisonPercent}٪ بیشتر شده.`, tone: 'warning' });
      }
    }
    if (snapshot.savingsRatePercent !== null && snapshot.savingsRatePercent < 10) {
      insights.push({ text: `نرخ پس‌انداز این بازه فقط ${snapshot.savingsRatePercent}٪ است؛ سعی کنید بیشتر پس‌انداز کنید.`, tone: 'warning' });
    }

    if (snapshot.savingsRatePercent !== null && snapshot.savingsRatePercent >= 20) {
      insights.push({ text: `نرخ پس‌انداز ${snapshot.savingsRatePercent}٪ در این بازه عالی است، همین‌طور ادامه دهید.`, tone: 'positive' });
    }
    if (snapshot.overdueDebtsCount === 0 && snapshot.pendingChequesCount === 0) {
      insights.push({ text: 'هیچ بدهی سررسیدگذشته یا چک معوقی ندارید؛ وضعیت تعهدات‌تان سالم است.', tone: 'positive' });
    }
    if (snapshot.myDebt === 0) {
      insights.push({ text: 'شما در حال حاضر هیچ بدهی به دیگران ندارید.', tone: 'positive' });
    }
    for (const cat of snapshot.categoryAveragesTop3 || []) {
      if (cat.comparisonPercent !== null && cat.comparisonPercent < -10) {
        insights.push({ text: `هزینه‌ی دسته «${cat.category}» نسبت به میانگین همیشگی‌تان ${Math.abs(cat.comparisonPercent)}٪ کمتر شده، عالیه.`, tone: 'positive' });
      }
    }
    if (snapshot.totalSavings > 0) {
      insights.push({ text: `در مجموع در این بازه ${fmt(snapshot.totalSavings)} تومان بیشتر از هزینه‌هایتان درآمد داشته‌اید.`, tone: 'positive' });
    }

    if (insights.length === 0) {
      insights.push({ text: 'هنوز داده‌ی کافی برای تحلیل دقیق این بازه ثبت نشده است.', tone: 'positive' });
    }

    return insights.slice(0, 5);
  }

  async answerQuestion(question: string, snapshot: Record<string, unknown>): Promise<{ answer: string; usedAi: boolean }> {
    if (!this.enabled) {
      return {
        answer: 'برای فعال‌شدن دستیار هوشمند مالی، ابتدا Ollama را روی سرور نصب و اجرا کنید (یا OLLAMA_ENABLED را true کنید).',
        usedAi: false,
      };
    }

    try {
      const answer = await this.chat(
        this.smartModelName,
        'تو دستیار مدیریت مالی شخصی هسابینو هستی و فقط فارسی صحبت می‌کنی. فقط بر اساس داده‌های JSON وضعیت مالی' +
          ' کاربر که در ادامه می‌آید پاسخ بده، عدد و رقم دقیق از همان داده‌ها استفاده کن، حدس نزن.' +
          ' اگر داده‌ی کافی برای پاسخ نبود، صادقانه بگو. پاسخ کوتاه، مفید و بدون کلی‌گویی باشد (حداکثر ۴-۵ جمله).' +
          ' این توصیه‌ی مالی/حقوقی رسمی نیست، فقط بر اساس اطلاعات ثبت‌شده در برنامه است.',
        `داده‌های مالی من:\n${JSON.stringify(snapshot)}\n\nسوال: ${question}`,
        { maxTokens: 500 },
      );

      return { answer: answer || 'پاسخی دریافت نشد.', usedAi: true };
    } catch (err) {
      this.logger.error(`خطا در پاسخ‌دهی چت مالی: ${err instanceof Error ? err.message : err}`);
      return { answer: 'در حال حاضر امکان دریافت پاسخ از دستیار هوشمند وجود ندارد. لطفاً بعداً تلاش کنید.', usedAi: false };
    }
  }

  buildSnapshot(data: any): Record<string, unknown> {
    return {
      month: data.month,
      totals: data.totals,
      previousMonth: data.previousMonth,
      topCategory: data.topCategory,
      topWeekday: data.topWeekday,
      categoryBreakdownTop5: (data.categoryBreakdown || []).slice(0, 5),
      prediction: data.prediction,
      budget: { totalBudget: data.budget?.totalBudget, hasBudget: data.budget?.hasBudget },
      budgetAlerts: {
        overBudget: (data.budgetAlerts?.overBudgetCategories || []).map((c: any) => c.category),
        nearLimit: (data.budgetAlerts?.nearLimitCategories || []).map((c: any) => c.category),
      },
      closestGoal: data.closestGoal
        ? { title: data.closestGoal.title, progressPercent: data.closestGoal.progressPercent }
        : null,
      debtsSummary: data.debts?.summary,
      chequesSummary: data.chequesSummary,
      assetsTotal: data.assets?.totalValue,
      subscriptions: { activeCount: data.subscriptions?.activeCount, monthlyTotal: data.subscriptions?.monthlyTotal },
      installments: {
        activeCount: data.installments?.activeCount,
        totalRemainingAmount: data.installments?.totalRemainingAmount,
        overdueCount: data.installments?.overdueCount,
      },
      health: data.health,
      challenge: data.challenges?.current
        ? {
            title: data.challenges.current.title,
            progressPercent: data.challenges.current.progressPercent,
            result: data.challenges.current.result,
          }
        : null,
      totalRewardPoints: data.challenges?.totalPoints,
    };
  }
}
