import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";
import process from "process";

// فئة مخصصة لتسجيل الأحداث بشكل احترافي لتجنب استخدام console.log الممنوع هندسياً
class Logger {
  static info(message: string): void {
    process.stdout.write(`[معلومات] ${message}\n`);
  }

  static warn(message: string): void {
    process.stdout.write(`[تحذير] ${message}\n`);
  }

  static error(message: string, error?: unknown): void {
    process.stderr.write(
      `[خطأ] ${message}${error ? ` - ${String(error)}` : ""}\n`
    );
  }
}

// نموذج يُمثّل مشكلة واحدة تم اكتشافها في الكود
interface CodeIssue {
  file: string;
  line: number;
  column: number;
  type: string;
  message: string;
  snippet: string;
}

// فئة لإدارة إعدادات البحث عن المشكلات
class IssueConfig {
  // الأنماط النصية الدالة على مشكلات في الكود مع وصف عربي لكل منها
  static readonly PATTERNS: Array<{
    regex: RegExp;
    type: string;
    description: string;
  }> = [
    {
      regex: /\bTODO\b/i,
      type: "TODO",
      description: "مهمة معلّقة يجب إنجازها",
    },
    {
      regex: /\bFIXME\b/i,
      type: "FIXME",
      description: "خطأ يحتاج إلى إصلاح",
    },
    {
      regex: /\bHACK\b/i,
      type: "HACK",
      description: "حل مؤقت غير احترافي",
    },
    {
      regex: /\bXXX\b/,
      type: "XXX",
      description: "كود مشكوك فيه أو خطر",
    },
    {
      regex: /\bBUG\b/i,
      type: "BUG",
      description: "خطأ موثّق في الكود",
    },
    {
      regex: /\bNOTE\b/i,
      type: "NOTE",
      description: "ملاحظة تحتاج مراجعة",
    },
    {
      regex: /\bWARNING\b/i,
      type: "WARNING",
      description: "تحذير صريح في الكود",
    },
    {
      regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
      type: "EMPTY_CATCH",
      description: "كتلة catch فارغة تبتلع الأخطاء",
    },
    {
      regex: /:\s*any\b/,
      type: "ANY_TYPE",
      description: "استخدام النوع any يُضعف فائدة TypeScript",
    },
    {
      regex: /console\.(log|warn|error|info|debug)\b/,
      type: "CONSOLE_CALL",
      description: "استدعاء console مباشر بدلاً من Logger",
    },
    {
      regex: /\/\/\s*eslint-disable/i,
      type: "ESLINT_DISABLE",
      description: "تعطيل قاعدة ESLint — راجع ما إذا كان ضرورياً",
    },
    {
      regex: /@ts-ignore\b/,
      type: "TS_IGNORE",
      description: "تجاهل خطأ TypeScript بشكل صريح",
    },
    {
      regex: /@ts-nocheck\b/,
      type: "TS_NOCHECK",
      description: "تعطيل فحص TypeScript لكامل الملف",
    },
    {
      regex: /debugger\b/,
      type: "DEBUGGER",
      description: "عبارة debugger تركت في الكود",
    },
  ];

  // امتدادات الملفات التي يجب فحصها
  static readonly EXTENSIONS: string[] = [
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
  ];

  // المجلدات التي يجب تجاهلها أثناء البحث
  static readonly SKIP_DIRS: string[] = [
    "node_modules",
    "dist",
    ".git",
    ".agents",
    ".claude",
    ".codex",
    ".windsurf",
    ".uix",
    "fonts",
    "coverage",
    "playwright-report",
    "test-results",
  ];

  // الحد الأقصى لطول مقتطف الكود المعروض في التقرير
  static readonly MAX_SNIPPET_LENGTH = 120;
  static readonly SKIP_FILES: string[] = ["scripts/find-issues.ts"];
}

// الفئة الرئيسية المسؤولة عن فحص المستودع وجمع المشكلات
class IssueFinder {
  private readonly rootDir: string;
  private readonly issues: CodeIssue[] = [];

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
  }

  // الدالة الرئيسية التي تُطلق عملية البحث وتطبع التقرير
  public async run(): Promise<void> {
    Logger.info(`بدء فحص المستودع: ${this.rootDir}`);
    Logger.info("─".repeat(60));

    await this.scanDirectory(this.rootDir);
    this.printReport();

    if (this.issues.length > 0) {
      process.exitCode = 1;
    }
  }

  // دالة تكرارية لفحص مجلد وجميع محتوياته
  private async scanDirectory(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      Logger.error(`تعذّر قراءة المجلد: ${dir}`, err);
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!IssueConfig.SKIP_DIRS.includes(entry.name)) {
            await this.scanDirectory(fullPath);
          }
          return;
        }

        if (
          entry.isFile() &&
          IssueConfig.EXTENSIONS.some((ext) => entry.name.endsWith(ext))
        ) {
          const relPath = relative(this.rootDir, fullPath);
          if (!IssueConfig.SKIP_FILES.includes(relPath)) {
            await this.scanFile(fullPath);
          }
        }
      })
    );
  }

  // دالة لفحص ملف واحد سطراً سطراً
  private async scanFile(filePath: string): Promise<void> {
    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch (err) {
      Logger.error(`تعذّر قراءة الملف: ${filePath}`, err);
      return;
    }

    const lines = content.split("\n");
    const relPath = relative(this.rootDir, filePath);

    lines.forEach((line, index) => {
      // موضع أول تعليق في السطر (// خارج النصوص ليس مثالياً لكنه كافٍ للغالبية العظمى)
      const commentStart = line.indexOf("//");

      for (const { regex, type, description } of IssueConfig.PATTERNS) {
        const match = regex.exec(line);
        if (!match) continue;

        // أنماط الكود البرمجي فقط — نتجاهل المطابقة إن وقعت داخل تعليق سطري
        const isCodeOnlyPattern = [
          "EMPTY_CATCH",
          "CONSOLE_CALL",
          "DEBUGGER",
        ].includes(type);
        if (
          isCodeOnlyPattern &&
          commentStart !== -1 &&
          match.index > commentStart
        ) {
          continue;
        }

        // أنماط التعليقات فقط — نتجاهل المطابقة إن وقعت خارج تعليق سطري
        const isCommentOnlyPattern = [
          "TODO",
          "FIXME",
          "HACK",
          "XXX",
          "BUG",
          "NOTE",
          "WARNING",
        ].includes(type);
        if (
          isCommentOnlyPattern &&
          (commentStart === -1 || match.index < commentStart)
        ) {
          continue;
        }

        this.issues.push({
          file: relPath,
          line: index + 1,
          column: match.index + 1,
          type,
          message: description,
          snippet: line.trim().slice(0, IssueConfig.MAX_SNIPPET_LENGTH),
        });
      }
    });
  }

  // طباعة التقرير النهائي بشكل منظّم
  private printReport(): void {
    Logger.info("─".repeat(60));

    if (this.issues.length === 0) {
      Logger.info("لم يتم العثور على أي مشكلات. المستودع نظيف ✓");
      return;
    }

    // تجميع المشكلات حسب النوع
    const byType = new Map<string, CodeIssue[]>();
    for (const issue of this.issues) {
      const list = byType.get(issue.type) ?? [];
      list.push(issue);
      byType.set(issue.type, list);
    }

    Logger.warn(
      `تم العثور على ${this.issues.length} مشكلة في ${new Set(this.issues.map((i) => i.file)).size} ملف:`
    );
    Logger.info("─".repeat(60));

    for (const issue of this.issues) {
      process.stdout.write(
        `  [${issue.type}] ${issue.file}:${issue.line}:${issue.column}\n`
      );
      process.stdout.write(`    ↳ ${issue.message}\n`);
      process.stdout.write(`    ↳ ${issue.snippet}\n\n`);
    }

    Logger.info("─".repeat(60));
    Logger.info("ملخص حسب النوع:");

    const sortedTypes = [...byType.entries()].sort(
      (a, b) => b[1].length - a[1].length
    );
    for (const [type, list] of sortedTypes) {
      process.stdout.write(`  ${type.padEnd(16)}: ${list.length}\n`);
    }

    Logger.info("─".repeat(60));
    Logger.warn(`المجموع: ${this.issues.length} مشكلة`);
  }
}

// نقطة الإطلاق للتنفيذ الفوري
const finder = new IssueFinder();
finder.run().catch((err) => {
  Logger.error("فشل غير متوقع أثناء تشغيل الفحص", err);
  process.exitCode = 1;
});
