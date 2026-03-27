export interface TextValidationOptions {
  fieldName: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  trim?: boolean;
}

export interface NumericValidationOptions {
  fieldName: string;
  required?: boolean;
  min?: number;
  max?: number;
  maxDecimals?: number;
  integer?: boolean;
}

export interface DateTimeValidationOptions {
  fieldName: string;
  required?: boolean;
  mustBeFuture?: boolean;
  before?: Date | string | null;
  beforeLabel?: string;
  after?: Date | string | null;
  afterLabel?: string;
}

export function normalizeValidationText(value: unknown) {
  return String(value ?? "");
}

export function collapseValidationWhitespace(value: unknown) {
  return normalizeValidationText(value).replace(/\s+/g, " ").trim();
}

export function countDecimalPlaces(value: string) {
  const normalized = value.trim();
  if (!normalized.includes(".")) {
    return 0;
  }

  return normalized.split(".")[1]?.length ?? 0;
}

export function validateTextInput(
  value: unknown,
  {
    fieldName,
    required = false,
    minLength,
    maxLength,
    trim = true,
  }: TextValidationOptions
) {
  const raw = normalizeValidationText(value);
  const normalized = trim ? collapseValidationWhitespace(raw) : raw;

  if (!normalized) {
    return required ? `${fieldName} is required` : null;
  }

  if (typeof minLength === "number" && normalized.length < minLength) {
    return `${fieldName} must be at least ${minLength} characters`;
  }

  if (typeof maxLength === "number" && normalized.length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or fewer`;
  }

  return null;
}

export function validateNumericInputString(
  value: unknown,
  {
    fieldName,
    required = false,
    min,
    max,
    maxDecimals,
    integer = false,
  }: NumericValidationOptions
) {
  const normalized = normalizeValidationText(value).trim();

  if (!normalized) {
    return required ? `${fieldName} is required` : null;
  }

  const numericPattern = /^[-+]?(\d+(\.\d+)?|\.\d+)$/;
  if (!numericPattern.test(normalized)) {
    return integer ? `${fieldName} must be a whole number` : `${fieldName} must be a number`;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return `${fieldName} must be a number`;
  }

  if (integer && !Number.isInteger(parsed)) {
    return `${fieldName} must be a whole number`;
  }

  if (typeof maxDecimals === "number" && countDecimalPlaces(normalized) > maxDecimals) {
    return `${fieldName} must have at most ${maxDecimals} decimal places`;
  }

  if (typeof min === "number" && typeof max === "number" && (parsed < min || parsed > max)) {
    return `${fieldName} must be between ${min} and ${max}`;
  }

  if (typeof min === "number" && parsed < min) {
    return `${fieldName} must be at least ${min}`;
  }

  if (typeof max === "number" && parsed > max) {
    return `${fieldName} must be at most ${max}`;
  }

  return null;
}

export function parseNumericInput(value: unknown) {
  const normalized = normalizeValidationText(value).trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseComparisonDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateDateTimeInput(
  value: unknown,
  {
    fieldName,
    required = false,
    mustBeFuture = false,
    before,
    beforeLabel,
    after,
    afterLabel,
  }: DateTimeValidationOptions
) {
  const normalized = normalizeValidationText(value).trim();
  if (!normalized) {
    return required ? `${fieldName} is required` : null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return `${fieldName} must be a valid date`;
  }

  if (mustBeFuture && parsed.getTime() <= Date.now()) {
    return `${fieldName} must be in the future`;
  }

  const beforeDate = parseComparisonDate(before);
  if (beforeDate && parsed.getTime() >= beforeDate.getTime()) {
    return `${fieldName} must be before ${beforeLabel ?? "the selected date"}`;
  }

  const afterDate = parseComparisonDate(after);
  if (afterDate && parsed.getTime() <= afterDate.getTime()) {
    return `${fieldName} must be after ${afterLabel ?? "the selected date"}`;
  }

  return null;
}

export function countValidationMessages(messages: Array<string | null | undefined>) {
  return messages.reduce((count, message) => (message ? count + 1 : count), 0);
}
