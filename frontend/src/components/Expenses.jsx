import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, 
  Plus, 
  Edit2, 
  Trash2, 
  FileText, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  Eye, 
  X,
  AlertTriangle
} from 'lucide-react';
import apiClient, { API_BASE } from '../api';

export default function Expenses({ expenses, sites, user, onRefresh, isDarkMode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  // Filters State
  const [filterSite, setFilterSite] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMode, setFilterMode] = useState('month-year'); // 'month-year' or 'custom'
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - 2 + i));

  const months = [
    { value: '0', label: 'January' },
    { value: '1', label: 'February' },
    { value: '2', label: 'March' },
    { value: '3', label: 'April' },
    { value: '4', label: 'May' },
    { value: '5', label: 'June' },
    { value: '6', label: 'July' },
    { value: '7', label: 'August' },
    { value: '8', label: 'September' },
    { value: '9', label: 'October' },
    { value: '10', label: 'November' },
    { value: '11', label: 'December' },
  ];

  // Form Fields
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('material');
  const [siteId, setSiteId] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);

  // Auto Calculations
  const filteredExpenses = expenses?.filter(exp => {
    if (filterSite && exp.site_id !== parseInt(filterSite)) return false;
    if (filterCategory && exp.category !== filterCategory) return false;
    
    if (filterMode === 'month-year') {
      const expDate = new Date(exp.date_time);
      if (filterYear && expDate.getFullYear() !== parseInt(filterYear)) return false;
      if (filterMonth && expDate.getMonth() !== parseInt(filterMonth)) return false;
    } else {
      if (filterStart && new Date(exp.date_time) < new Date(filterStart)) return false;
      if (filterEnd && new Date(exp.date_time) > new Date(filterEnd + 'T23:59:59')) return false;
    }
    return true;
  }) || [];

  const totalSpent = filteredExpenses.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

  const openAddModal = () => {
    setEditExpense(null);
    setTitle('');
    setAmount('');
    setCategory('material');
    setSiteId(sites[0]?.id || '');
    setDateTime(new Date().toISOString().slice(0, 16));
    setNotes('');
    setInvoiceFile(null);
    setError('');
    setWarning('');
    setIsModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditExpense(exp);
    setTitle(exp.title);
    setAmount(exp.amount);
    setCategory(exp.category);
    setSiteId(exp.site_id || '');
    setDateTime(new Date(exp.date_time).toISOString().slice(0, 16));
    setNotes(exp.notes || '');
    setInvoiceFile(null);
    setError('');
    setWarning('');
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    setInvoiceFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setWarning('');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('amount', amount);
    formData.append('category', category);
    formData.append('site_id', siteId);
    formData.append('date_time', dateTime);
    formData.append('notes', notes);
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }

    try {
      let response;
      if (editExpense) {
        // Edit Expense
        response = await apiClient.put(`/expenses/${editExpense.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Add Expense
        response = await apiClient.post('/expenses', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      if (response.data.warning) {
        alert(response.data.warning); // Instant popup alert for budget exceed warning
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense entry?')) return;
    try {
      await apiClient.delete(`/expenses/${id}`);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete expense.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'material': return 'bg-brand-500/10 text-brand-400 border-brand-500/30';
      case 'transportation': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Expense Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Book site expenses, upload receipt invoices, and filter records by categories.
          </p>
        </div>

        <button
          onClick={openAddModal}
          disabled={sites.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* Filter panel */}
      <div className={`p-5 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'} space-y-4`}>
        {/* Toggle Filter Mode */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-800/10">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search Filters</span>
          <div className="flex bg-slate-850/50 p-0.5 rounded-lg border border-slate-800/20 text-[10px] font-bold">
            <button
              onClick={() => setFilterMode('month-year')}
              className={`px-3 py-1 rounded-md transition-all ${filterMode === 'month-year' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Entire Month Select
            </button>
            <button
              onClick={() => setFilterMode('custom')}
              className={`px-3 py-1 rounded-md transition-all ${filterMode === 'custom' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Custom Date Range
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Project Site
            </label>
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <option value="">All Sites</option>
              {sites?.map(site => (
                <option key={site.id} value={site.id}>{site.name} ({site.site_id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <option value="">All Categories</option>
              <option value="material">Material Expenses</option>
              <option value="transportation">Transportation Expenses</option>
              <option value="labour">Labour Expenses</option>
            </select>
          </div>

          {filterMode === 'month-year' ? (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Select Year
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">All Years</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Select Month
                </label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                >
                  <option value="">All Months</option>
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Start Date
                </label>
                <input
                  type="date"
                  value={filterStart}
                  onChange={(e) => setFilterStart(e.target.value)}
                  className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> End Date
                </label>
                <input
                  type="date"
                  value={filterEnd}
                  onChange={(e) => setFilterEnd(e.target.value)}
                  className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Banner */}
      <div className={`p-4 rounded-2xl flex items-center justify-between border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-100/50 border-slate-200'}`}>
        <span className="text-xs font-bold text-slate-400">Total Filtered Cost Summary:</span>
        <span className="text-lg font-black text-emerald-500">{formatCurrency(totalSpent)}</span>
      </div>

      {/* Ledger Table */}
      <div className={`overflow-x-auto rounded-3xl border ${isDarkMode ? 'glass border-slate-800/80 shadow-2xl' : 'glass-light border-slate-200/80 shadow-lg'}`}>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className={`border-b font-bold text-slate-400 ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-100/40'}`}>
              <th className="p-4">Expense Title</th>
              <th className="p-4">Site Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Added By</th>
              <th className="p-4">Date & Time</th>
              <th className="p-4">Notes</th>
              <th className="p-4 text-center">Invoice</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="font-medium">
            {filteredExpenses.length > 0 ? (
              filteredExpenses.map((exp) => {
                const canEdit = user.role === 'admin' || user.role === 'accountant' || exp.added_by === user.id;

                return (
                  <tr key={exp.id} className={`border-b transition-colors ${isDarkMode ? 'border-slate-850 hover:bg-slate-900/20' : 'border-slate-150 hover:bg-slate-50'}`}>
                    <td className={`p-4 font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{exp.title}</td>
                    <td className="p-4 text-slate-400">{exp.site_name || 'N/A'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4 text-emerald-500 font-bold">{formatCurrency(exp.amount)}</td>
                    <td className="p-4 text-slate-400">{exp.added_by_name || 'Unknown'}</td>
                    <td className="p-4 text-slate-400">
                      {new Date(exp.date_time).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-4 max-w-xs truncate text-slate-500">{exp.notes || '-'}</td>
                    <td className="p-4 text-center">
                      {exp.invoice_url ? (
                        <a
                          href={`${API_BASE}${exp.invoice_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex p-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-600">No bill</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {canEdit ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => openEditModal(exp)}
                            className={`p-1.5 rounded-lg border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-650'}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-650 italic">Read-only</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="p-12 text-center text-slate-500">
                  <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  No expense records match the active filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl overflow-y-auto max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">
                  {editExpense ? 'Update Expense Entry' : 'Book New Expense'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className={`p-1 rounded-lg transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expense Title / Item</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    placeholder="e.g. 10 Tons Concrete ReadyMix"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Amount (INR)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      placeholder="e.g. 45000"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    >
                      <option value="material">Material Cost</option>
                      <option value="transportation">Transportation Cost</option>
                      <option value="labour">Labour Cost</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Site</label>
                    <select
                      value={siteId}
                      onChange={(e) => setSiteId(e.target.value)}
                      disabled={!!editExpense}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white disabled:opacity-40' : 'bg-slate-50 border-slate-200 text-slate-900 disabled:opacity-50'}`}
                      required
                    >
                      {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={dateTime}
                      onChange={(e) => setDateTime(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes & Explanations</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows="2"
                    className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    placeholder="Provide description..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Upload Receipt / Invoice bill</label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".png,.jpg,.jpeg,.gif,.pdf,.doc,.docx,.xls,.xlsx"
                    className={`w-full text-xs rounded-xl p-2.5 border file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-brand-500 file:text-white hover:file:bg-brand-650 cursor-pointer ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-650'}`}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Accepts images, PDF, Word, Excel up to 10MB.</p>
                </div>

                <div className="pt-4 border-t border-slate-800/20 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={`text-xs font-bold py-2.5 px-4 rounded-xl border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all flex items-center justify-center min-w-[100px]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>Save expense</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
