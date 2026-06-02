import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { CreditCard, CheckCircle, PlusCircle, AlertCircle, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PaymentTracker({ siteId, user, totalBudget, isDarkMode }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Admin Form States
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isAdhoc, setIsAdhoc] = useState(false);
  
  // Payment processing states
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/sites/${siteId}/payments`);
      setPayments(res.data);
    } catch (err) {
      console.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [siteId]);

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (!title || !amount) return;
    try {
      await apiClient.post(`/sites/${siteId}/payments`, {
        title, expected_amount: amount, due_date: dueDate, is_adhoc: isAdhoc
      });
      setTitle(''); setAmount(''); setDueDate(''); setIsAdhoc(false);
      fetchPayments();
    } catch (err) {
      alert('Failed to schedule payment');
    }
  };

  const handleMarkPaid = async (paymentId) => {
    if (!payAmount) return;
    try {
      await apiClient.put(`/sites/${siteId}/payments/${paymentId}`, {
        paid_amount: payAmount,
        payment_date: payDate,
        status: 'paid'
      });
      setPayingId(null);
      setPayAmount('');
      fetchPayments();
    } catch (err) {
      alert('Failed to record payment');
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const remainingBalance = totalBudget - totalPaid;
  const isAdmin = user?.role === 'admin' || user?.role === 'accountant';

  if (loading) return <div className="text-center p-4 text-slate-500 animate-pulse">Loading payment schedules...</div>;

  return (
    <div className={`mt-8 p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-800/20 pb-4">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-500" />
            Payment Schedules & Installments
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Track construction intervals and ad-hoc payments.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Paid</div>
            <div className="text-lg font-black text-emerald-500">₹{totalPaid.toLocaleString()}</div>
          </div>
          <div className="w-px h-8 bg-slate-800/30"></div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Remaining Balance</div>
            <div className="text-lg font-black text-brand-500">₹{remainingBalance.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={handleAddSchedule} className={`mb-8 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'} grid grid-cols-1 md:grid-cols-5 gap-4 items-end`}>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Stage / Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Foundation Complete" className={`w-full p-2.5 rounded-xl border focus:ring-1 focus:ring-brand-500 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Expected ₹ *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="Amount" className={`w-full p-2.5 rounded-xl border focus:ring-1 focus:ring-brand-500 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={`w-full p-2.5 rounded-xl border focus:ring-1 focus:ring-brand-500 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
          </div>
          <button type="submit" className="w-full flex items-center justify-center gap-2 p-2.5 bg-brand-500 hover:bg-brand-400 text-white font-bold rounded-xl text-sm transition-colors">
            <PlusCircle className="w-4 h-4" /> Add
          </button>
          <div className="md:col-span-5 flex items-center gap-2 mt-2">
            <input type="checkbox" id="isAdhoc" checked={isAdhoc} onChange={e => setIsAdhoc(e.target.checked)} className="rounded border-slate-700 text-brand-500" />
            <label htmlFor="isAdhoc" className="text-xs font-bold text-slate-500 cursor-pointer">Mark as Ad-hoc / Unscheduled Payment</label>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {payments.length === 0 ? (
          <div className="text-center p-8 text-slate-500 font-bold border border-dashed border-slate-700 rounded-2xl">No payment stages scheduled yet.</div>
        ) : (
          payments.map(p => {
            const isPaid = p.status === 'paid';
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-2xl border ${isPaid ? (isDarkMode ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : (isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200')}`}>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{p.title}</h4>
                      {p.is_adhoc === 1 && <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase">Ad-hoc</span>}
                      {isPaid ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase px-2 py-0.5 bg-emerald-500/10 rounded-md"><CheckCircle className="w-3 h-3" /> Paid</span> : <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase px-2 py-0.5 bg-amber-500/10 rounded-md"><AlertCircle className="w-3 h-3" /> Pending</span>}
                    </div>
                    {p.due_date && !isPaid && <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Due by: {new Date(p.due_date).toLocaleDateString()}</div>}
                    {isPaid && p.payment_date && <div className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Paid on: {new Date(p.payment_date).toLocaleDateString()}</div>}
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-400 line-through decoration-rose-500/50 decoration-2">Expected: ₹{Number(p.expected_amount).toLocaleString()}</div>
                    {isPaid ? (
                      <div className="text-xl font-black text-emerald-500">₹{Number(p.paid_amount).toLocaleString()}</div>
                    ) : (
                      isAdmin && payingId !== p.id && (
                        <button onClick={() => { setPayingId(p.id); setPayAmount(p.expected_amount); }} className="px-3 py-1.5 mt-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 font-bold rounded-lg text-xs transition-colors">
                          Record Payment
                        </button>
                      )
                    )}
                  </div>
                </div>

                {isAdmin && payingId === p.id && (
                  <div className="mt-4 pt-4 border-t border-emerald-500/20 flex gap-2 items-center">
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Actual amount paid" className={`flex-1 p-2 rounded-lg border focus:ring-1 focus:ring-emerald-500 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`} />
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={`p-2 rounded-lg border focus:ring-1 focus:ring-emerald-500 text-sm ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`} />
                    <button onClick={() => handleMarkPaid(p.id)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-xs">Confirm</button>
                    <button onClick={() => setPayingId(null)} className="px-4 py-2 bg-slate-500/10 text-slate-500 font-bold rounded-lg text-xs">Cancel</button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
