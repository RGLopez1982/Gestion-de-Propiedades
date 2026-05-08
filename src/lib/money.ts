export const parseMoneyInput = (value: string | number | undefined | null) => {
  if (value === undefined || value === null || value === '') return 0;
  const normalized = String(value).trim().replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
};

export const formatMoney = (value: number) => `$${Math.round(Number(value || 0)).toFixed(2)}`;
