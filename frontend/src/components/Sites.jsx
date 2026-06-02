import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  MapPin, 
  Calendar, 
  DollarSign, 
  User, 
  Plus, 
  Edit2, 
  Trash2, 
  Briefcase, 
  CheckCircle,
  X,
  TrendingUp,
  MessageSquare,
  CreditCard
} from 'lucide-react';
import apiClient from '../api';
import ProjectTimeline from './ProjectTimeline';
import PaymentTracker from './PaymentTracker';

export default function Sites({ sites, supervisors, clients, user, onRefresh, isDarkMode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [activeSiteForTimeline, setActiveSiteForTimeline] = useState(null);
  const [paymentModalSite, setPaymentModalSite] = useState(null);
  const [editSite, setEditSite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [siteId, setSiteId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [projectType, setProjectType] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [clientId, setClientId] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [status, setStatus] = useState('planning');
  const [progressPercent, setProgressPercent] = useState(0);

  const openAddModal = () => {
    setEditSite(null);
    setSiteId('');
    setName('');
    setLocation('');
    setProjectType('');
    setSupervisorId('');
    setClientId('');
    setBudget('');
    setStartDate('');
    setCompletionDate('');
    setStatus('planning');
    setProgressPercent(0);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (site) => {
    setEditSite(site);
    setSiteId(site.site_id);
    setName(site.name);
    setLocation(site.location);
    setProjectType(site.project_type);
    setSupervisorId(site.assigned_supervisor_id || '');
    setClientId(site.assigned_client_id || '');
    setBudget(site.budget);
    setStartDate(site.start_date.split('T')[0]);
    setCompletionDate(site.completion_date.split('T')[0]);
    setStatus(site.status);
    setProgressPercent(site.progress_percent);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      name,
      location,
      project_type: projectType,
      assigned_supervisor_id: supervisorId ? parseInt(supervisorId) : null,
      assigned_client_id: clientId ? parseInt(clientId) : null,
      budget: parseFloat(budget),
      start_date: startDate,
      completion_date: completionDate,
      status,
      progress_percent: parseInt(progressPercent)
    };

    try {
      if (editSite) {
        // Edit Site
        // If supervisor is editing, only send status and progress
        if (user.role !== 'admin') {
          await apiClient.put(`/sites/${editSite.id}`, {
            status,
            progress_percent: parseInt(progressPercent)
          });
        } else {
          await apiClient.put(`/sites/${editSite.id}`, {
            ...payload,
            site_id: siteId // Admin can update all
          });
        }
      } else {
        // Add Site
        await apiClient.post('/sites', {
          ...payload,
          site_id: siteId
        });
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save site details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this construction site? This will delete all associated expenses.')) return;
    try {
      await apiClient.delete(`/sites/${id}`);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete site.');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const getStatusColor = (st) => {
    switch (st) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'in-progress': return 'bg-brand-500/10 text-brand-400 border-brand-500/30';
      case 'on-hold': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default: return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Project Sites
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure site details, supervisors, track completion rate and budgets.
          </p>
        </div>

        {user.role === 'admin' && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Site</span>
          </button>
        )}
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites && sites.length > 0 ? (
          sites.map((site, i) => {
            const isAssignedSupervisor = site.assigned_supervisor_id === user.id;
            const canEdit = user.role === 'admin' || isAssignedSupervisor;

            return (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'} relative overflow-hidden group hover:scale-[1.01] transition-all duration-300`}
              >
                {/* Status indicator */}
                <div className="flex justify-between items-start gap-2 mb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Site ID: {site.site_id}</span>
                    <h3 className={`text-lg font-bold tracking-tight leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{site.name}</h3>
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${getStatusColor(site.status)} capitalize`}>
                    {site.status}
                  </span>
                </div>

                <div className="space-y-3 mt-4 text-xs font-semibold text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{site.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-500" />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>{site.project_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                      Supervisor: <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{site.supervisor_name || 'Unassigned'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                      Client: <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{site.client_name || 'Unassigned'}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-500" />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                      Budget: <strong className="text-emerald-500">{formatCurrency(site.budget)}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                      Timeline: {new Date(site.start_date).toLocaleDateString()} - {new Date(site.completion_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold">
                    <span className="text-slate-500">Progress</span>
                    <span className={isDarkMode ? 'text-slate-300' : 'text-slate-900'}>{site.progress_percent}%</span>
                  </div>
                  <div className={`w-full h-2 rounded-full ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200'} overflow-hidden`}>
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                      style={{ width: `${site.progress_percent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Action buttons */}
                {canEdit && (
                  <div className={`flex gap-2 justify-end mt-6 pt-4 border-t ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200/80'}`}>
                    <button
                      onClick={() => setPaymentModalSite(site)}
                      className="p-2 rounded-xl text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                      title="Manage Payments"
                    >
                      <CreditCard className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(site)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{user.role === 'admin' ? 'Edit' : 'Update'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveSiteForTimeline(site);
                        setIsTimelineOpen(true);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Timeline</span>
                    </button>
                    {user.role === 'admin' && (
                      <button
                        onClick={() => handleDelete(site.id)}
                        className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center text-slate-500 glass rounded-3xl border border-slate-800">
            <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-400">No Construction Sites Registered</h3>
            <p className="text-xs text-slate-500 mt-1">Please configure project locations first.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl overflow-y-auto max-h-[90vh] ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">
                  {editSite ? (user.role === 'admin' ? 'Modify Construction Site' : 'Update Project Progress') : 'Register Construction Site'}
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
                {/* Admin fields */}
                {user.role === 'admin' ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Site ID / Code</label>
                        <input
                          type="text"
                          value={siteId}
                          onChange={(e) => setSiteId(e.target.value)}
                          disabled={!!editSite}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white disabled:opacity-40' : 'bg-slate-50 border-slate-200 text-slate-900 disabled:opacity-50'}`}
                          placeholder="e.g. BLD-001"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Site Name</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          placeholder="e.g. Oceanfront Towers"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Location</label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          placeholder="e.g. Mumbai, Maharashtra"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Type</label>
                        <input
                          type="text"
                          value={projectType}
                          onChange={(e) => setProjectType(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          placeholder="e.g. Commercial High-rise"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assign Supervisor</label>
                        <select
                          value={supervisorId}
                          onChange={(e) => setSupervisorId(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        >
                          <option value="">Unassigned</option>
                          {supervisors.map(sup => (
                            <option key={sup.id} value={sup.id}>[Sys ID: {sup.id}] {sup.name} ({sup.login_id})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assign Client</label>
                        <select
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        >
                          <option value="">Unassigned</option>
                          {clients?.map(c => (
                            <option key={c.id} value={c.id}>[Sys ID: {c.id}] {c.name} ({c.login_id})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Budget (INR)</label>
                        <input
                          type="number"
                          value={budget}
                          onChange={(e) => setBudget(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          placeholder="e.g. 5000000"
                          min="0"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Completion Date</label>
                        <input
                          type="date"
                          value={completionDate}
                          onChange={(e) => setCompletionDate(e.target.value)}
                          className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          required
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {/* Shared status / progress fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    >
                      <option value="planning">Planning</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="on-hold">On Hold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Progress percent (%)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={progressPercent}
                        onChange={(e) => setProgressPercent(e.target.value)}
                        className="w-full accent-brand-500 cursor-pointer"
                      />
                      <span className="text-xs font-black min-w-[32px]">{progressPercent}%</span>
                    </div>
                  </div>
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
                      <span>Save details</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Timeline Modal */}
      <AnimatePresence>
        {isTimelineOpen && activeSiteForTimeline && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border`}
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-800/20">
                <h3 className="text-lg font-black tracking-tight">
                  Timeline: {activeSiteForTimeline.name}
                </h3>
                <button
                  onClick={() => setIsTimelineOpen(false)}
                  className={`p-1 rounded-lg transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-slate-950/50">
                <ProjectTimeline siteId={activeSiteForTimeline.id} user={user} isDarkMode={isDarkMode} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Payment Tracker Modal */}
      <AnimatePresence>
        {paymentModalSite && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border`}
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-800/20">
                <h3 className="text-lg font-black tracking-tight">
                  Payments: {paymentModalSite.name}
                </h3>
                <button
                  onClick={() => setPaymentModalSite(null)}
                  className={`p-1 rounded-lg transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 bg-slate-950/50">
                <PaymentTracker siteId={paymentModalSite.id} user={user} totalBudget={paymentModalSite.budget} isDarkMode={isDarkMode} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
