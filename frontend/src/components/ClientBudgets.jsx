import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { Package, CheckCircle, AlertCircle } from 'lucide-react';

export default function ClientBudgets({ siteId, isDarkMode }) {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBudgets = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/budgets?site_id=${siteId}`);
        setBudgets(res.data);
      } catch (err) {
        console.error('Failed to fetch budgets');
      } finally {
        setLoading(false);
      }
    };
    fetchBudgets();
  }, [siteId]);

  if (loading) return <div className="text-center p-4 text-slate-500 animate-pulse">Loading detailed budgets...</div>;
  if (budgets.length === 0) return null;

  return (
    <div className={`mt-8 p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <Package className="w-5 h-5 text-brand-500" />
        Detailed Item-wise Budget Allocations
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className={`text-[10px] uppercase tracking-wider ${isDarkMode ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              <th className="p-3 rounded-tl-xl">Category</th>
              <th className="p-3">Item Name</th>
              <th className="p-3">Budget Allocated</th>
              <th className="p-3">Actual Cost</th>
              <th className="p-3">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/20">
            {budgets.map(item => (
              <tr key={item.id} className={isDarkMode ? 'hover:bg-slate-800/20' : 'hover:bg-slate-50'}>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{item.category}</span>
                </td>
                <td className="p-3 font-bold">{item.item_name}</td>
                <td className="p-3 text-brand-500 font-bold">₹{item.budget_allocation?.toLocaleString() || 0}</td>
                <td className="p-3 text-emerald-500 font-bold">₹{item.actual_cost?.toLocaleString() || 0}</td>
                <td className="p-3">
                  {item.delivery_status === 'pending' ? (
                    <span className="flex items-center gap-1 text-xs text-amber-500"><AlertCircle className="w-3 h-3" /> Pending</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-500"><CheckCircle className="w-3 h-3" /> Verified</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
