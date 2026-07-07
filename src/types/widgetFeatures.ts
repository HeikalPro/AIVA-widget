import type {
  CalculatorProductSettings,
  CalculatorType,
  InstallmentTenor,
} from '@/utils/installmentCalculator'
import { INSTALLMENT_TENORS } from '@/utils/installmentCalculator'

export type WidgetCalculatorProductConfig = {
  apr?: number | null
  tenors?: number[] | null
  flat_rates?: Record<string, number> | null
}

export type WidgetInstallmentCalculatorConfig = {
  enabled: boolean
  types?: CalculatorType[]
  products?: Record<string, WidgetCalculatorProductConfig> | null
}

export type WidgetFeatures = {
  installment_calculator?: WidgetInstallmentCalculatorConfig
}

export type WidgetAccount = {
  id: number
  name: string
  widget_features?: WidgetFeatures | null
}

const ALL_CALCULATOR_TYPES: CalculatorType[] = ['cash-it', 'instant-approval', 'branches']

export function isInstallmentCalculatorEnabled(
  features: WidgetFeatures | null | undefined,
): boolean {
  return Boolean(features?.installment_calculator?.enabled)
}

export function installmentCalculatorTypes(
  features: WidgetFeatures | null | undefined,
): CalculatorType[] {
  if (!isInstallmentCalculatorEnabled(features)) return []
  const raw = features?.installment_calculator?.types
  if (!Array.isArray(raw) || raw.length === 0) return [...ALL_CALCULATOR_TYPES]
  const allowed = new Set(ALL_CALCULATOR_TYPES)
  const filtered = raw.filter((t): t is CalculatorType => allowed.has(t as CalculatorType))
  return filtered.length > 0 ? filtered : [...ALL_CALCULATOR_TYPES]
}

function normalizeTenors(raw: number[] | null | undefined): InstallmentTenor[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const allowed = new Set<InstallmentTenor>(INSTALLMENT_TENORS)
  const out = raw
    .map((month) => Number(month))
    .filter((month): month is InstallmentTenor => allowed.has(month as InstallmentTenor))
  return out.length > 0 ? out : undefined
}

function normalizeFlatRates(
  raw: Record<string, number> | null | undefined,
): Partial<Record<InstallmentTenor, number>> | undefined {
  if (!raw) return undefined
  const out: Partial<Record<InstallmentTenor, number>> = {}
  for (const month of INSTALLMENT_TENORS) {
    const rate = raw[String(month)]
    if (rate != null && Number.isFinite(rate) && rate > 0) {
      out[month] = rate
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function resolveCalculatorProductSettings(
  features: WidgetFeatures | null | undefined,
  type: CalculatorType,
): CalculatorProductSettings | undefined {
  const saved = features?.installment_calculator?.products?.[type]
  if (!saved) return undefined
  const settings: CalculatorProductSettings = {}
  if (saved.apr != null && Number.isFinite(saved.apr) && saved.apr > 0) {
    settings.apr = saved.apr
  }
  const tenors = normalizeTenors(saved.tenors)
  if (tenors) settings.tenors = tenors
  const flatRates = normalizeFlatRates(saved.flat_rates ?? undefined)
  if (flatRates) settings.flatRates = flatRates
  return Object.keys(settings).length > 0 ? settings : undefined
}

export function buildCalculatorProductSettingsMap(
  features: WidgetFeatures | null | undefined,
): Partial<Record<CalculatorType, CalculatorProductSettings>> {
  const types = installmentCalculatorTypes(features)
  const out: Partial<Record<CalculatorType, CalculatorProductSettings>> = {}
  for (const type of types) {
    const settings = resolveCalculatorProductSettings(features, type)
    if (settings) out[type] = settings
  }
  return out
}
