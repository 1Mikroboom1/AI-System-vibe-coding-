export type LocalFieldType = "string" | "number" | "date" | "email" | "phone" | "amount";

export type LocalFieldDefinition = {
  id: string;
  name: string;
  type: LocalFieldType;
  enabled: boolean;
  hint?: string;
};

export type LocalTrainingSample = {
  id: string;
  text: string;
  source: string;
  createdAt: string;
  labels?: Record<string, string>;
};

export type LocalFieldResult = {
  fieldId: string;
  fieldName: string;
  type: LocalFieldType;
  value: string;
  confidence: number;
  source: "regex" | "hint-line" | "fallback";
};

export type PersistedLocalDocModel = {
  version: number;
  updatedAt: string;
  fields: LocalFieldDefinition[];
  samples: LocalTrainingSample[];
};

export type TrainingFile = {
  originalname: string;
  mimetype?: string;
  size: number;
  buffer?: Buffer;
};
