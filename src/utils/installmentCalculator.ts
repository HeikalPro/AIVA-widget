export type CalculatorType = 'cash-it' | 'instant-approval' | 'branches'

export const INSTALLMENT_TENORS = [6, 9, 12, 18, 24, 30, 36] as const

export type InstallmentTenor = (typeof INSTALLMENT_TENORS)[number]

export type InstallmentRow = {
  months: InstallmentTenor
  installment: number
  totalInterest: number
  monthlyFlatRate: number
}

const INSTANT_APPROVAL_FLAT_RATES: Record<InstallmentTenor, number> = {
  6: 0.0314,
  9: 0.0285,
  12: 0.0248,
  18: 0.0251,
  24: 0.025,
  30: 0.0305,
  36: 0.0327,
}

const APR_BY_TYPE: Record<Exclude<CalculatorType, 'instant-approval'>, number> = {
  'cash-it': 0.55,
  branches: 0.52,
}

function amortizedInstallment(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 12
  if (monthlyRate === 0) return Math.round(principal / months)
  const factor = Math.pow(1 + monthlyRate, months)
  const payment = (principal * monthlyRate * factor) / (factor - 1)
  return Math.round(payment)
}

function flatRateInstallment(
  principal: number,
  monthlyFlatRate: number,
  months: number,
): Pick<InstallmentRow, 'installment' | 'totalInterest'> {
  const totalInterest = Math.round(principal * monthlyFlatRate * months)
  const installment = Math.round((principal + totalInterest) / months)
  return { installment, totalInterest }
}

function decliningBalanceRow(
  principal: number,
  annualRate: number,
  months: InstallmentTenor,
): InstallmentRow {
  const installment = amortizedInstallment(principal, annualRate, months)
  const totalInterest = installment * months - principal
  const monthlyFlatRate = Math.round((totalInterest / (principal * months)) * 10_000) / 100
  return { months, installment, totalInterest, monthlyFlatRate }
}

function instantApprovalRow(principal: number, months: InstallmentTenor): InstallmentRow {
  const monthlyFlatRate = INSTANT_APPROVAL_FLAT_RATES[months] * 100
  const { installment, totalInterest } = flatRateInstallment(
    principal,
    INSTANT_APPROVAL_FLAT_RATES[months],
    months,
  )
  return { months, installment, totalInterest, monthlyFlatRate }
}

export function calculateInstallmentPlan(
  type: CalculatorType,
  principal: number,
): InstallmentRow[] {
  if (!Number.isFinite(principal) || principal <= 0) return []

  if (type === 'instant-approval') {
    return INSTALLMENT_TENORS.map((months) => instantApprovalRow(principal, months))
  }

  const annualRate = APR_BY_TYPE[type]
  return INSTALLMENT_TENORS.map((months) => decliningBalanceRow(principal, annualRate, months))
}

export function parsePrincipalInput(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

export function formatEgp(amount: number): string {
  return amount.toLocaleString('en-US')
}

export function formatFlatRate(rate: number): string {
  return `${rate.toFixed(2)}%`
}

export const CALCULATOR_LABELS: Record<CalculatorType, string> = {
  'cash-it': 'Cash it',
  'instant-approval': 'Instant Approval',
  branches: 'Branches',
}
