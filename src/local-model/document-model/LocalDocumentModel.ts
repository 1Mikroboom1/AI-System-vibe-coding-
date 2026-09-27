import fs from "fs";
import path from "path";
import {
  type LocalFieldDefinition,
  type LocalFieldResult,
  type LocalFieldType,
  type LocalTrainingSample,
  type PersistedLocalDocModel,
  type TrainingFile
} from "./types";

function isTextLikeMime(mime: string): boolean {
  return /^text\//i.test(mime) || /json|xml|yaml|csv|javascript|typescript|markdown|html/i.test(mime);
}

function normalizeFieldType(value: unknown): LocalFieldType {
  if (value === "number" || value === "date" || value === "email" || value === "phone" || value === "amount") {
    return value;
  }
  return "string";
}

function ensureValidField(value: unknown): LocalFieldDefinition | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LocalFieldDefinition>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    enabled: candidate.enabled !== false,
    type: normalizeFieldType(candidate.type),
    hint: typeof candidate.hint === "string" ? candidate.hint.trim() : undefined
  };
}

function ensureValidSample(value: unknown): LocalTrainingSample | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LocalTrainingSample>;
  if (typeof candidate.id !== "string") return null;
  if (typeof candidate.text !== "string") return null;
  if (typeof candidate.source !== "string") return null;
  if (typeof candidate.createdAt !== "string") return null;
  return {
    id: candidate.id,
    text: candidate.text,
    source: candidate.source,
    createdAt: candidate.createdAt,
    labels: candidate.labels && typeof candidate.labels === "object" ? candidate.labels : undefined
  };
}

export class LocalDocumentModel {
  private fields: LocalFieldDefinition[];

  private samples: LocalTrainingSample[];

  private updatedAt: string;

  constructor(initialFields?: LocalFieldDefinition[]) {
    this.fields = initialFields && initialFields.length
      ? initialFields
      : [
        { id: "doc-number", name: "Document Number", type: "string", enabled: true, hint: "№, Number" },
        { id: "doc-date", name: "Date", type: "date", enabled: true, hint: "Date, Issued" },
        { id: "amount", name: "Amount", type: "amount", enabled: true, hint: "Total, Amount" },
        { id: "email", name: "Email", type: "email", enabled: false, hint: "Email" }
      ];
    this.samples = [];
    this.updatedAt = new Date().toISOString();
  }

  getState() {
    return {
      model: "LocalDocModel-v1",
      fields: this.fields,
      samplesCount: this.samples.length,
      updatedAt: this.updatedAt
    };
  }

  setFields(fields: LocalFieldDefinition[]) {
    const next = fields
      .map((item) => ensureValidField(item))
      .filter(Boolean) as LocalFieldDefinition[];

    if (!next.length) {
      throw new Error("No valid fields provided");
    }

    this.fields = next;
    this.updatedAt = new Date().toISOString();
    return this.fields;
  }

  private extractTextFromFile(file: TrainingFile): string {
    if (!file.buffer || file.buffer.length === 0) return "";
    const mime = file.mimetype || "";
    if (!isTextLikeMime(mime)) return "";
    return file.buffer.toString("utf8").slice(0, 20000);
  }

  addSample(text: string, source: string, labels?: Record<string, string>) {
    const normalized = text.trim();
    if (!normalized) return false;

    this.samples.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: normalized,
      source,
      createdAt: new Date().toISOString(),
      labels
    });

    if (this.samples.length > 500) {
      this.samples = this.samples.slice(-500);
    }

    this.updatedAt = new Date().toISOString();
    return true;
  }

  train(payload: { text?: string; files?: TrainingFile[]; labels?: Record<string, string> }) {
    const files = Array.isArray(payload.files) ? payload.files : [];
    const labels = payload.labels;

    let added = 0;
    if (payload.text?.trim()) {
      if (this.addSample(payload.text, "manual-text", labels)) {
        added += 1;
      }
    }

    let skippedFiles = 0;
    for (const file of files) {
      const extracted = this.extractTextFromFile(file);
      if (!extracted) {
        skippedFiles += 1;
        continue;
      }
      if (this.addSample(extracted, `file:${file.originalname}`, labels)) {
        added += 1;
      }
    }

    return {
      addedSamples: added,
      skippedFiles,
      totalSamples: this.samples.length,
      updatedAt: this.updatedAt
    };
  }

  private findByType(text: string, field: LocalFieldDefinition): LocalFieldResult {
    const normalizedText = text || "";
    const emailMatch = normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = normalizedText.match(/(?:\+?\d[\d\s\-()]{8,}\d)/);
    const dateMatch = normalizedText.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/);
    const amountMatch = normalizedText.match(/\b(?:\d{1,3}(?:[\s,]\d{3})+|\d+)(?:[.,]\d{1,2})?\s?(?:руб\.?|₽|usd|eur|\$|€)?\b/i);
    const numberMatch = normalizedText.match(/\b\d+(?:[.,]\d+)?\b/);

    if (field.type === "email" && emailMatch) {
      return { fieldId: field.id, fieldName: field.name, type: field.type, value: emailMatch[0], confidence: 0.92, source: "regex" };
    }
    if (field.type === "phone" && phoneMatch) {
      return { fieldId: field.id, fieldName: field.name, type: field.type, value: phoneMatch[0], confidence: 0.86, source: "regex" };
    }
    if (field.type === "date" && dateMatch) {
      return { fieldId: field.id, fieldName: field.name, type: field.type, value: dateMatch[0], confidence: 0.84, source: "regex" };
    }
    if (field.type === "amount" && amountMatch) {
      return { fieldId: field.id, fieldName: field.name, type: field.type, value: amountMatch[0], confidence: 0.8, source: "regex" };
    }
    if (field.type === "number" && numberMatch) {
      return { fieldId: field.id, fieldName: field.name, type: field.type, value: numberMatch[0], confidence: 0.78, source: "regex" };
    }

    const hintTokens = [field.name, field.hint || ""]
      .join(",")
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean);

    const lines = normalizedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const token of hintTokens) {
      const tokenLower = token.toLowerCase();
      const foundLine = lines.find((line) => line.toLowerCase().includes(tokenLower));
      if (foundLine) {
        const value = foundLine.split(/[:\-]/).slice(1).join(":").trim() || foundLine;
        return { fieldId: field.id, fieldName: field.name, type: field.type, value, confidence: 0.68, source: "hint-line" };
      }
    }

    return { fieldId: field.id, fieldName: field.name, type: field.type, value: "", confidence: 0, source: "fallback" };
  }

  typize(text: string, fieldIds?: string[]) {
    const targetFields = Array.isArray(fieldIds) && fieldIds.length
      ? this.fields.filter((field) => fieldIds.includes(field.id))
      : this.fields.filter((field) => field.enabled);

    return targetFields.map((field) => this.findByType(text, field));
  }

  exportToDirectory(directoryPath: string) {
    const normalizedDir = path.resolve(directoryPath);
    fs.mkdirSync(normalizedDir, { recursive: true });

    const payload: PersistedLocalDocModel = {
      version: 1,
      updatedAt: this.updatedAt,
      fields: this.fields,
      samples: this.samples
    };

    const targetFile = path.join(normalizedDir, "local-doc-model.json");
    fs.writeFileSync(targetFile, JSON.stringify(payload, null, 2), "utf8");

    return {
      filePath: targetFile,
      fields: payload.fields.length,
      samples: payload.samples.length
    };
  }

  importFromDirectory(directoryPath: string) {
    const normalizedDir = path.resolve(directoryPath);
    const sourceFile = path.join(normalizedDir, "local-doc-model.json");

    if (!fs.existsSync(sourceFile)) {
      throw new Error("local-doc-model.json not found in selected directory");
    }

    const raw = fs.readFileSync(sourceFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersistedLocalDocModel>;

    const importedFields = Array.isArray(parsed.fields)
      ? parsed.fields.map((item) => ensureValidField(item)).filter(Boolean) as LocalFieldDefinition[]
      : [];

    if (!importedFields.length) {
      throw new Error("Imported model does not contain valid fields");
    }

    const importedSamples = Array.isArray(parsed.samples)
      ? parsed.samples.map((item) => ensureValidSample(item)).filter(Boolean) as LocalTrainingSample[]
      : [];

    this.fields = importedFields;
    this.samples = importedSamples.slice(-500);
    this.updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString();

    return {
      sourceFile,
      fields: this.fields.length,
      samples: this.samples.length,
      updatedAt: this.updatedAt
    };
  }
}
