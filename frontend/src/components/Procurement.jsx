import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PackageSearch, CheckCircle, Package, AlertCircle, X, Search } from 'lucide-react';
import apiClient from '../api';

export default function Procurement({ sites, user, isDarkMode }) {
  const [budgets, setBudgets] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Verification Modal
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Verification Form
  const [deliveryStatus, setDeliveryStatus] = useState('delivered');
  const [actualCost, setActualCost] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');

  const fetchBudgets = async () => {
    if (!selectedSiteId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/budgets?site_id=${selectedSiteId}`);
      setBudgets(res.data);
    } catch (err) {
      setError('Failed to fetch budget items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [selectedSiteId]);

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/budgets/${selectedItem.id}/verify`, {
        delivery_status: deliveryStatus,
        actual_cost: actualCost,
        serial_number: serialNumber,
        batch_number: batchNumber
      });
      setIsVerifyOpen(false);
      fetchBudgets();
    } catch (err) {
      alert('Verification failed');
    }
  };

  const openVerify = (item) => {
    setSelectedItem(item);
    setDeliveryStatus(item.delivery_status || 'delivered');
    setActualCost(item.actual_cost || item.budget_allocation);
    setSerialNumber(item.serial_number || '');
    setBatchNumber(item.batch_number || '');
    setIsVerifyOpen(true);
  };

  // Filter sites for dropdown
  const availableSites = user?.role === 'admin' || user?.role === 'accountant' 
    ? sites 
    : sites.filter(s => s.assigned_supervisor_id === user?.id || (user?.site_access && user.site_access.includes(s.site_id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black font-niyantraan flex items-center gap-3">
            <PackageSearch className="w-8 h-8 text-brand-500" />
            Procurement & Verification
          </h2>
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Track batch numbers, serials, and verify delivered products.</p>
        </div>
      </div>

      <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Project Site</label>
        <select 
          value={selectedSiteId} 
          onChange={(e) => setSelectedSiteId(e.target.value)}
          className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
        >
          <option value="">-- Choose a Site to Verify Products --</option>
          {availableSites.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.site_id})</option>
          ))}
        </select>
      </div>

      {loading && <div className="text-center p-8 text-brand-500 font-bold animate-pulse">Loading items...</div>}
      {error && <div className="text-rose-500 p-4 bg-rose-500/10 rounded-xl">{error}</div>}

      {selectedSiteId && !loading && (
        <div className={`rounded-3xl border overflow-hidden ${isDarkMode ? 'glass-card border-slate-800' : 'glass-card-light border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-xs uppercase tracking-wider ${isDarkMode ? 'bg-slate-900/80 text-slate-400 border-b border-slate-800' : 'bg-slate-100 text-slate-500 border-b border-slate-200'}`}>
                  <th className="p-4 font-bold">Category & Item</th>
                  <th className="p-4 font-bold">Budget vs Actual</th>
                  <th className="p-4 font-bold">Details (Brand/SKU)</th>
                  <th className="p-4 font-bold">Verification Logs</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/20">
                {budgets.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500">No items found for this site.</td>
                  </tr>
                ) : (
                  budgets.map(item => (
                    <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-slate-900/50' : 'hover:bg-slate-50'}`}>
                      <td className="p-4">
                        <div className="font-bold text-sm">{item.item_name}</div>
                        <div className={`text-xs px-2 py-1 inline-block mt-1 rounded-md ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{item.category}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-500">Allocated: <span className="font-bold text-brand-400">₹{item.budget_allocation}</span></div>
                        <div className="text-xs text-slate-500 mt-1">Actual: <span className="font-bold text-emerald-400">₹{item.actual_cost}</span></div>
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-500">Brand: {item.brand || 'N/A'}</div>
                        <div className="text-xs text-slate-500">SKU: {item.sku || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        {item.delivery_status === 'pending' ? (
                          <span className="flex items-center gap-1 text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg w-max">
                            <AlertCircle className="w-3 h-3" /> Pending Delivery
                          </span>
                        ) : (
                          <div className="text-xs">
                            <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg w-max mb-1">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </div>
                            <div className="text-slate-500">SN: <span className="text-slate-300 font-mono">{item.serial_number || 'N/A'}</span></div>
                            <div className="text-slate-500">Batch: <span className="text-slate-300 font-mono">{item.batch_number || 'N/A'}</span></div>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openVerify(item)}
                          className="bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                          Verify Product
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      <AnimatePresence>
        {isVerifyOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" /> Verify Product
                </h3>
                <button onClick={() => setIsVerifyOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-brand-500/10 rounded-xl text-sm border border-brand-500/20">
                <span className="font-bold text-brand-400">{selectedItem.item_name}</span> ({selectedItem.category})
                <br />
                <span className="text-xs text-slate-400">Expected Budget: ₹{selectedItem.budget_allocation}</span>
              </div>

              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Delivery Status</label>
                  <select 
                    value={deliveryStatus} 
                    onChange={(e) => setDeliveryStatus(e.target.value)}
                    className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="delivered">Delivered & Verified</option>
                    <option value="rejected">Rejected (Mismatch)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Actual Cost (₹)</label>
                  <input
                    type="number"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Serial Number</label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white font-mono text-sm' : 'bg-slate-50 border-slate-200 font-mono text-sm'}`}
                      placeholder="S/N..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Batch Number</label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      className={`w-full p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white font-mono text-sm' : 'bg-slate-50 border-slate-200 font-mono text-sm'}`}
                      placeholder="Batch..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsVerifyOpen(false)} className={`px-4 py-2 rounded-xl text-sm font-bold ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>Cancel</button>
                  <button type="submit" className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all">Save Verification</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
