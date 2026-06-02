import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, FileText, CheckCircle, AlertCircle, MessageSquare, Image as ImageIcon, Mic, Square, Trash2 } from 'lucide-react';
import apiClient, { API_BASE } from '../api';
import { io } from 'socket.io-client';

export default function ProjectTimeline({ siteId, user, isDarkMode }) {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  const fetchTimeline = async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/project-timeline/${siteId}`);
      setTimeline(res.data.reverse()); // Oldest first for chat-like view
    } catch (err) {
      console.error('Failed to fetch timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
    
    // Socket real-time updates
    const socket = io(API_BASE);
    socket.emit('join_site_room', siteId);
    
    socket.on('timeline_update', (newEntry) => {
      if (Number(newEntry.site_id) === Number(siteId)) {
        setTimeline(prev => [...prev, newEntry]);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    });

    return () => {
      socket.disconnect();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [siteId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');
        try {
          const res = await apiClient.post('/chats/upload-audio', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (res.data.fileUrl) {
            const fd = new FormData();
            fd.append('site_id', siteId);
            fd.append('description', `[AUDIO_MESSAGE]:${res.data.fileUrl}`);
            fd.append('event_type', 'comment');
            await apiClient.post('/project-timeline', fd);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        } catch (err) {
          alert('Failed to send voice message.');
        }
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (isRecording) {
      audioChunksRef.current = [];
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(t => t.stop());
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  const formatTime = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message && attachments.length === 0) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('site_id', siteId);
    formData.append('description', message);
    formData.append('event_type', 'comment');
    
    Array.from(attachments).forEach(f => formData.append('attachments', f));

    try {
      await apiClient.post('/project-timeline', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage('');
      setAttachments([]);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      alert('Failed to post to timeline');
    } finally {
      setSubmitting(false);
    }
  };

  const getEventIcon = (type) => {
    switch(type) {
      case 'progress': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'issue': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'approval': return <FileText className="w-4 h-4 text-amber-500" />;
      default: return <MessageSquare className="w-4 h-4 text-brand-500" />;
    }
  };

  return (
    <div className={`flex flex-col h-[600px] rounded-3xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'}`}>
        <h3 className="font-bold flex items-center gap-2">Project Activity Timeline</h3>
        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider px-3 py-1 bg-brand-500/10 text-brand-400 rounded-lg">Centralized Collaboration</span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-slate-500 animate-pulse mt-10">Loading timeline...</div>
        ) : timeline.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">No activities recorded yet.</div>
        ) : (
          timeline.map((entry, idx) => {
            const isMe = entry.user_id === user.id;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={entry.id || idx} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[80%] rounded-2xl p-4 ${
                  isMe 
                    ? (isDarkMode ? 'bg-brand-600 text-white' : 'bg-brand-500 text-white')
                    : (isDarkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800')
                }`}>
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <div className="bg-white/20 p-1 rounded-md">{getEventIcon(entry.event_type)}</div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{entry.user_name} ({entry.user_role})</span>
                    <span className="text-[10px] opacity-60 ml-auto">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  
                  {entry.description.startsWith('[AUDIO_MESSAGE]:') ? (
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                      <span className="text-[10px] font-bold block opacity-80">🎤 Voice Note</span>
                      <audio controls src={`${API_BASE}${entry.description.replace('[AUDIO_MESSAGE]:', '')}`} className="w-full h-8 mt-1" />
                    </div>
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{entry.description}</div>
                  )}
                  
                  {entry.attachments && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex gap-2 overflow-x-auto">
                      {entry.attachments.split(',').map((url, i) => (
                        <a key={i} href={`http://localhost:5000${url}`} target="_blank" rel="noopener noreferrer">
                          <img src={`http://localhost:5000${url}`} alt="Attachment" className="h-16 w-16 object-cover rounded-lg border border-white/20 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={scrollRef}></div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className={`p-4 border-t shrink-0 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        {isRecording ? (
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border border-rose-500/30 ${isDarkMode ? 'bg-rose-950/20' : 'bg-rose-50/50'} animate-pulse`}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-xs font-bold text-rose-500">Recording Voice Note...</span>
              <span className={`text-xs font-mono font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                ({formatTime(recordingTime)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={cancelRecording} className="p-2 rounded-lg hover:bg-slate-800/20 text-slate-500 hover:text-rose-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
              <button type="button" onClick={stopRecording} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2">
                <Square className="w-3 h-3 fill-white" /> Send
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Post a comment, update, or approval..."
                rows={2}
                className={`w-full p-3 pr-12 rounded-xl border focus:ring-2 focus:ring-brand-500 transition-all resize-none ${isDarkMode ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300'}`}
              />
              <label className="absolute right-3 bottom-3 cursor-pointer p-1.5 rounded-lg hover:bg-brand-500/20 text-brand-500 transition-colors">
                <ImageIcon className="w-5 h-5" />
                <input type="file" multiple className="hidden" onChange={(e) => setAttachments(e.target.files)} />
              </label>
            </div>
            <button
              type="button"
              onClick={startRecording}
              className={`p-4 rounded-xl border transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-brand-400' : 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-brand-600'}`}
            >
              <Mic className="w-5 h-5" />
            </button>
            <button 
              type="submit" 
              disabled={submitting || (!message && attachments.length === 0)}
              className="bg-brand-500 hover:bg-brand-400 text-white p-4 rounded-xl disabled:opacity-50 transition-colors shadow-lg"
            >
              {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send className="w-5 h-5" />}
            </button>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="mt-2 text-xs text-brand-400 font-bold">{attachments.length} files attached</div>
        )}
      </form>
    </div>
  );
}
