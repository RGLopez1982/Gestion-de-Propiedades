const UPPERCASE_EXCLUDED_FIELDS = new Set([
  'date',
  'checkIn',
  'checkOut',
  'since',
  'guests',
  'amount',
  'amountTotal',
  'amountPaid',
  'nightlyRate',
  'capacity',
  'refundIssued',
  'refundAmount',
  'receiptFiles',
  'images',
  'status',
  'type',
  'paidBy',
  'paymentMethod',
  'bookingSource',
]);

export const normalizeTextInput = (name: string, value: string) => {
  if (UPPERCASE_EXCLUDED_FIELDS.has(name)) return value;
  return value.toLocaleUpperCase('es-AR');
};

export const uppercaseText = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.trim().toLocaleUpperCase('es-AR');
};
