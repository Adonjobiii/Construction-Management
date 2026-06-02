import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Upload, Image as ImageIcon, Send, Activity } from 'lucide-react';
import apiClient from '../api';

export default function DailyUpdates({ sites, user, isDarkMode }) {
  const [updates, setUpdates] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [workCompleted, setWorkCompleted] = useState('');
  const [notes, setNotes] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Comments State
  const [commentText, setCommentText] = useState({});
  const [commentLoading, setCommentLoading] = useState({});

  const fetchUpdates = async () => {
    setLoading(true);
    try {
      const url = selectedSiteId ? `/daily-updates?site_id=${selectedSiteId}` : '/daily-updates';
      const res = await apiClient.get(url);
      setUpdates(res.data);
    } catch (err) {
      console.error('Failed to fetch updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [selectedSiteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSiteId || !workCompleted) return alert('Site and work completed are required.');

    setSubmitLoading(true);
    const formData = new FormData();
    formData.append('site_id', selectedSiteId);
    formData.append('update_date', date);
    formData.append('work_completed', workCompleted);
    formData.append('notes', notes);
    
    Array.from(mediaFiles).forEach(file => {
      formData.append('media', file);
    });

    try {
      await apiClient.post('/daily-updates', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setWorkCompleted('');
      setNotes('');
      setMediaFiles([]);
      alert('Daily update submitted successfully!');
      fetchUpdates();
    } catch (err) {
      alert('Failed to submit update');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCommentSubmit = async (updateId) => {
    if (!commentText[updateId]) return;
    setCommentLoading({ ...commentLoading, [updateId]: true });
    try {
      await apiClient.post(`/daily-updates/${updateId}/comments`, { text: commentText[updateId] });
      setCommentText({ ...commentText, [updateId]: '' });
      fetchUpdates();
    } catch (err) {
      alert('Failed to submit comment');
    } finally {
      setCommentLoading({ ...commentLoading, [updateId]: false });
    }
  };

  const availableSites = user?.role === 'admin'  
    ? sites 
    : sites.filter(s => s.assigned_supervisor_id === user?.id || s.assigned_client_id === user?.id || (user?.site_access && user.site_access.includes(s.site_id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black font-niyantraan flex items-center gap-3">
            <Activity className="w-8 h-8 text-brand-500" />
            Daily Site Updates
          </h2>
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Log daily progress, upload site images, and notify clients instantly.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Column (Hidden for Clients) */}
        {user?.role !== 'client' && (
        <div className={`lg:col-span-1 p-6 rounded-3xl border ${isDarkMode ? 'glass-card border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-500" />
            New Update Log
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project Site *</label>
              <select 
                value={selectedSiteId} 
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                required
              >
                <option value="">-- Choose Site --</option>
                {availableSites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Update Date *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full p-3 pl-10 rounded-xl border focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Work Completed Today *</label>
              <textarea 
                value={workCompleted}
                onChange={(e) => setWorkCompleted(e.target.value)}
                rows={4}
                className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                placeholder="- Putty work completed&#10;- Tiles delivered..."
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Internal Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                placeholder="Optional notes for admins/accountants..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Upload Media (Max 5)</label>
              <div className={`p-4 border-2 border-dashed rounded-xl text-center ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-300 bg-slate-50'}`}>
                <input 
                  type="file" 
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => setMediaFiles(e.target.files)}
                  className="hidden"
                  id="media-upload"
                />
                <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                  <span className="text-xs text-brand-500 font-bold hover:underline">Click to browse files</span>
                  <span className="text-[10px] text-slate-500">{mediaFiles.length} files selected</span>
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitLoading || !selectedSiteId}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {submitLoading ? 'Uploading...' : <><Send className="w-4 h-4" /> Submit Update</>}
            </button>
          </form>
        </div>
        )}

        {/* History Column */}
        <div className={user?.role === 'client' ? 'lg:col-span-3' : 'lg:col-span-2'}>
          {loading ? (
            <div className="text-center p-8 text-brand-500 font-bold animate-pulse">Loading updates...</div>
          ) : updates.length === 0 ? (
            <div className={`p-8 rounded-2xl border text-center ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-slate-500">No daily updates recorded yet.</p>
            </div>
          ) : (
              <div className="space-y-4">
                {updates.map(update => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={update.id} 
                    className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-xs text-brand-500 font-bold mb-1">{new Date(update.update_date).toLocaleDateString()}</div>
                        <div className="text-sm text-slate-500">Logged by <span className="font-bold text-slate-300">{update.supervisor_name}</span></div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Work Completed</h4>
                      <div className="whitespace-pre-line text-sm">{update.work_completed}</div>
                    </div>

                    {update.notes && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
                        <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Internal Notes</h4>
                        <div className="text-amber-200/80">{update.notes}</div>
                      </div>
                    )}

                    {update.media_urls && (
                      <div className="mt-4 pt-4 border-t border-slate-800/30">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Attached Media</h4>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {update.media_urls.split(',').map((url, i) => (
                            <img key={i} src={`http://localhost:5000${url}`} alt="Site Progress" className="w-24 h-24 object-cover rounded-xl border border-slate-700" />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Comments Section */}
                    <div className="mt-4 pt-4 border-t border-slate-800/30">
                      <h4 className="text-xs font-bold text-brand-500 uppercase tracking-wider mb-3">Feedback & Comments</h4>
                      <div className="space-y-3 mb-3">
                        {(() => {
                          try {
                            const comments = JSON.parse(update.comments || '[]');
                            if (comments.length === 0) return <div className="text-xs text-slate-500">No comments yet.</div>;
                            return comments.map((c, idx) => (
                              <div key={idx} className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[10px] font-bold text-slate-400">{c.user_name} ({c.user_role})</span>
                                  <span className="text-[10px] text-slate-500">{new Date(c.date).toLocaleDateString()}</span>
                                </div>
                                <div className="text-xs">{c.text}</div>
                              </div>
                            ));
                          } catch (e) {
                            return <div className="text-xs text-slate-500">No comments yet.</div>;
                          }
                        })()}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={commentText[update.id] || ''}
                          onChange={(e) => setCommentText({ ...commentText, [update.id]: e.target.value })}
                          placeholder="Add a reply or suggestion..."
                          className={`flex-1 text-xs p-2 rounded-lg border focus:ring-1 focus:ring-brand-500 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-300'}`}
                        />
                        <button
                          onClick={() => handleCommentSubmit(update.id)}
                          disabled={commentLoading[update.id] || !commentText[update.id]}
                          className="px-3 py-2 bg-brand-500 hover:bg-brand-400 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                        >
                          {commentLoading[update.id] ? '...' : 'Reply'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
          )}
        </div>

      </div>
    </div>
  );
}
