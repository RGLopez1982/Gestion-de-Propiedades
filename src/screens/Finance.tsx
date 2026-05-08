import React, { useState, useEffect } from 'react';
import {
  TrendingUp, 
  Download, 
  Plus, 
  ChevronDown, 
  Building,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  CreditCard,
  Banknote,
  Share2,
  AlertCircle,
  History,
  Pencil,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Booking, closeFinanceCycle, deleteTransaction, FinanceCycle, getBookings, getFinanceCycles, getProperties, getTransactions, Property, Transaction } from '../services/api';
import { useModal } from '../hooks/useModal';
import { Modal } from '../components/Modal';
import { TransactionForm } from '../components/forms/TransactionForm';
import { formatDateDisplay } from '../lib/dates';
import { formatMoney } from '../lib/money';

const OWNERS = ['Diego', 'Maru', 'Laura'];
const sameOwner = (value: string | undefined, owner: string) => value?.trim().toUpperCase() === owner.toUpperCase();

type OwnerSettlement = {
  owner: string;
  expensesPaid: number;
  profitShare: number;
  payout: number;
};

type SettlementReport = {
  title: string;
  periodLabel: string;
  income: number;
  expense: number;
  balance: number;
  ownerRows: OwnerSettlement[];
  paymentEntries: [string, number][];
  expenseRows: Transaction[];
};

type ClosedCycle = SettlementReport & {
  id: number;
  closedAt: string;
  transactionCount: number;
};

export default function Finance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [cycles, setCycles] = useState<FinanceCycle[]>([]);
  const [periodFilter, setPeriodFilter] = useState('cycle');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [withdrawError, setWithdrawError] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const modal = useModal();

  const loadData = async () => {
    try {
      const [transactionData, propertyData, bookingData, cycleData] = await Promise.all([
        getTransactions(),
        getProperties(),
        getBookings(),
        getFinanceCycles(),
      ]);
      setTransactions(transactionData);
      setProperties(propertyData);
      setBookings(bookingData);
      setCycles(cycleData);
    } catch (error) {
      console.error('Error loading finance data:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleTransactionSaved = (transaction: Transaction) => {
    setTransactions(prev => {
      const exists = prev.some((item) => item.id === transaction.id);
      return exists
        ? prev.map((item) => item.id === transaction.id ? transaction : item)
        : [transaction, ...prev];
    });
    setEditingTransaction(null);
    modal.close();
  };

  const isWithdrawal = (transaction: Transaction) => transaction.concept.toLowerCase().startsWith('cobro de fondos');
  const canEditManualTransaction = (transaction: Transaction) => Number(transaction.id) > 0 && !transaction.booking_id && !isWithdrawal(transaction);
  const openCreateTransaction = () => {
    setEditingTransaction(null);
    modal.open();
  };
  const openEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    modal.open();
  };
  const closeTransactionModal = () => {
    setEditingTransaction(null);
    modal.close();
  };
  const requestDeleteTransaction = (transaction: Transaction) => {
    setDeleteError('');
    setDeleteTarget(transaction);
  };
  const confirmDeleteTransaction = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setDeleteError('');
      await deleteTransaction(deleteTarget.id);
      setTransactions(prev => prev.filter((transaction) => transaction.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el movimiento');
    } finally {
      setDeleting(false);
    }
  };
  const getTransactionOrder = (transaction: Transaction) => Number(transaction.id || 0);
  const getCycleIncome = (items: Transaction[]) => items
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const getCycleExpense = (items: Transaction[]) => items
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const getOwnerSettlements = (items: Transaction[]): OwnerSettlement[] => {
    const income = getCycleIncome(items);
    const expense = getCycleExpense(items);
    const baseShare = OWNERS.length > 0 ? (income - expense) / OWNERS.length : 0;

    return OWNERS.map((owner) => {
      const expensesPaid = items
        .filter((transaction) => transaction.type === 'expense' && sameOwner(transaction.paidBy, owner))
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

      return {
        owner,
        expensesPaid,
        profitShare: baseShare,
        payout: baseShare + expensesPaid,
      };
    });
  };
  const getPaymentMethodTotals = (items: Transaction[]) => items
    .filter((transaction) => transaction.type === 'income')
    .reduce<Record<string, number>>((acc, transaction) => {
      const method = transaction.paymentMethod?.trim() || 'Sin especificar';
      acc[method] = (acc[method] || 0) + Number(transaction.amount || 0);
      return acc;
    }, {});
  const bookingPaymentTransactions: Transaction[] = bookings
    .filter((booking) => Number(booking.amountPaid || 0) > 0)
    .filter((booking) => !transactions.some((transaction) => Number(transaction.booking_id) === booking.id))
    .map((booking) => ({
      id: -booking.id,
      date: booking.createdAt?.slice(0, 10) || booking.checkIn,
      concept: booking.status === 'Pendiente'
        ? `Pago parcial reserva - ${booking.tenant}`
        : booking.status === 'Cancelado'
          ? `Pago reserva cancelada - ${booking.tenant}`
          : `Reserva confirmada - ${booking.tenant}`,
      property_id: booking.property_id,
      booking_id: booking.id,
      amount: Number(booking.amountPaid || 0),
      status: 'Completado',
      type: 'income',
      paymentMethod: booking.paymentMethod || undefined,
      property: booking.property,
    }));
  const financeTransactions = [...transactions, ...bookingPaymentTransactions];

  const withdrawalTransactions = financeTransactions
    .filter(isWithdrawal)
    .sort((a, b) => getTransactionOrder(b) - getTransactionOrder(a));
  const lastWithdrawal = withdrawalTransactions[0];
  const isCurrentCycleTransaction = (transaction: Transaction) => {
    if (!lastWithdrawal) return true;
    return getTransactionOrder(transaction) > getTransactionOrder(lastWithdrawal);
  };
  const currentCycleTransactions = financeTransactions.filter((transaction) => isCurrentCycleTransaction(transaction) && !isWithdrawal(transaction));
  const currentCycleIncome = currentCycleTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const currentCycleExpense = currentCycleTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const currentCycleBalance = currentCycleIncome - currentCycleExpense;
  const currentCycleExpenseTransactions = currentCycleTransactions.filter((transaction) => transaction.type === 'expense');
  const ownerSettlements = getOwnerSettlements(currentCycleTransactions);
  const ownerBaseShare = OWNERS.length > 0 ? currentCycleBalance / OWNERS.length : 0;
  const paymentMethodTotals = getPaymentMethodTotals(currentCycleTransactions);
  const closedCycles: ClosedCycle[] = cycles.map((cycle) => ({
    id: cycle.id,
    title: `Cierre del ${formatDateDisplay(cycle.closedAt)}`,
    periodLabel: cycle.periodLabel,
    closedAt: cycle.closedAt,
    income: cycle.income,
    expense: cycle.expense,
    balance: cycle.balance,
    ownerRows: cycle.ownerSettlements,
    paymentEntries: cycle.paymentTotals.map((item) => [item.method, item.amount]),
    expenseRows: cycle.expenseRows.map((item, index) => ({
      id: -cycle.id * 1000 - index,
      date: cycle.closedAt,
      concept: item.concept,
      amount: item.amount,
      status: 'Completado',
      type: 'expense',
      paidBy: item.paidBy,
    })),
    transactionCount: cycle.transactionCount,
  }));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const filteredTransactions = financeTransactions.filter((transaction) => {
    const matchesPeriod = periodFilter === 'all'
      || (periodFilter === 'cycle' ? isCurrentCycleTransaction(transaction) && !isWithdrawal(transaction) : transaction.date.startsWith(periodFilter));
    const matchesProperty = propertyFilter === 'all' || String(transaction.property_id || '') === propertyFilter;
    return matchesPeriod && matchesProperty;
  });

  const getMovementStatus = (transaction: Transaction) => {
    if (isWithdrawal(transaction)) return 'Cobrado';
    if (transaction.concept.toLowerCase().startsWith('pago parcial')) return 'Adelanto recibido';
    if (transaction.concept.toLowerCase().startsWith('reserva confirmada')) return 'Pago total recibido';
    if (transaction.type === 'expense') return 'Gasto registrado';
    return 'Ingreso registrado';
  };

  // Calculate summaries
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const balance = totalIncome - totalExpense;
  const withdrawableBalance = currentCycleBalance;
  const pendingPaymentBookings = bookings.filter((booking) => {
    if (booking.status === 'Cancelado') return false;
    const total = Math.round(Number(booking.amountTotal || 0));
    const paid = Math.round(Number(booking.amountPaid || 0));
    return total > 0 && paid < total;
  });
  const canWithdraw = withdrawableBalance > 0 && pendingPaymentBookings.length === 0;

  const operationalExpenses = filteredTransactions.filter((transaction) => transaction.type === 'expense' && !isWithdrawal(transaction));
  const totalOperationalExpenses = operationalExpenses.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const summaries = [
    { label: periodFilter === 'cycle' ? 'Balance del ciclo' : 'Balance filtrado', value: `$${balance.toFixed(2)}`, trend: filteredTransactions.length > 0 ? 'Datos reales' : 'Sin movimientos', icon: TrendingUp, color: 'text-primary' },
    { label: periodFilter === 'cycle' ? 'Ingresos del ciclo' : 'Ingresos filtrados', value: `$${totalIncome.toFixed(2)}`, sub: `${filteredTransactions.filter(t => t.type === 'income').length} ingresos registrados`, icon: ArrowUpRight, color: 'text-secondary' },
    { label: periodFilter === 'cycle' ? 'Egresos del ciclo' : 'Egresos filtrados', value: `-$${Math.abs(totalExpense).toFixed(2)}`, sub: `${filteredTransactions.filter(t => t.type === 'expense').length} egresos registrados`, icon: ArrowDownRight, color: 'text-error' },
  ];

  const distributions = operationalExpenses.length > 0
    ? [{ label: 'Gastos operativos', percentage: 100, amount: totalOperationalExpenses, color: 'bg-primary' }]
    : [];

  const handleWithdraw = async () => {
    if (!canWithdraw) return;

    try {
      setWithdrawError('');
      const result = await closeFinanceCycle();
      setTransactions(prev => [result.transaction, ...prev]);
      setCycles(prev => [result.cycle, ...prev]);
    } catch (error) {
      console.error('Error creating withdrawal:', error);
      setWithdrawError(error instanceof Error ? error.message : 'No se pudo cerrar el ciclo');
    }
  };

  const handleExport = () => {
    const escapeHtml = (value: string | number) => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

    const exportDate = new Date().toISOString().split('T')[0];
    const periodLabel = periodFilter === 'all'
      ? 'Todos los periodos'
      : periodFilter === 'cycle'
        ? 'Ciclo actual'
        : `Mes ${periodFilter}`;
    const propertyLabel = propertyFilter === 'all'
      ? 'Todos los departamentos'
      : properties.find((property) => String(property.id) === propertyFilter)?.department || 'Departamento filtrado';
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.concept.localeCompare(b.concept);
    });

    const rows = sortedTransactions.map((transaction) => {
      const signedAmount = transaction.type === 'income'
        ? transaction.amount
        : -Math.abs(transaction.amount);
      const moneyClass = transaction.type === 'income' ? 'money income' : 'money expense';

      return `
        <tr>
          <td>${escapeHtml(formatDateDisplay(transaction.date))}</td>
          <td>${escapeHtml(transaction.concept)}</td>
          <td>${escapeHtml(transaction.property || 'Sin departamento')}</td>
          <td>${escapeHtml(transaction.type === 'income' ? 'Ingreso' : 'Egreso')}</td>
          <td>${escapeHtml(transaction.paymentMethod || '-')}</td>
          <td>${escapeHtml(transaction.paidBy || '-')}</td>
          <td class="${moneyClass}">${signedAmount.toFixed(2)}</td>
          <td>${escapeHtml(getMovementStatus(transaction))}</td>
        </tr>
      `;
    }).join('');

    const workbook = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="UTF-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Finanzas</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines /></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: Arial, sans-serif; color: #0f1f33; }
            h1 { color: #00355f; font-size: 24px; margin: 0 0 6px; }
            h2 { color: #00355f; font-size: 16px; margin: 24px 0 8px; }
            .meta { color: #5f6673; margin: 0 0 18px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
            th { background: #00355f; color: #ffffff; font-weight: bold; border: 1px solid #9aa7b8; padding: 9px; text-align: left; }
            td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
            .label { background: #eef4fb; font-weight: bold; color: #00355f; }
            .money { mso-number-format: "\\#\\,\\#\\#0.00"; text-align: right; font-weight: bold; }
            .income { color: #007a53; }
            .expense { color: #b01818; }
            .balance { color: #00355f; }
            .empty { text-align: center; color: #5f6673; font-style: italic; }
            .transactions tr:nth-child(even) td { background: #f7faff; }
          </style>
        </head>
        <body>
          <h1>Reporte de Finanzas</h1>
          <p class="meta">Exportado el ${escapeHtml(formatDateDisplay(exportDate))}</p>

          <table>
            <tbody>
              <tr>
                <td class="label">Periodo</td>
                <td>${escapeHtml(periodLabel)}</td>
                <td class="label">Departamento</td>
                <td>${escapeHtml(propertyLabel)}</td>
              </tr>
              <tr>
                <td class="label">Total ingresos</td>
                <td class="money income">${totalIncome.toFixed(2)}</td>
                <td class="label">Total egresos</td>
                <td class="money expense">${(-Math.abs(totalExpense)).toFixed(2)}</td>
              </tr>
              <tr>
                <td class="label">Balance</td>
                <td class="money balance">${balance.toFixed(2)}</td>
                <td class="label">Movimientos exportados</td>
                <td>${sortedTransactions.length}</td>
              </tr>
            </tbody>
          </table>

          <h2>Detalle de movimientos</h2>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Departamento</th>
                <th>Tipo</th>
                <th>Medio de pago</th>
                <th>Pago gasto</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody class="transactions">
              ${rows || '<tr><td class="empty" colspan="8">No hay movimientos para los filtros seleccionados.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-finanzas-${exportDate}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createSettlementImageBlob = async (report: SettlementReport) => {
    const escapeXml = (value: string | number) => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

    let y = 372;
    const ownerSvg = report.ownerRows.map((item) => {
      const row = `
        <rect x="80" y="${y}" width="920" height="104" rx="16" fill="#f8fbff"/>
        <text x="112" y="${y + 34}" class="owner">${escapeXml(item.owner)}</text>
        <text x="960" y="${y + 32}" text-anchor="end" class="payout">${escapeXml(formatMoney(item.payout))}</text>
        <text x="112" y="${y + 76}" class="muted">Ganancia base: ${escapeXml(formatMoney(item.profitShare))}</text>
        <text x="510" y="${y + 76}" class="muted">Gastos que pago: ${escapeXml(formatMoney(item.expensesPaid))}</text>
      `;
      y += 122;
      return row;
    }).join('');

    y += 36;
    const paymentTitleY = y;
    y += 58;
    const paymentSvg = report.paymentEntries.length > 0
      ? report.paymentEntries.map(([method, amount]) => {
        const row = `
          <text x="112" y="${y}" class="line-label">${escapeXml(method)}</text>
          <text x="950" y="${y}" text-anchor="end" class="income">${escapeXml(formatMoney(amount))}</text>
        `;
        y += 48;
        return row;
      }).join('')
      : (() => {
        const row = `<text x="112" y="${y}" class="muted-big">No hay ingresos registrados en este ciclo.</text>`;
        y += 52;
        return row;
      })();

    y += 38;
    const expensesTitleY = y;
    y += 58;
    const expensesSvg = report.expenseRows.length > 0
      ? report.expenseRows.map((transaction) => {
        const concept = transaction.concept.length > 44 ? `${transaction.concept.slice(0, 41)}...` : transaction.concept;
        const row = `
          <text x="112" y="${y}" class="line-label">${escapeXml(concept)}</text>
          <text x="112" y="${y + 30}" class="muted-small">Pago: ${escapeXml(transaction.paidBy || 'Sin asignar')}</text>
          <text x="950" y="${y}" text-anchor="end" class="expense">${escapeXml(formatMoney(Math.abs(transaction.amount)))}</text>
        `;
        y += 66;
        return row;
      }).join('')
      : (() => {
        const row = `<text x="112" y="${y}" class="muted-big">No hay gastos registrados en este ciclo.</text>`;
        y += 52;
        return row;
      })();

    const height = Math.max(1240, y + 160);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}">
        <style>
          .title { font: 700 46px Arial, sans-serif; fill: #00355f; }
          .subtitle { font: 500 24px Arial, sans-serif; fill: #5f6673; }
          .section { font: 700 30px Arial, sans-serif; fill: #00355f; }
          .metric-label { font: 700 18px Arial, sans-serif; fill: #5f6673; }
          .metric-value { font: 700 34px Arial, sans-serif; }
          .owner { font: 700 29px Arial, sans-serif; fill: #0f1f33; }
          .payout { font: 700 33px Arial, sans-serif; fill: #00355f; }
          .muted { font: 500 20px Arial, sans-serif; fill: #5f6673; }
          .muted-small { font: 500 20px Arial, sans-serif; fill: #5f6673; }
          .muted-big { font: 500 24px Arial, sans-serif; fill: #5f6673; }
          .line-label { font: 700 26px Arial, sans-serif; fill: #0f1f33; }
          .income { font: 700 26px Arial, sans-serif; fill: #007a53; }
          .expense { font: 700 26px Arial, sans-serif; fill: #b01818; }
        </style>
        <rect width="1080" height="${height}" fill="#f4f7fb"/>
        <rect x="40" y="40" width="1000" height="${height - 80}" rx="24" fill="#ffffff"/>

        <text x="80" y="92" class="title">${escapeXml(report.title)}</text>
        <text x="80" y="142" class="subtitle">${escapeXml(report.periodLabel)}</text>

        <rect x="80" y="196" width="292" height="108" rx="16" fill="#eef4fb"/>
        <text x="102" y="226" class="metric-label">Ingresos</text>
        <text x="102" y="266" class="metric-value" fill="#007a53">${escapeXml(formatMoney(report.income))}</text>

        <rect x="394" y="196" width="292" height="108" rx="16" fill="#eef4fb"/>
        <text x="416" y="226" class="metric-label">Gastos</text>
        <text x="416" y="266" class="metric-value" fill="#b01818">${escapeXml(formatMoney(report.expense))}</text>

        <rect x="708" y="196" width="292" height="108" rx="16" fill="#eef4fb"/>
        <text x="730" y="226" class="metric-label">Ganancia neta</text>
        <text x="730" y="266" class="metric-value" fill="#00355f">${escapeXml(formatMoney(report.balance))}</text>

        <text x="80" y="348" class="section">A cobrar por cada dueno</text>
        ${ownerSvg}

        <text x="80" y="${paymentTitleY}" class="section">Ingresos por medio de pago</text>
        ${paymentSvg}

        <text x="80" y="${expensesTitleY}" class="section">Detalle de gastos del ciclo</text>
        ${expensesSvg}

        <text x="100" y="${height - 92}" class="muted">Detalle generado desde Gestion de Propiedades.</text>
      </svg>
    `;

    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(svgUrl);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
    return blob;
  };

  const downloadOrShareSettlementImage = async (report: SettlementReport, filePrefix: string) => {
    const blob = await createSettlementImageBlob(report);
    if (!blob) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = new File([blob], `${filePrefix}-${stamp}.png`, { type: 'image/png' });
    const canShareFile = navigator.canShare?.({ files: [file] });

    if (canShareFile && navigator.share) {
      await navigator.share({
        title: report.title,
        text: 'Detalle de ganancias, gastos y reparto.',
        files: [file],
      });
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleShareSettlementImage = async () => {
    const exportDate = formatDateDisplay(new Date().toISOString().split('T')[0]);
    const periodLabel = periodFilter === 'cycle' ? 'Ciclo actual' : periodFilter === 'all' ? 'Todos los periodos' : `Mes ${periodFilter}`;

    await downloadOrShareSettlementImage({
      title: 'Reparto del ciclo',
      periodLabel: `${periodLabel} - ${exportDate}`,
      income: currentCycleIncome,
      expense: currentCycleExpense,
      balance: currentCycleBalance,
      ownerRows: ownerSettlements,
      paymentEntries: Object.entries(paymentMethodTotals),
      expenseRows: currentCycleExpenseTransactions,
    }, 'reparto-ciclo');
  };

  const handleShareClosedCycleImage = async (cycle: ClosedCycle) => {
    await downloadOrShareSettlementImage(cycle, `historial-ciclo-${cycle.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-8">
      {/* Overview Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {summaries.map((stat, idx) => (
          <div key={idx} className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <p className="text-[10px] font-bold text-outline uppercase tracking-widest mb-2">{stat.label}</p>
            <h2 className={cn("font-display text-2xl md:text-3xl font-bold", stat.color)}>{stat.value}</h2>
            <div className="mt-2 flex items-center gap-1.5">
              {stat.trend ? (
                <div className="flex items-center gap-1 text-secondary font-bold text-xs">
                  <stat.icon className="w-3.5 h-3.5" />
                  <span>{stat.trend}</span>
                </div>
              ) : (
                <p className="text-xs text-outline font-medium">{stat.sub}</p>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Filters & Actions */}
      <section className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative group">
            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value)}
              className="appearance-none bg-white border border-outline-variant/30 pl-4 pr-10 py-2 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[160px]"
            >
              <option value="cycle">Ciclo actual</option>
              <option value={currentMonth}>Mes actual</option>
              <option value="all">Todos los periodos</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none group-hover:text-primary transition-colors" />
          </div>
          <div className="relative group">
            <select
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
              className="appearance-none bg-white border border-outline-variant/30 pl-10 pr-10 py-2 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[240px]"
            >
              <option value="all">Todos los departamentos</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.department || property.location || property.name}
                </option>
              ))}
            </select>
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none group-hover:text-primary transition-colors" />
          </div>
        </div>
        
        <div className="flex gap-3 w-full lg:w-auto">
          <button
            onClick={handleShareSettlementImage}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 border border-secondary text-secondary px-5 py-2 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Reparto PNG
          </button>
          <button
            onClick={handleExport}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 border border-primary text-primary px-5 py-2 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button 
            onClick={openCreateTransaction}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-primary text-white px-5 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nuevo Gasto
          </button>
        </div>
      </section>

      {/* Modal */}
      <Modal 
        isOpen={modal.isOpen} 
        onClose={closeTransactionModal} 
        title={editingTransaction ? 'Editar transaccion' : 'Registrar transaccion'}
        size="md"
      >
        <TransactionForm 
          transaction={editingTransaction}
          onSuccess={handleTransactionSaved}
          onCancel={closeTransactionModal}
        />
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar movimiento"
        size="sm"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 bg-error-container text-on-error-container rounded-lg text-sm">
              {deleteError}
            </div>
          )}
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Vas a eliminar el movimiento <strong className="text-on-surface">{deleteTarget?.concept}</strong>. Si fue un gasto cargado por error, se quitara del ciclo actual y del reparto.
          </p>
          <div className="rounded-lg bg-surface-container-low p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-outline font-bold">Monto</span>
              <span className="font-bold text-on-surface">{deleteTarget ? formatMoney(Math.abs(deleteTarget.amount)) : '-'}</span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-outline font-bold">Fecha</span>
              <span className="font-bold text-on-surface">{deleteTarget ? formatDateDisplay(deleteTarget.date) : '-'}</span>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex-1 px-4 py-2 border border-outline-variant/30 rounded-lg text-on-surface font-bold hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDeleteTransaction}
              disabled={deleting}
              className="flex-1 px-4 py-2 bg-error text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </Modal>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Transactions Table */}
        <div className="lg:col-span-8 bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-surface-container flex justify-between items-center">
            <h3 className="font-display font-bold text-primary">Transacciones Recientes</h3>
            <span className="text-xs text-outline font-medium">Mostrando {filteredTransactions.length} transacciones</span>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-on-surface-variant">No hay transacciones registradas</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low text-[10px] font-bold text-outline uppercase tracking-widest border-b border-surface-container">
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4">Concepto</th>
                      <th className="px-6 py-4">Propiedad</th>
                      <th className="px-6 py-4 text-right">Monto</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(0, 15).map((t, idx) => (
                      <tr key={idx} className="zebra-stripe border-b border-surface-container/30 last:border-0 hover:bg-active transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-on-surface">{formatDateDisplay(t.date)}</td>
                        <td className="px-6 py-4 text-xs text-on-surface">
                          <p className="font-bold">{t.concept}</p>
                          {(t.paymentMethod || t.paidBy) && (
                            <p className="mt-1 text-[10px] font-semibold text-outline">
                              {[t.paymentMethod && `Medio: ${t.paymentMethod}`, t.paidBy && `Pago: ${t.paidBy}`].filter(Boolean).join(' - ')}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-outline">{t.property || '-'}</td>
                        <td className={cn("px-6 py-4 text-xs font-bold text-right", t.type === 'income' ? 'text-secondary' : 'text-error')}>
                          {t.type === 'income' ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight",
                              t.type === 'income' ? "bg-secondary-container/20 text-on-secondary-container" : "bg-tertiary-container/10 text-on-tertiary-container"
                            )}>
                              {getMovementStatus(t)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {canEditManualTransaction(t) ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditTransaction(t)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-outline-variant/30 text-primary hover:bg-surface-container transition-colors"
                                title="Editar movimiento"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => requestDeleteTransaction(t)}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-outline-variant/30 text-error hover:bg-error-container/40 transition-colors"
                                title="Eliminar movimiento"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="block text-center text-xs text-outline">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-white text-center border-t border-surface-container">
                <button className="text-primary font-bold text-xs hover:underline">Ver todo el historial ({filteredTransactions.length} transacciones)</button>
              </div>
            </>
          )}
        </div>

        {/* Sidebar Analytics */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Owner Expenses */}
          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-bold text-primary mb-6">Distribución de Gastos</h3>
            <div className="space-y-6">
              {distributions.map((d, id) => (
                <div key={id} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-on-surface">{d.label}</span>
                    <span className="text-primary">${d.amount.toFixed(2)} · {d.percentage}%</span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all duration-1000", d.color)} style={{ width: `${d.percentage}%` }} />
                  </div>
                </div>
              ))}
              {distributions.length === 0 && (
                <p className="text-sm text-on-surface-variant">Todavia no hay gastos operativos registrados.</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-bold text-primary mb-4">Reparto del ciclo</h3>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="rounded-lg bg-surface-container-low p-3">
                <p className="text-[10px] font-bold uppercase text-outline">Ganancia neta</p>
                <p className="font-display text-xl font-bold text-primary">${currentCycleBalance.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-surface-container-low p-3">
                <p className="text-[10px] font-bold uppercase text-outline">Parte base</p>
                <p className="font-display text-xl font-bold text-secondary">${ownerBaseShare.toFixed(2)}</p>
              </div>
            </div>
            <div className="space-y-3">
              {ownerSettlements.map((item) => (
                <div key={item.owner} className="border border-outline-variant/30 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-sm text-on-surface">{item.owner}</p>
                    <p className="font-display font-bold text-primary">${item.payout.toFixed(2)}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-outline font-semibold">
                    Base ${item.profitShare.toFixed(2)} + gastos pagados ${item.expensesPaid.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-outline-variant/30 rounded-xl p-6 shadow-sm">
            <h3 className="font-display font-bold text-primary mb-4">Ingresos por medio de pago</h3>
            <div className="space-y-3">
              {Object.entries(paymentMethodTotals).length > 0 ? (
                Object.entries(paymentMethodTotals).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold text-on-surface">{method}</span>
                    <span className="font-display font-bold text-secondary">${amount.toFixed(2)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant">Todavia no hay ingresos en el ciclo actual.</p>
              )}
            </div>
          </div>

          {/* Projected Payout */}
          <div className="bg-primary text-white rounded-xl p-6 relative overflow-hidden shadow-lg group">
            <div className="relative z-10">
              <h3 className="text-sm font-bold opacity-70 mb-1">Saldo neto disponible</h3>
              <p className="text-[10px] opacity-60 mb-6 uppercase tracking-wider">Ciclo actual desde el ultimo cobro</p>
              <h2 className="font-display text-4xl font-bold mb-8">${Math.max(withdrawableBalance, 0).toFixed(2)}</h2>
              <button
                onClick={handleWithdraw}
                disabled={!canWithdraw}
                className="w-full bg-secondary hover:bg-secondary/90 text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Banknote className="w-4 h-4" />
                Cobrar
              </button>
              {pendingPaymentBookings.length > 0 && (
                <div className="mt-4 rounded-lg bg-white/12 border border-white/20 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">No se puede cobrar todavia</p>
                      <p className="mt-1 text-[10px] opacity-80">
                        Primero registra el pago completo de estas reservas:
                      </p>
                      <div className="mt-2 space-y-1">
                        {pendingPaymentBookings.slice(0, 4).map((booking) => (
                          <p key={booking.id} className="text-[10px] leading-snug">
                            {booking.tenant} - {booking.property || 'Sin departamento'}: {formatMoney(Number(booking.amountPaid || 0))} de {formatMoney(Number(booking.amountTotal || 0))}
                          </p>
                        ))}
                        {pendingPaymentBookings.length > 4 && (
                          <p className="text-[10px] opacity-80">Y {pendingPaymentBookings.length - 4} reserva(s) mas.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {withdrawError && (
                <div className="mt-4 rounded-lg bg-white/12 border border-white/20 p-3">
                  <p className="text-xs font-bold">No se pudo cerrar el ciclo</p>
                  <p className="mt-1 text-[10px] opacity-80">{withdrawError}</p>
                </div>
              )}
            </div>
            <CreditCard className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 rotate-12 transition-transform group-hover:scale-110" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          </div>

          {/* Smart Tip */}
          <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/20 border-dashed">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Lightbulb className="w-4 h-4 text-secondary fill-secondary/20" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-primary mb-1">Smart Tip</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {financeTransactions.length === 0 ? 'Todavia no hay datos suficientes para generar sugerencias.' : 'Revisa los movimientos recientes para detectar oportunidades de ahorro.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="bg-white border border-outline-variant/30 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-surface-container flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-primary">Historial de ciclos cobrados</h3>
              <p className="text-xs text-outline font-medium">Cierres anteriores listos para consultar o compartir.</p>
            </div>
          </div>
          <span className="text-xs text-outline font-medium">{closedCycles.length} ciclos cerrados</span>
        </div>

        {closedCycles.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-on-surface-variant">Todavia no hay ciclos cobrados para mostrar.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-container">
            {closedCycles.map((cycle, index) => (
              <div key={cycle.id} className="px-6 py-4 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Ciclo cerrado #{closedCycles.length - index}</p>
                  <h4 className="mt-1 font-display font-bold text-on-surface">{cycle.title}</h4>
                  <p className="mt-1 text-xs text-outline font-medium">{cycle.periodLabel} · {cycle.transactionCount} movimientos</p>
                </div>

                <div className="grid grid-cols-3 gap-3 xl:min-w-[440px]">
                  <div className="rounded-lg bg-surface-container-low p-3">
                    <p className="text-[10px] font-bold uppercase text-outline">Ingresos</p>
                    <p className="font-display font-bold text-secondary">{formatMoney(cycle.income)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-3">
                    <p className="text-[10px] font-bold uppercase text-outline">Gastos</p>
                    <p className="font-display font-bold text-error">{formatMoney(cycle.expense)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-container-low p-3">
                    <p className="text-[10px] font-bold uppercase text-outline">Neto</p>
                    <p className="font-display font-bold text-primary">{formatMoney(cycle.balance)}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleShareClosedCycleImage(cycle)}
                  className="w-full xl:w-auto flex items-center justify-center gap-2 border border-secondary text-secondary px-5 py-2 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Compartir PNG
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
