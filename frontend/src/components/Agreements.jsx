import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, BrainCircuit, CheckCircle, AlertCircle, Database } from 'lucide-react';
import apiClient from '../api';

export default function Agreements({ sites, user, isDarkMode }) {
  const [agreements, setAgreements] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [parsedResult, setParsedResult] = useState(null);

  const fetchAgreements = async () => {
    if (!selectedSiteId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/agreements?site_id=${selectedSiteId}`);
      setAgreements(res.data);
    } catch (err) {
      console.error('Failed to fetch agreements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, [selectedSiteId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedSiteId || !file) {
      return alert('Please select a site and a file.');
    }

    setUploading(true);
    setParsedResult(null);

    const formData = new FormData();
    formData.append('site_id', selectedSiteId);
    formData.append('agreement', file);

    try {
      const res = await apiClient.post('/agreements/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParsedResult(res.data);
      setFile(null);
      fetchAgreements();
    } catch (err) {
      alert('Failed to parse agreement. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black font-niyantraan flex items-center gap-3">
            <BrainCircuit className="w-8 h-8 text-brand-500" />
            AI Agreement Parser
          </h2>
          <p className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Upload PDF/DOCX contracts to auto-extract budgets and categories.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Upload Column */}
        <div className={`p-6 rounded-3xl border shadow-xl ${isDarkMode ? 'glass-card border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-500" /> Upload New Agreement
          </h3>
          
          <form onSubmit={handleUpload} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Project Site *</label>
              <select 
                value={selectedSiteId} 
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className={`w-full p-3 rounded-xl border focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                required
              >
                <option value="">-- Choose Site --</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.site_id})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contract File (PDF/DOCX) *</label>
              <div className={`p-8 border-2 border-dashed rounded-xl text-center transition-all hover:border-brand-500 ${isDarkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-300 bg-slate-50'} ${file ? 'border-brand-500 bg-brand-500/10' : ''}`}>
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="hidden"
                  id="agreement-upload"
                  required
                />
                <label htmlFor="agreement-upload" className="cursor-pointer flex flex-col items-center gap-3">
                  <FileText className={`w-10 h-10 ${file ? 'text-brand-500' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold">{file ? file.name : 'Click to browse contract file'}</span>
                  {!file && <span className="text-[10px] text-slate-500">Supports .pdf, .docx (Max 10MB)</span>}
                </label>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={uploading || !selectedSiteId || !file}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              {uploading ? (
                <span className="flex items-center gap-2 animate-pulse"><BrainCircuit className="w-5 h-5 animate-spin" /> Extracting Data with AI...</span>
              ) : (
                <><BrainCircuit className="w-5 h-5" /> Analyze & Extract Budgets</>
              )}
            </button>
          </form>

          {parsedResult && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-6 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 overflow-hidden"
            >
              <h4 className="text-emerald-500 font-bold mb-2 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> AI Extraction Successful</h4>
              <p className="text-sm text-slate-300 mb-4">The following budgets were automatically created in the database.</p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-emerald-500/20">
                  <span className="text-xs uppercase text-slate-400 font-bold">Total Construction Cost</span>
                  <span className="font-black text-lg text-emerald-400">₹{parsedResult.extractedTotal.toLocaleString()}</span>
                </div>
                
                {parsedResult.categories.map((cat, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm text-slate-300">{cat.category}</span>
                    <span className="font-bold text-sm">₹{cat.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* History Column */}
        <div className={`p-6 rounded-3xl border shadow-xl ${isDarkMode ? 'glass-card border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-500" /> Parsed Documents History
          </h3>
          
          {!selectedSiteId ? (
            <div className={`h-48 flex items-center justify-center p-8 rounded-2xl border border-dashed ${isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-400'}`}>
              Select a project site to view its parsed agreements.
            </div>
          ) : loading ? (
            <div className="h-48 flex items-center justify-center text-brand-500 font-bold animate-pulse">Loading documents...</div>
          ) : agreements.length === 0 ? (
            <div className={`h-48 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed ${isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-300 text-slate-400'}`}>
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <p>No parsed agreements found for this site.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agreements.map(agr => {
                const data = JSON.parse(agr.extracted_data || '{}');
                return (
                  <div key={agr.id} className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-brand-400">
                        <FileText className="w-4 h-4" />
                        <a href={`http://localhost:5000${agr.file_url}`} target="_blank" rel="noopener noreferrer" className="hover:underline">View Document</a>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{new Date(agr.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="text-xs text-slate-400 mb-3 border-b border-slate-800/50 pb-2">Uploaded by {agr.uploaded_by_name}</div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-1">Total Cost:</span>
                        <span className="font-bold text-emerald-400">₹{Number(agr.total_cost).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block mb-1">Extracted Categories:</span>
                        <span className="font-bold">{data.categories?.length || 0} items</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
