export const formatDateDisplay = (value?: string | null) => {
  if (!value) return 'Sin fecha';

  const trimmed = value.trim();

  const yearFirstMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yearFirstMatch) {
    const [, year, month, day] = yearFirstMatch;
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
  }

  const dayFirstMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
  }

  return trimmed;
};
