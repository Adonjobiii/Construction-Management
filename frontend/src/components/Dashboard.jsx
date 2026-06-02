import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  DollarSign, 
  ClipboardList, 
  TrendingUp, 
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Percent,
  Calendar,
  Briefcase
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';

export default function Dashboard({ metrics, recentLogs, sites, expenses, requests, user, isDarkMode }) {
  const [selectedSiteId, setSelectedSiteId] = useState('all');

  // Format Currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const isAll = selectedSiteId === 'all';
  const siteIdNum = Number(selectedSiteId);
  const selectedSite = useMemo(() => sites?.find(s => s.id === siteIdNum), [sites, siteIdNum]);

  // Derived state values based on selector
  const activeSites = isAll ? (metrics?.activeSites || 0) : (selectedSite?.status || 'N/A');
  
  const totalExpenses = useMemo(() => {
    if (isAll) return metrics?.totalExpenses || 0;
    if (!expenses) return 0;
    return expenses
      .filter(e => Number(e.site_id) === siteIdNum)
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
  }, [isAll, expenses, siteIdNum, metrics]);

  const pendingRequests = useMemo(() => {
    if (isAll) return metrics?.pendingRequests || 0;
    if (!requests) return 0;
    return requests.filter(r => Number(r.site_id) === siteIdNum && r.status === 'pending').length;
  }, [isAll, requests, siteIdNum, metrics]);

  const categoryData = useMemo(() => {
    if (isAll) {
      return metrics?.categoryExpenses?.map(item => ({
        name: item.category.charAt(0).toUpperCase() + item.category.slice(1) + ' Cost',
        value: parseFloat(item.value || 0)
      })) || [
        { name: 'Material Cost', value: 0 },
        { name: 'Transportation Cost', value: 0 },
        { name: 'Labour Cost', value: 0 }
      ];
    }
    
    const categories = { material: 0, transportation: 0, labour: 0 };
    if (expenses) {
      expenses
        .filter(e => Number(e.site_id) === siteIdNum)
        .forEach(e => {
          if (categories[e.category] !== undefined) {
            categories[e.category] += Number(e.amount);
          }
        });
    }
    return [
      { name: 'Material Cost', value: categories.material },
      { name: 'Transportation Cost', value: categories.transportation },
      { name: 'Labour Cost', value: categories.labour }
    ];
  }, [isAll, expenses, siteIdNum, metrics]);

  const COLORS = ['#0e90eb', '#f59e0b', '#10b981'];

  const trendData = useMemo(() => {
    if (isAll) {
      return metrics?.monthlyTrends?.map(item => ({
        month: item.month,
        expenses: parseFloat(item.total || 0)
      })) || [];
    }
    
    const monthlySums = {};
    if (expenses) {
      expenses
        .filter(e => Number(e.site_id) === siteIdNum)
        .forEach(e => {
          const date = new Date(e.date_time);
          const yearMonth = isNaN(date.getTime()) ? 'Unknown' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlySums[yearMonth] = (monthlySums[yearMonth] || 0) + Number(e.amount);
        });
    }
    return Object.keys(monthlySums)
      .sort()
      .map(m => ({ month: m, expenses: monthlySums[m] }));
  }, [isAll, expenses, siteIdNum, metrics]);

  const budgetAlerts = useMemo(() => {
    if (isAll) {
      return metrics?.budgetStatus?.filter(site => site.spent > site.budget) || [];
    }
    if (!selectedSite) return [];
    return totalExpenses > selectedSite.budget ? [
      { id: selectedSite.id, name: selectedSite.name, spent: totalExpenses, budget: selectedSite.budget }
    ] : [];
  }, [isAll, selectedSite, totalExpenses, metrics]);

  const complianceRate = useMemo(() => {
    if (isAll) {
      return metrics?.budgetStatus?.length 
        ? `${Math.round(((metrics.budgetStatus.length - budgetAlerts.length) / metrics.budgetStatus.length) * 100)}%` 
        : '100%';
    }
    if (!selectedSite) return '0%';
    return selectedSite.budget > 0 
      ? `${Math.min(100, Math.round((totalExpenses / selectedSite.budget) * 100))}%`
      : '0%';
  }, [isAll, selectedSite, totalExpenses, budgetAlerts, metrics]);

  // Recharts custom tooltips
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-3 rounded-xl border shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <p className="text-xs text-slate-400 font-semibold">{label}</p>
          <p className="text-sm font-bold text-brand-500 mt-1">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Title & Filter Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Enterprise Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time summary of operations, budget usage, and site reports.
          </p>
        </div>

        {/* Site Filter dropdown */}
        {sites && sites.length > 0 && (
          <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 shrink-0 ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Site Filter:</span>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className={`bg-transparent text-xs font-bold border-none focus:outline-none cursor-pointer ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}
            >
              <option value="all" className={isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}>
                All Project Sites (Aggregate)
              </option>
              {sites.map(site => (
                <option key={site.id} value={site.id} className={isDarkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-800'}>
                  {site.name} ({site.site_id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Budget warnings */}
      {budgetAlerts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
          <div>
            <h4 className="text-sm font-bold text-rose-400">Budget Limit Breach Alerts</h4>
            <div className="mt-1 space-y-1">
              {budgetAlerts.map(alert => (
                <p key={alert.id} className="text-xs text-rose-300">
                  Site <strong className="text-white font-semibold">{alert.name}</strong> has exceeded its budget! Spent: {formatCurrency(alert.spent)} (Budget: {formatCurrency(alert.budget)})
                </p>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Widget Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            title: isAll ? 'Active Project Sites' : 'Project Site Status',
            value: isAll ? activeSites : (activeSites.charAt(0).toUpperCase() + activeSites.slice(1)),
            icon: Building2,
            gradient: 'from-brand-600 to-brand-500',
            glow: 'glow-brand',
            desc: isAll ? 'Under construction or planning' : `Type: ${selectedSite?.project_type || 'N/A'}`
          },
          {
            title: 'Total Expense Booked',
            value: formatCurrency(totalExpenses),
            icon: DollarSign,
            gradient: 'from-emerald-600 to-emerald-500',
            glow: 'glow-emerald',
            desc: 'All categories combined'
          },
          {
            title: 'Pending Staff Requests',
            value: pendingRequests,
            icon: ClipboardList,
            gradient: 'from-amber-600 to-amber-500',
            glow: 'glow-amber',
            desc: 'Requires admin attention'
          },
          {
            title: isAll ? 'Budget Compliance Rate' : 'Budget Utilized',
            value: complianceRate,
            icon: Percent,
            gradient: budgetAlerts.length > 0 ? 'from-rose-600 to-rose-500' : 'from-brand-600 to-emerald-500',
            glow: budgetAlerts.length > 0 ? 'glow-rose' : 'glow-emerald',
            desc: isAll ? 'Sites within assigned budget' : `Limit: ${formatCurrency(selectedSite?.budget || 0)}`
          }
        ].map((widget, i) => (
          <motion.div
            key={widget.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className={`p-6 rounded-3xl ${isDarkMode ? 'glass-card border-slate-800/80 shadow-2xl' : 'glass-card-light border-slate-200/80 shadow-lg'} relative overflow-hidden group hover:-translate-y-1 transition-all duration-300`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${widget.gradient} opacity-5 group-hover:opacity-10 rounded-full blur-2xl transition-all`}></div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{widget.title}</p>
                <h3 className={`text-xl font-black mt-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{widget.value}</h3>
              </div>
              <div className={`p-3 rounded-2xl bg-gradient-to-tr ${widget.gradient} text-white shadow-lg ${widget.glow}`}>
                <widget.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4 font-medium">{widget.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className={`lg:col-span-2 p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'}`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Monthly Expense Trends</h3>
              <p className="text-xs text-slate-400">Date-wise accumulated bills</p>
            </div>
            <TrendingUp className="w-5 h-5 text-brand-500" />
          </div>

          <div className="h-72" style={{ minWidth: 0, minHeight: 0 }}>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0e90eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0e90eb" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#e2e8f0'} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="expenses" stroke="#0e90eb" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No expense trend data available for this site.
              </div>
            )}
          </div>
        </motion.div>

        {/* Category Share Pie Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'}`}
        >
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Category Share</h3>
            <p className="text-xs text-slate-400">Expense split analysis</p>
          </div>

          <div className="h-60 mt-4 flex items-center justify-center relative" style={{ minWidth: 0, minHeight: 0 }}>
            {totalExpenses > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-sm">No category distribution data.</div>
            )}
            {totalExpenses > 0 && (
              <div className="absolute text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total spent</span>
                <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(totalExpenses)}</p>
              </div>
            )}
          </div>

          {/* Legends */}
          <div className="grid grid-cols-3 gap-2 text-center mt-2 border-t border-slate-800/50 pt-4">
            {categoryData.map((entry, index) => (
              <div key={entry.name}>
                <div className="inline-flex items-center gap-1.5 justify-center">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index] }}></span>
                  <span className="text-[10px] font-semibold text-slate-400">{entry.name.split(' ')[0]}</span>
                </div>
                <p className={`text-xs font-bold mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {totalExpenses > 0 ? `${Math.round((entry.value / totalExpenses) * 100)}%` : '0%'}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Site budgets OR Site details & Audit feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sites budgets or Selected Site Progress */}
        <div className={`lg:col-span-2 p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'}`}>
          {isAll ? (
            <>
              <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Active Site Budgets</h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                {metrics?.budgetStatus && metrics.budgetStatus.length > 0 ? (
                  metrics.budgetStatus.map((site) => {
                    const percent = site.budget > 0 ? Math.min(100, Math.round((site.spent / site.budget) * 100)) : 0;
                    const isExceeded = site.spent > site.budget;

                    return (
                      <div key={site.id} className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{site.name}</span>
                          <span className={isExceeded ? 'text-rose-400' : 'text-brand-400'}>
                            {formatCurrency(site.spent)} / {formatCurrency(site.budget)} ({percent}%)
                          </span>
                        </div>
                        <div className={`w-full h-2.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'} overflow-hidden`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.8 }}
                            className={`h-full rounded-full bg-gradient-to-r ${isExceeded ? 'from-rose-600 to-rose-500' : 'from-brand-600 to-brand-400'}`}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 text-sm py-4 text-center">No active project budgets recorded.</div>
                )}
              </div>
            </>
          ) : (
            selectedSite && (
              <>
                <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Project Site Details</h3>
                <div className="space-y-6">
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-400">Construction Work Progress</span>
                      <span className="text-brand-400">{selectedSite.progress_percent || 0}% Completed</span>
                    </div>
                    <div className={`w-full h-3.5 rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'} overflow-hidden`}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedSite.progress_percent || 0}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Detail grids */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50 border-slate-150'}`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Site Location</span>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <MapPin className="w-4 h-4 text-brand-500 shrink-0" />
                        <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{selectedSite.location}</span>
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50 border-slate-150'}`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Project Classification</span>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Briefcase className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{selectedSite.project_type}</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50 border-slate-150'}`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Site Supervisor</span>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <User className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>
                          {selectedSite.supervisor_name || 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50 border-slate-150'}`}>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Timeline Schedule</span>
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Calendar className="w-4 h-4 text-rose-500 shrink-0" />
                        <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>
                          {selectedSite.start_date} to {selectedSite.completion_date}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )
          )}
        </div>

        {/* Timeline Log Feed */}
        <div className={`p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Audit logs feed</h3>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {recentLogs && recentLogs.length > 0 ? (
              recentLogs.slice(0, 5).map((log, i) => (
                <div key={log.id || i} className="flex gap-3 relative pb-1">
                  {i < 4 && (
                    <span className={`absolute left-4 top-8 bottom-0 w-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`}></span>
                  )}
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{log.action}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{log.details}</p>
                    <span className="text-[9px] text-slate-500 block mt-1">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} by {log.user_name || 'System'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-slate-500 text-xs py-8 text-center">No recent activities logged.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
