import React, { useState, useEffect, useRef } from 'react';
import { Send, User, MessageSquare, Mic, Square, Trash2 } from 'lucide-react';
import apiClient, { API_BASE } from '../api';

export default function Chats({ messages, user, onSendMessage, onDeleteMessage, isDarkMode }) {
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef(null);

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

  // Auto-scroll to bottom of chats
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    onSendMessage(newMessage);
    setNewMessage('');
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // If canceled, chunks will be empty
        if (audioChunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice.webm');
        
        try {
          const res = await apiClient.post('/chats/upload-audio', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          if (res.data.fileUrl) {
            onSendMessage(`[AUDIO_MESSAGE]:${res.data.fileUrl}`);
          }
        } catch (err) {
          console.error('Error uploading audio message:', err);
          alert('Failed to send voice message.');
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check your permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      // Stop all audio tracks in stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (isRecording) {
      audioChunksRef.current = [];
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
    }
  };

  // Format recording seconds to mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'text-brand-400 bg-brand-500/10 border-brand-500/25';
      case 'accountant': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
      case 'supervisor': return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/25';
    }
  };

  return (
    <div className={`p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'} flex flex-col h-[75vh]`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/10 mb-4 shrink-0">
        <div>
          <h2 className={`text-lg font-extrabold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            <MessageSquare className="w-5 h-5 text-brand-500" />
            <span>Enterprise SyncChannel</span>
          </h2>
          <p className="text-xs text-slate-500">Live communication channel with all logged-in supervisors & admins.</p>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${isDarkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-600 bg-emerald-500/5 border-emerald-500/25'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Real-time Sync Active</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
        {messages && messages.length > 0 ? (
          messages.map((msg, i) => {
            const isMe = msg.sender_id === user.id;
            const isAudio = msg.message.startsWith('[AUDIO_MESSAGE]:');

            return (
              <div key={msg.id || i} className={`flex gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-655'}`}>
                  <User className="w-4 h-4" />
                </div>

                <div className="space-y-1 relative group flex-1">
                  {/* Sender Details */}
                  <div className={`flex items-center gap-2 text-[10px] ${isMe ? 'justify-end' : ''}`}>
                    <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {isMe ? 'You' : msg.sender_name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded border text-[8px] font-black uppercase ${getRoleColor(msg.sender_role)}`}>
                      {msg.sender_role}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Bubble & Options wrapper */}
                  <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {/* Message Bubble */}
                    <div className={`p-3 rounded-2xl text-xs font-medium leading-relaxed break-words ${
                      isMe 
                        ? 'bg-gradient-to-tr from-brand-600 to-brand-500 text-white rounded-tr-none shadow-md' 
                        : (isDarkMode ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none' : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-none')
                    }`}>
                      {isAudio ? (
                        <div className="flex flex-col gap-1.5 min-w-[200px] sm:min-w-[250px]">
                          <span className="text-[10px] text-slate-400 block font-bold">🎤 Voice Note</span>
                          <audio 
                            controls 
                            src={`${API_BASE}${msg.message.replace('[AUDIO_MESSAGE]:', '')}`} 
                            className="w-full h-8 mt-1"
                          />
                        </div>
                      ) : (
                        msg.message
                      )}
                    </div>

                    {/* Delete Message button */}
                    {(isMe || user.role === 'admin') && (
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this message? This will also remove the recorded audio file.')) {
                            onDeleteMessage(msg.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-md"
                        title="Delete Message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <MessageSquare className="w-12 h-12 text-slate-600 mb-2 animate-bounce" style={{ animationDuration: '3s' }} />
            <p className="text-sm font-bold text-slate-400">No chat history</p>
            <p className="text-xs text-slate-500 mt-0.5">Send a message to start collaboration!</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="flex gap-2 shrink-0 items-center">
        {isRecording ? (
          <div className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-xl border border-rose-500/30 ${isDarkMode ? 'bg-rose-950/20' : 'bg-rose-50/50'} animate-pulse`}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
              <span className="text-xs font-bold text-rose-500">Recording Voice Note...</span>
              <span className={`text-xs font-mono font-bold ${isDarkMode ? 'text-slate-450' : 'text-slate-600'}`}>
                ({formatTime(recordingTime)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-1.5 rounded-lg hover:bg-slate-800/20 text-slate-500 hover:text-rose-500 transition-colors"
                title="Cancel Recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Square className="w-3 h-3 fill-white" />
                <span>Send Voice</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message here..."
              className={`flex-1 text-xs font-semibold rounded-xl px-4 py-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all ${isDarkMode ? 'bg-slate-950 border-slate-850 text-white placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
            />
            <button
              type="button"
              onClick={startRecording}
              className={`p-3 rounded-xl border transition-all flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-brand-400' : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-brand-650'}`}
              title="Record Voice Note"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>
            <button
              type="submit"
              className="p-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white shadow-lg hover:shadow-brand-500/20 transition-all flex items-center justify-center shrink-0"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </>
        )}
      </form>
    </div>
  );
}
