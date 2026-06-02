import React from 'react';
import { Clock, ShieldAlert, User } from 'lucide-react';

export default function AuditLogs({ logs, isDarkMode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Security Audit Trails
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Historical timeline of database writes, logins, project modifications and security compliance events.
        </p>
      </div>

      <div className={`overflow-x-auto rounded-3xl border ${isDarkMode ? 'glass border-slate-800/80 shadow-2xl' : 'glass-light border-slate-200/80 shadow-lg'}`}>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className={`border-b font-bold text-slate-400 ${isDarkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-100/40'}`}>
              <th className="p-4">User</th>
              <th className="p-4">Role Group</th>
              <th className="p-4">Event Type</th>
              <th className="p-4">Action Summary</th>
              <th className="p-4 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="font-medium">
            {logs && logs.length > 0 ? (
              logs.map((log, i) => (
                <tr key={log.id || i} className={`border-b transition-colors ${isDarkMode ? 'border-slate-850 hover:bg-slate-900/20' : 'border-slate-150 hover:bg-slate-50'}`}>
                  <td className="p-4 flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-655'}`}>
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className={isDarkMode ? 'text-white font-bold' : 'text-slate-900 font-bold'}>
                      {log.user_name || 'System AutoEvent'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase ${
                      log.user_role === 'admin' 
                        ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' 
                        : (log.user_role === 'accountant' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')
                    }`}>
                      {log.user_role || 'system'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-extrabold text-slate-400">{log.action}</span>
                  </td>
                  <td className={`p-4 leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-650'}`}>
                    {log.details}
                  </td>
                  <td className="p-4 text-right text-slate-550">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-12 text-center text-slate-500">
                  <ShieldAlert className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  No security activities logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
