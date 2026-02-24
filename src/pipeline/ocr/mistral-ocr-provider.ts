import type { OcrPageResult, OcrProvider } from "../types.js";

type MistralOcrResponse = {
  pages?: Array<{
    index?: number;
    markdown?: string;
    text?: string;
  }>;
  document_annotation?: string | null;
};

export class MistralOcrProvider implements OcrProvider {
  public name = "mistral";

  private apiKey: string;
  private model: string;
  private endpoint: string;

  constructor(opts?: { apiKey?: string; model?: string; endpoint?: string }) {
    this.apiKey = opts?.apiKey || process.env.MISTRAL_API_KEY || "";
    this.model =
      opts?.model || process.env.MISTRAL_OCR_MODEL || "mistral-ocr-latest";
    this.endpoint =
      opts?.endpoint ||
      process.env.MISTRAL_OCR_ENDPOINT ||
      "https://api.mistral.ai/v1/ocr";
    if (!this.apiKey)
      throw new Error("MISTRAL_API_KEY is required for MistralOcrProvider");
  }

  async processPdfPages(input: {
    pdfBuffer: Buffer;
    pages: number[];
    hint?: string;
  }): Promise<OcrPageResult[]> {
    const body = {
      model: this.model,
      document: {
        type: "document_url", // سنستخدم data URL لتبسيط المثال
        document_url: toDataUrl(input.pdfBuffer, "application/pdf"),
      },
      pages: input.pages, // Mistral OCR API يدعم pages (0-based) للمعالجة الانتقائية :contentReference[oaicite:4]{index=4}
      extract_header: false, // مدعوم في endpoint docs :contentReference[oaicite:5]{index=5}
      extract_footer: false, // مدعوم في endpoint docs :contentReference[oaicite:6]{index=6}
      // يمكن لاحقًا استخدام document_annotation_prompt + JSON schema لو أردت structured output
    };

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Mistral OCR failed: ${res.status} ${txt}`);
    }

    const data = (await res.json()) as MistralOcrResponse;

    const out: OcrPageResult[] = [];
    for (const p of data.pages || []) {
      const page = p.index ?? -1;
      const text = (p.text ?? p.markdown ?? "").trim();
      out.push({
        page,
        text,
        lines: text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }

    return out;
  }
}

function toDataUrl(buf: Buffer, mime: string): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
}
