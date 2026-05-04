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
  Banknote
} from 'lucide-react';
import { cn } from '../lib/utils';
import { createTransaction, getProperties, getTransactions, Property, Transaction } from '../services/api';
import { useModal } from '../hooks/useModal';
import { Modal } from '../components/Modal';
import { TransactionForm } from '../components/forms/TransactionForm';

export default function Finance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const modal = useModal();

  const loadData = async () => {
    try {
      const [transactionData, propertyData] = await Promise.all([
        getTransactions(),
        getProperties(),
      ]);
      setTransactions(transactionData);
      setProperties(propertyData);
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

  const handleTransactionCreated = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
    modal.close();
  };

  const formatDate = (value: string) => {
    const [year, month, day] = value.split('-');
    return day && month && year ? `${day}-${month}-${year}` : value;
  };

  const isWithdrawal = (transaction: Transaction) => transaction.concept.toLowerCase().startsWith('cobro de fondos');

  const currentMonth = new Date().toISOString().slice(0, 7);
  const filteredTransactions = transactions.filter((transaction) => {
    const matchesPeriod = periodFilter === 'all' || transaction.date.startsWith(periodFilter);
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
  const withdrawableBalance = transactions.reduce((sum, transaction) => {
    return transaction.type === 'income'
      ? sum + transaction.amount
      : sum - Math.abs(transaction.amount);
  }, 0);

  const operationalExpenses = filteredTransactions.filter((transaction) => transaction.type === 'expense' && !isWithdrawal(transaction));
  const totalOperationalExpenses = operationalExpenses.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const summaries = [
    { label: 'Balance Filtrado', value: `$${balance.toFixed(2)}`, trend: filteredTransactions.length > 0 ? 'Datos reales' : 'Sin movimientos', icon: TrendingUp, color: 'text-primary' },
    { label: 'Ingresos', value: `$${totalIncome.toFixed(2)}`, sub: `${filteredTransactions.filter(t => t.type === 'income').length} ingresos registrados`, icon: ArrowUpRight, color: 'text-secondary' },
    { label: 'Egresos', value: `-$${Math.abs(totalExpense).toFixed(2)}`, sub: `${filteredTransactions.filter(t => t.type === 'expense').length} egresos registrados`, icon: ArrowDownRight, color: 'text-error' },
  ];

  const distributions = operationalExpenses.length > 0
    ? [{ label: 'Gastos operativos', percentage: 100, amount: totalOperationalExpenses, color: 'bg-primary' }]
    : [];

  const handleWithdraw = async () => {
    if (withdrawableBalance <= 0) return;

    try {
      const transaction = await createTransaction({
        date: new Date().toISOString().split('T')[0],
        concept: 'Cobro de fondos',
        amount: withdrawableBalance,
        status: 'Completado',
        type: 'expense',
      });
      setTransactions(prev => [transaction, ...prev]);
    } catch (error) {
      console.error('Error creating withdrawal:', error);
    }
  };

  const handleExport = () => {
    const escapeHtml = (value: string | number) => String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

    const exportDate = new Date().toISOString().split('T')[0];
    const periodLabel = periodFilter === 'all' ? 'Todos los periodos' : `Mes ${periodFilter}`;
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
          <td>${escapeHtml(formatDate(transaction.date))}</td>
          <td>${escapeHtml(transaction.concept)}</td>
          <td>${escapeHtml(transaction.property || 'Sin departamento')}</td>
          <td>${escapeHtml(transaction.type === 'income' ? 'Ingreso' : 'Egreso')}</td>
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
          <p class="meta">Exportado el ${escapeHtml(formatDate(exportDate))}</p>

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
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody class="transactions">
              ${rows || '<tr><td class="empty" colspan="6">No hay movimientos para los filtros seleccionados.</td></tr>'}
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
              <option value="all">Todos los periodos</option>
              <option value={currentMonth}>Mes actual</option>
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
            onClick={handleExport}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 border border-primary text-primary px-5 py-2 rounded-lg font-bold text-sm hover:bg-surface-container transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar Excel
          </button>
          <button 
            onClick={modal.open}
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
        onClose={modal.close} 
        title="Registrar transacción"
        size="md"
      >
        <TransactionForm 
          onSuccess={handleTransactionCreated}
          onCancel={modal.close}
        />
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.slice(0, 15).map((t, idx) => (
                      <tr key={idx} className="zebra-stripe border-b border-surface-container/30 last:border-0 hover:bg-active transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-on-surface">{formatDate(t.date)}</td>
                        <td className="px-6 py-4 text-xs font-bold text-on-surface">{t.concept}</td>
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
          {/* Distribution Card */}
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

          {/* Projected Payout */}
          <div className="bg-primary text-white rounded-xl p-6 relative overflow-hidden shadow-lg group">
            <div className="relative z-10">
              <h3 className="text-sm font-bold opacity-70 mb-1">Saldo Disponible</h3>
              <p className="text-[10px] opacity-60 mb-6 uppercase tracking-wider">Ingresos menos egresos registrados</p>
              <h2 className="font-display text-4xl font-bold mb-8">${Math.max(withdrawableBalance, 0).toFixed(2)}</h2>
              <button
                onClick={handleWithdraw}
                disabled={withdrawableBalance <= 0}
                className="w-full bg-secondary hover:bg-secondary/90 text-white py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Banknote className="w-4 h-4" />
                Cobrar
              </button>
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
                  {transactions.length === 0 ? 'Todavia no hay datos suficientes para generar sugerencias.' : 'Revisa los movimientos recientes para detectar oportunidades de ahorro.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
