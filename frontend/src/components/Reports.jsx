import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Calendar, 
  Building2, 
  Filter,
  DollarSign,
  TrendingUp,
  Percent
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Reports({ expenses, sites, isDarkMode }) {
  // Filters State
  const [siteId, setSiteId] = useState('');
  const [category, setCategory] = useState('');
  const [filterMode, setFilterMode] = useState('month-year'); // 'month-year' or 'custom'
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  // Filter logic
  const filtered = expenses?.filter(exp => {
    if (siteId && exp.site_id !== parseInt(siteId)) return false;
    if (category && exp.category !== category) return false;
    
    if (filterMode === 'month-year') {
      const expDate = new Date(exp.date_time);
      if (filterYear && expDate.getFullYear() !== parseInt(filterYear)) return false;
      if (filterMonth && expDate.getMonth() !== parseInt(filterMonth)) return false;
    } else {
      if (startDate && new Date(exp.date_time) < new Date(startDate)) return false;
      if (endDate && new Date(exp.date_time) > new Date(endDate + 'T23:59:59')) return false;
    }
    return true;
  }) || [];

  // Cost breakups
  const materialCost = filtered.filter(e => e.category === 'material').reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const transCost = filtered.filter(e => e.category === 'transportation').reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const labourCost = filtered.filter(e => e.category === 'labour').reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const grandTotal = materialCost + transCost + labourCost;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  };

  // PDF Generation Handler
  const generatePDF = () => {
    const doc = new jsPDF();
    const activeSiteName = siteId ? sites.find(s => s.id === parseInt(siteId))?.name : 'All Sites';
    const activeCatName = category ? category.toUpperCase() : 'All Categories';

    // PDF Title / Header
    doc.setFillColor(14, 144, 235); // Brand Blue color
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('Helvetica', 'bold');
    doc.text('NIYANTRAAN', 14, 20);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text('Construction Management Dashboard', 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 150, 28);

    // Filter metadata
    doc.setTextColor(10, 10, 10);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('Expense Summary Statement', 14, 52);
    
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Project Site: ${activeSiteName}`, 14, 60);
    doc.text(`Expense Category: ${activeCatName}`, 14, 65);
    let periodText = '';
    if (filterMode === 'month-year') {
      const monthLabel = filterMonth ? months.find(m => m.value === filterMonth)?.label : 'All Months';
      const yearLabel = filterYear || 'All Years';
      periodText = `${monthLabel} ${yearLabel}`;
    } else {
      periodText = `${startDate || 'Beginning'} to ${endDate || 'Current'}`;
    }
    doc.text(`Report Period: ${periodText}`, 14, 70);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 76, 182, 30, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 76, 182, 30);
    
    doc.setFont('Helvetica', 'bold');
    doc.text('Material Cost', 20, 84);
    doc.text('Transportation Cost', 65, 84);
    doc.text('Labour Cost', 115, 84);
    doc.setTextColor(14, 144, 235);
    doc.text('Grand Total Cost', 160, 84);

    doc.setTextColor(15, 23, 42);
    doc.text(formatCurrency(materialCost), 20, 94);
    doc.text(formatCurrency(transCost), 65, 94);
    doc.text(formatCurrency(labourCost), 115, 94);
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text(formatCurrency(grandTotal), 160, 94);

    // Table Data
    const tableHeaders = [['Date', 'Title / Item', 'Site Name', 'Category', 'Added By', 'Amount']];
    const tableRows = filtered.map(exp => [
      new Date(exp.date_time).toLocaleDateString(),
      exp.title,
      exp.site_name || 'N/A',
      exp.category.toUpperCase(),
      exp.added_by_name || 'N/A',
      formatCurrency(exp.amount)
    ]);

    doc.autoTable({
      head: tableHeaders,
      body: tableRows,
      startY: 114,
      theme: 'striped',
      headStyles: { fillColor: [14, 144, 235], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });

    // Save report
    doc.save(`Niyantraan-Report-${activeSiteName.replace(/\s+/g, '-')}-${Date.now()}.pdf`);
  };

  // Excel Generation Handler
  const generateExcel = () => {
    const activeSiteName = siteId ? sites.find(s => s.id === parseInt(siteId))?.name : 'All-Sites';
    
    // Prepare Excel rows
    const dataRows = filtered.map(exp => ({
      'Date & Time': new Date(exp.date_time).toLocaleString(),
      'Expense Title': exp.title,
      'Site ID': exp.site_code || 'N/A',
      'Site Name': exp.site_name || 'N/A',
      'Category': exp.category.toUpperCase(),
      'Added By': exp.added_by_name || 'N/A',
      'Amount (INR)': parseFloat(exp.amount),
      'Notes': exp.notes || ''
    }));

    // Append Summary rows
    const summaryRows = [
      {},
      { 'Expense Title': 'SUMMARY SUMMARY' },
      { 'Expense Title': 'Total Material Cost', 'Amount (INR)': materialCost },
      { 'Expense Title': 'Total Transportation Cost', 'Amount (INR)': transCost },
      { 'Expense Title': 'Total Labour Cost', 'Amount (INR)': labourCost },
      { 'Expense Title': 'GRAND TOTAL COST', 'Amount (INR)': grandTotal }
    ];

    const worksheet = XLSX.utils.json_to_sheet([...dataRows, ...summaryRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expense Statement');
    XLSX.writeFile(workbook, `Niyantraan-Statement-${activeSiteName.replace(/\s+/g, '-')}-${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Statement & Report Center
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Generate financial statements, download Excel ledger logs, or export PDF invoices.
        </p>
      </div>

      {/* Reports filter configuration */}
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
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <option value="">All Categories</option>
              <option value="material">Material Cost</option>
              <option value="transportation">Transportation Cost</option>
              <option value="labour">Labour Cost</option>
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full text-xs font-semibold rounded-xl p-2.5 border focus:outline-none focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export triggers */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={generatePDF}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>Export PDF Report</span>
        </button>

        <button
          onClick={generateExcel}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileText className="w-4 h-4" />
          <span>Export Excel sheet</span>
        </button>
      </div>

      {/* Summary cost cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: 'Material Cost Breakup', val: materialCost, color: 'text-brand-400', border: 'border-brand-500/20' },
          { title: 'Transportation Cost Breakup', val: transCost, color: 'text-amber-400', border: 'border-amber-500/20' },
          { title: 'Labour Cost Breakup', val: labourCost, color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { title: 'STATEMENT GRAND TOTAL', val: grandTotal, color: 'text-white bg-slate-900/40 font-black', border: 'border-brand-500/30 glow-brand' }
        ].map((card) => (
          <div
            key={card.title}
            className={`p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-900/40' : 'bg-slate-50'} ${card.border}`}
          >
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{card.title}</span>
            <span className={`text-xl font-bold mt-2 block tracking-tight ${card.color}`}>{formatCurrency(card.val)}</span>
          </div>
        ))}
      </div>

      {/* Preview Table */}
      <div className="space-y-3">
        <h3 className={`text-sm font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Statement Records Preview ({filtered.length})</h3>
        
        <div className={`overflow-x-auto rounded-3xl border ${isDarkMode ? 'glass border-slate-800/80 shadow-2xl' : 'glass-light border-slate-200/80 shadow-lg'}`}>
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className={`border-b font-bold text-slate-400 ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-100/40'}`}>
                <th className="p-3">Date</th>
                <th className="p-3">Expense Title</th>
                <th className="p-3">Site Code</th>
                <th className="p-3">Category</th>
                <th className="p-3">Added By</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="font-semibold">
              {filtered.length > 0 ? (
                filtered.map((exp) => (
                  <tr key={exp.id} className={`border-b transition-colors ${isDarkMode ? 'border-slate-850 hover:bg-slate-900/20' : 'border-slate-150 hover:bg-slate-50'}`}>
                    <td className="p-3 text-slate-450">{new Date(exp.date_time).toLocaleDateString()}</td>
                    <td className={`p-3 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{exp.title}</td>
                    <td className="p-3 text-slate-450">{exp.site_code || 'N/A'}</td>
                    <td className="p-3 capitalize text-slate-450">{exp.category}</td>
                    <td className="p-3 text-slate-450">{exp.added_by_name || 'N/A'}</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">{formatCurrency(exp.amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-slate-500">
                    Select different filters to generate preview.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
