import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, DollarSign, Activity, Image as ImageIcon, CheckCircle, FileText, X } from 'lucide-react';
import ProjectTimeline from './ProjectTimeline';
import ClientBudgets from './ClientBudgets';
import PaymentTracker from './PaymentTracker';
import apiClient, { API_BASE } from '../api';

export default function ClientPortal({ user, sites = [], expenses = [], isDarkMode }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  const openGallery = async (siteId) => {
    setGalleryOpen(true);
    setGalleryLoading(true);
    setGalleryImages([]);
    try {
      const res = await apiClient.get(`/daily-updates?site_id=${siteId}`);
      let imgs = [];
      res.data.forEach(update => {
        if (update.media_urls) update.media_urls.split(',').forEach(url => imgs.push(url));
      });
      const resTime = await apiClient.get(`/project-timeline/${siteId}`);
      resTime.data.forEach(t => {
        if (t.attachments && !t.attachments.includes('.webm')) {
          t.attachments.split(',').forEach(url => imgs.push(url));
        }
      });
      setGalleryImages([...new Set(imgs)]);
    } catch (e) {
      console.error(e);
    } finally {
      setGalleryLoading(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        setGalleryOpen(false);
      }
    };
    if (galleryOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [galleryOpen]);

  const downloadReport = (site, expenses) => {
    const siteExpenses = expenses.filter(e => e.site_id === site.id);
    let csv = 'Date,Category,Description,Amount (INR)\n';
    siteExpenses.forEach(e => {
      csv += `"${new Date(e.date_time).toLocaleDateString()}","${e.category}","${e.description}",${e.amount}\n`;
    });
    csv += `\nTotal Budget,${site.budget}\nTotal Spent,${siteExpenses.reduce((s, e) => s + Number(e.amount), 0)}\nProject Progress,${site.progress_percent}%\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${site.name.replace(/\s+/g, '_')}_Financial_Report.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black font-niyantraan">Client Portal</h2>
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Welcome back, {user?.name}. Here is your project overview.</p>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className={`p-8 rounded-2xl text-center border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>No projects assigned to you yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {sites.map(site => {
            const siteExpenses = expenses.filter(e => e.site_id === site.id);
            const totalSpent = siteExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
            const budgetProgress = site.budget > 0 ? (totalSpent / site.budget) * 100 : 0;
            
            return (
              <motion.div 
                key={site.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-3xl border shadow-xl ${isDarkMode ? 'glass-card border-slate-800' : 'glass-card-light border-slate-200'}`}
              >
                <div className="flex justify-between items-start mb-6 border-b pb-4 border-slate-800/20">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-brand-500" />
                      {site.name}
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{site.location}</p>
                  </div>
                  <span className="px-3 py-1 bg-brand-500/20 text-brand-400 text-xs font-bold rounded-full uppercase tracking-wider">
                    {site.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold">Progress</h4>
                    </div>
                    <div className="text-2xl font-black mb-1">{site.progress_percent}%</div>
                    <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-2">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${site.progress_percent}%` }}></div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-brand-500/20 text-brand-400 rounded-xl">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold">Budget Tracker</h4>
                    </div>
                    <div className="text-2xl font-black mb-1">₹{totalSpent.toLocaleString()}</div>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>of ₹{Number(site.budget).toLocaleString()}</p>
                    <div className="w-full bg-slate-800/50 rounded-full h-1.5 mt-2">
                      <div className={`h-1.5 rounded-full ${budgetProgress > 90 ? 'bg-rose-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(budgetProgress, 100)}%` }}></div>
                    </div>
                  </div>
                  
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'} flex flex-col justify-center`}>
                     <button 
                        onClick={() => openGallery(site.id)}
                        className="flex items-center gap-2 justify-center w-full py-2 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 font-bold rounded-xl transition-colors mb-2"
                     >
                        <ImageIcon className="w-4 h-4" />
                        View Site Gallery
                     </button>
                     <button 
                        onClick={() => downloadReport(site, expenses)}
                        className="flex items-center gap-2 justify-center w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold rounded-xl transition-colors"
                     >
                        <FileText className="w-4 h-4" />
                        Download Reports
                     </button>
                  </div>
                </div>

                <ClientBudgets siteId={site.id} isDarkMode={isDarkMode} />
                
                <PaymentTracker siteId={site.id} user={user} totalBudget={site.budget} isDarkMode={isDarkMode} />

                <div className="mt-8">
                  <ProjectTimeline siteId={site.id} user={user} isDarkMode={isDarkMode} />
                </div>

              </motion.div>
            );
          })}
        </div>
      )}

      {/* Gallery Modal */}
      {galleryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className={`w-full max-w-4xl max-h-[80vh] flex flex-col rounded-3xl shadow-2xl ${isDarkMode ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="text-lg font-bold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-brand-500" /> Project Media Gallery</h3>
              <button onClick={() => setGalleryOpen(false)} className="px-4 py-2 flex items-center gap-2 rounded-xl bg-slate-500/10 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 font-bold transition-colors">
                <X className="w-4 h-4" />
                Close (ESC)
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {galleryLoading ? (
                <div className="text-center text-slate-500 animate-pulse py-10 font-bold">Compiling Media Gallery...</div>
              ) : galleryImages.length === 0 ? (
                <div className="text-center text-slate-500 py-10">No photos or videos uploaded for this project yet.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {galleryImages.map((img, idx) => (
                    <a key={idx} href={`${API_BASE}${img}`} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-500 transition-all shadow-md">
                      <img src={`${API_BASE}${img}`} alt="Site Progress" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
