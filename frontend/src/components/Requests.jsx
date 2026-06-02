import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, 
  Plus, 
  Check, 
  X, 
  MessageSquare, 
  Paperclip, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Hourglass,
  Building2,
  User,
  Eye
} from 'lucide-react';
import apiClient, { API_BASE } from '../api';

export default function Requests({ requests, sites, user, onRefresh, isDarkMode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Submit Request Form
  const [type, setType] = useState('material');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState('');
  const [attachment, setAttachment] = useState(null);

  // Process Request Form
  const [status, setStatus] = useState('approved');
  const [reply, setReply] = useState('');

  const openAddModal = () => {
    setType('material');
    setTitle('');
    setDescription('');
    setSiteId(sites[0]?.id || '');
    setAttachment(null);
    setError('');
    setIsModalOpen(true);
  };

  const openProcessModal = (req) => {
    setActiveRequest(req);
    setStatus('approved');
    setReply('');
    setError('');
    setIsProcessModalOpen(true);
  };

  const handleFileChange = (e) => {
    setAttachment(e.target.files[0]);
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('type', type);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('site_id', siteId);
    if (attachment) {
      formData.append('attachment', attachment);
    }

    try {
      await apiClient.post('/requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiClient.put(`/requests/${activeRequest.id}`, {
        status,
        reply
      });
      setIsProcessModalOpen(false);
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update request status.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (st) => {
    switch (st) {
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-rose-400" />;
      default: return <Hourglass className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />;
    }
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'approved': return 'bg-emerald-550/10 text-emerald-400 border-emerald-500/20';
      case 'rejected': return 'bg-rose-550/10 text-rose-400 border-rose-500/20';
      default: return 'bg-amber-550/10 text-amber-400 border-amber-500/20';
    }
  };

  const getTypeLabel = (t) => {
    switch (t) {
      case 'material': return 'Material Request';
      case 'labour': return 'Workforce/Labour';
      case 'update': return 'Progress Update';
      case 'issue': return 'Urgent Issue';
      default: return t;
    }
  };

  const getTypeColor = (t) => {
    switch (t) {
      case 'material': return 'bg-brand-500/10 text-brand-400 border-brand-500/20';
      case 'labour': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'update': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'issue': return 'bg-rose-550/10 text-rose-400 border-rose-550/20 animate-pulse';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Requests & Site Updates
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Supervisors can request labor, materials, and file reports. Admins can audit and respond.
          </p>
        </div>

        {user.role === 'supervisor' && (
          <button
            onClick={openAddModal}
            disabled={sites.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Update/Request</span>
          </button>
        )}
      </div>

      {/* Requests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {requests && requests.length > 0 ? (
          requests.map((req, i) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={`p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'} flex flex-col justify-between`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-4">
                  <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full border ${getTypeColor(req.type)}`}>
                    {getTypeLabel(req.type)}
                  </span>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-full border capitalize ${getStatusBadge(req.status)}`}>
                    {getStatusIcon(req.status)}
                    <span>{req.status}</span>
                  </div>
                </div>

                <h3 className={`text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{req.title}</h3>
                <p className={`text-xs mt-2 leading-relaxed ${isDarkMode ? 'text-slate-450' : 'text-slate-500'}`}>{req.description}</p>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800/20 text-xs font-semibold text-slate-450">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span className="truncate">{req.site_name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" />
                    <span className="truncate">By: {req.submitted_by_name || 'Supervisor'}</span>
                  </div>
                </div>

                {req.attachment_url && (
                  <div className="mt-4">
                    <a
                      href={`${API_BASE}${req.attachment_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-2 text-xs font-bold py-1.5 px-3 rounded-lg border transition-all ${isDarkMode ? 'border-slate-800 hover:bg-slate-900 text-brand-400' : 'border-slate-200 hover:bg-slate-50 text-brand-500'}`}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>View Attached File</span>
                      <Eye className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}

                {req.reply && (
                  <div className={`mt-4 p-3 rounded-xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100/60 border-slate-200'}`}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>Admin Reply:</span>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-slate-350' : 'text-slate-650'}`}>{req.reply}</p>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              {user.role === 'admin' && req.status === 'pending' && (
                <div className="mt-6 pt-4 border-t border-slate-800/20 flex justify-end">
                  <button
                    onClick={() => openProcessModal(req)}
                    className="flex items-center gap-1.5 text-xs font-bold py-2 px-4 rounded-xl bg-brand-500 hover:bg-brand-650 text-white shadow-lg hover:shadow-brand-500/25 transition-all"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Review & Respond</span>
                  </button>
                </div>
              )}
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-16 text-center text-slate-500 glass rounded-3xl border border-slate-800">
            <ClipboardList className="w-12 h-12 mx-auto text-slate-650 mb-3" />
            <h3 className="text-base font-bold text-slate-400">No requests submitted</h3>
            <p className="text-xs text-slate-500 mt-1">Supervisors will submit tickets when support or materials are needed.</p>
          </div>
        )}
      </div>

      {/* Add Request Modal (Supervisor) */}
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
                <h3 className="text-lg font-black tracking-tight">Submit Site Update or Request</h3>
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

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Request Type</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    >
                      <option value="material">Material Request</option>
                      <option value="labour">Workforce / Labor</option>
                      <option value="update">Daily Site Update</option>
                      <option value="issue">Urgent Site Issue</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Site</label>
                    <select
                      value={siteId}
                      onChange={(e) => setSiteId(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      required
                    >
                      {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Title / Subject</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    placeholder="e.g. Requesting 5 tons Sand or Reinforcement issues"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description & Explanation</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="3"
                    className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    placeholder="Provide details about materials, quantities, urgency, or description of problems."
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Attach Photo / Invoice Doc</label>
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
                      <span>Submit ticket</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Process Request Modal (Admin Action) */}
      <AnimatePresence>
        {isProcessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">Process Request</h3>
                <button
                  onClick={() => setIsProcessModalOpen(false)}
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

              <form onSubmit={handleProcessRequest} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Action Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  >
                    <option value="approved">Approve / Authorize</option>
                    <option value="rejected">Reject / Discard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Reply message / Notes</label>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows="3"
                    className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    placeholder="Provide reasoning, instructions or update summary details..."
                    required
                  />
                </div>

                <div className="pt-4 border-t border-slate-800/20 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsProcessModalOpen(false)}
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
                      <span>Submit Action</span>
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
