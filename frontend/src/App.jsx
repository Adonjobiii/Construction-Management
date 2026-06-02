import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  LayoutDashboard, 
  Building2, 
  DollarSign, 
  ClipboardList, 
  MessageSquare, 
  Users as UsersIcon, 
  ShieldAlert, 
  FileText,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  User as UserIcon,
  Building,
  Key,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient, { API_BASE } from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sites from './components/Sites';
import Expenses from './components/Expenses';
import Requests from './components/Requests';
import Chats from './components/Chats';
import Users from './components/Users';
import AuditLogs from './components/AuditLogs';
import Reports from './components/Reports';
import ClientPortal from './components/ClientPortal';
import Procurement from './components/Procurement';
import DailyUpdates from './components/DailyUpdates';
import Agreements from './components/Agreements';

let socket = null;

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('buildsync_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => sessionStorage.getItem('buildsync_token'));
  
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Self Password Change states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // App Data
  const [sites, setSites] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [chats, setChats] = useState([]);
  const [metrics, setMetrics] = useState(null);

  // Fetch App Data
  const fetchData = async () => {
    if (!token) return;
    try {
      // 1. Fetch sites
      const resSites = await apiClient.get('/sites');
      setSites(resSites.data);

      // 2. Fetch expenses
      const resExp = await apiClient.get('/expenses');
      setExpenses(resExp.data);

      // 3. Fetch requests
      const resReq = await apiClient.get('/requests');
      setRequests(resReq.data);

      // 4. Fetch chats
      const resChat = await apiClient.get('/chats');
      setChats(resChat.data);

      // 5. Fetch dashboard metrics
      const resMetrics = await apiClient.get('/dashboard-metrics');
      setMetrics(resMetrics.data);

      // Admin & Accountant only fetches
      if (user?.role === 'admin' || user?.role === 'accountant') {
        const resLogs = await apiClient.get('/activity-logs');
        setAuditLogs(resLogs.data);
      }

      // Admin only fetches
      if (user?.role === 'admin') {
        const resUsers = await apiClient.get('/auth/users');
        setUsers(resUsers.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      
      // Initialize Socket.IO connection
      socket = io(API_BASE);
      
      socket.on('connect', () => {
        console.log('Socket.IO real-time client connected.');
      });

      // Handle real-time sync events
      socket.on('expense_added', (data) => {
        fetchData();
        // Show desktop or in-app notification if it wasn't added by the current user
        if (data.expense.added_by !== user?.id) {
          showNotification('New Expense Recorded', `${data.expense.added_by_name} added ${data.expense.title} - ${data.expense.amount} INR`);
        }
        if (data.warning) {
          showNotification('Budget Limit Warning', data.warning, 'warning');
        }
      });

      socket.on('expense_updated', () => fetchData());
      socket.on('expense_deleted', () => fetchData());
      socket.on('sync_sites', () => fetchData());
      socket.on('sync_users', () => fetchData());

      socket.on('request_submitted', (reqData) => {
        fetchData();
        if (user?.role === 'admin' || user?.role === 'accountant') {
          showNotification('New Supervisor Request', `${reqData.submitted_by_name} raised a ticket: "${reqData.title}"`);
        }
      });

      socket.on('request_processed', (data) => {
        fetchData();
        showNotification('Request Status Updated', `Your request ticket ID ${data.requestId} has been ${data.status} by ${data.processedBy}`);
      });

      socket.on('chat_message', (msg) => {
        setChats((prev) => [...prev, msg]);
        if (msg.sender_id !== user?.id && activeTab !== 'chats') {
          showNotification(`Message from ${msg.sender_name}`, msg.message);
        }
      });

      socket.on('chat_message_deleted', (messageId) => {
        setChats((prev) => prev.filter((msg) => String(msg.id) !== String(messageId)));
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [token]);

  // Helper for triggering browser/in-app alert notifications
  const showNotification = (title, body, type = 'info') => {
    // Check permission
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body });
        }
      });
    }
    // Fallback console log or custom visual toast
    console.log(`[Notification - ${type.toUpperCase()}] ${title}: ${body}`);
  };

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setActiveTab(userData.role === 'client' ? 'client_portal' : 'dashboard');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of NIYANTRAAN?')) {
      sessionStorage.removeItem('buildsync_token');
      sessionStorage.removeItem('buildsync_user');
      setUser(null);
      setToken(null);
      setSites([]);
      setExpenses([]);
      setRequests([]);
      setChats([]);
      setMetrics(null);
    }
  };

  const handleSendMessage = async (msgText) => {
    try {
      await apiClient.post('/chats', { message: msgText });
    } catch (err) {
      console.error('Failed to dispatch message:', err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await apiClient.delete(`/chats/${messageId}`);
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert(err.response?.data?.error || 'Failed to delete message.');
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (newPasswordVal !== confirmPassword) {
      setChangePasswordError('New passwords do not match.');
      return;
    }

    if (newPasswordVal.length < 4) {
      setChangePasswordError('New password must be at least 4 characters long.');
      return;
    }

    setChangePasswordLoading(true);
    try {
      await apiClient.put('/auth/change-password', {
        currentPassword,
        newPassword: newPasswordVal
      });
      setChangePasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPasswordVal('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setChangePasswordSuccess('');
      }, 1500);
    } catch (err) {
      console.error(err);
      setChangePasswordError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // Filter supervisors and clients out of the users list for assignment dropdown
  const supervisorsList = users?.filter(u => u.role === 'supervisor' || u.role === 'admin') || [];
  const clientsList = users?.filter(u => u.role === 'client') || [];

  // Toggle UI Dark/Light Theme class
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.backgroundColor = '#020617'; // slate-950
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#f8fafc'; // slate-50
    }
  }, [isDarkMode]);

  if (!token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Define sidebar navigation items based on User roles
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'supervisor', 'accountant', 'staff'] },
    { id: 'client_portal', label: 'Client Portal', icon: LayoutDashboard, roles: ['client'] },
    { id: 'sites', label: 'Project Sites', icon: Building2, roles: ['admin', 'supervisor', 'accountant', 'staff', 'client'] },
    { id: 'daily_updates', label: 'Site Updates', icon: ClipboardList, roles: ['admin', 'supervisor', 'client'] },
    { id: 'procurement', label: 'Product Verification', icon: ClipboardList, roles: ['admin', 'supervisor', 'accountant'] },
    { id: 'agreements', label: 'AI Contract Parser', icon: FileText, roles: ['admin'] },
    { id: 'expenses', label: 'Expense Ledger', icon: DollarSign, roles: ['admin', 'supervisor', 'accountant', 'staff'] },
    { id: 'requests', label: 'Request Center', icon: ClipboardList, roles: ['admin', 'supervisor', 'accountant'] },
    { id: 'chats', label: 'Live Chat', icon: MessageSquare, roles: ['admin', 'supervisor', 'accountant', 'staff', 'client'] },
    { id: 'reports', label: 'Report Builder', icon: FileText, roles: ['admin', 'supervisor', 'accountant'] },
    { id: 'users', label: 'User Controls', icon: UsersIcon, roles: ['admin'] },
    { id: 'logs', label: 'Security Logs', icon: ShieldAlert, roles: ['admin', 'accountant'] },
  ].filter(item => {
    const defaultRoles = ['admin', 'supervisor', 'accountant', 'staff', 'client'];
    const isCustomRole = !defaultRoles.includes(user.role);
    const effectiveRole = isCustomRole ? 'staff' : user.role;
    return item.roles.includes(effectiveRole);
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            metrics={metrics} 
            recentLogs={auditLogs} 
            sites={sites} 
            expenses={expenses} 
            requests={requests} 
            user={user} 
            isDarkMode={isDarkMode} 
          />
        );
      case 'sites':
        return <Sites sites={sites} supervisors={supervisorsList} clients={clientsList} user={user} onRefresh={fetchData} isDarkMode={isDarkMode} />;
      case 'expenses':
        return <Expenses expenses={expenses} sites={sites} user={user} onRefresh={fetchData} isDarkMode={isDarkMode} />;
      case 'requests':
        return <Requests requests={requests} sites={sites} user={user} onRefresh={fetchData} isDarkMode={isDarkMode} />;
      case 'chats':
        return <Chats messages={chats} user={user} onSendMessage={handleSendMessage} onDeleteMessage={handleDeleteMessage} isDarkMode={isDarkMode} />;
      case 'reports':
        return <Reports expenses={expenses} sites={sites} isDarkMode={isDarkMode} />;
      case 'users':
        return <Users users={users} sites={sites} user={user} onRefresh={fetchData} isDarkMode={isDarkMode} />;
      case 'logs':
        return <AuditLogs logs={auditLogs} isDarkMode={isDarkMode} />;
      case 'client_portal':
        return <ClientPortal user={user} sites={sites} expenses={expenses} isDarkMode={isDarkMode} />;
      case 'daily_updates':
        return <DailyUpdates sites={sites} user={user} isDarkMode={isDarkMode} />;
      case 'procurement':
        return <Procurement sites={sites} user={user} isDarkMode={isDarkMode} />;
      case 'agreements':
        return <Agreements sites={sites} user={user} isDarkMode={isDarkMode} />;
      default:
        // Default based on role
        if (user.role === 'client') {
          return <ClientPortal user={user} sites={sites} expenses={expenses} isDarkMode={isDarkMode} />;
        }
        return <Dashboard metrics={metrics} recentLogs={auditLogs} isDarkMode={isDarkMode} />;
    }
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Sidebar mobile backdrop overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-35 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r transition-transform lg:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800 backdrop-blur-md' : 'bg-white border-slate-200 shadow-md'
      } flex flex-col justify-between`}>
        
        <div>
          {/* Logo Brand */}
          <div className={`py-6 flex flex-col items-center justify-center px-6 border-b relative ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <div 
              onClick={() => setActiveTab('dashboard')}
              className="flex flex-col items-center cursor-pointer hover:opacity-90 transition-all select-none"
              title="Go to Dashboard"
            >
              <img src="/logo.png" alt="NIYANTRAAN Logo" className="h-24 w-auto object-contain" />
            </div>
            <button className="lg:hidden absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all relative ${
                    isActive 
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                      : (isDarkMode ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card info + Logout */}
        <div className={`p-4 border-t ${isDarkMode ? 'border-slate-850' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between gap-2 mb-4 px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${isDarkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-650'}`}>
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-black truncate">{user.name}</h4>
                <span className="text-[9px] uppercase font-bold text-slate-550 block">{user.role}</span>
              </div>
            </div>
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className={`p-2 rounded-xl border transition-all shrink-0 ${
                isDarkMode 
                  ? 'border-slate-850 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white' 
                  : 'border-slate-250 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
              title="Change Password"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border border-rose-500/20 font-bold py-2.5 px-4 rounded-xl text-xs transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main layout container */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen w-full min-w-0 overflow-x-hidden">
        
        {/* Top Navbar */}
        <header className={`h-16 flex items-center justify-between px-6 border-b shrink-0 sticky top-0 z-30 ${
          isDarkMode ? 'bg-slate-950/80 border-slate-900 backdrop-blur-md' : 'bg-slate-50/80 border-slate-200 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-3">
            <button 
              className={`lg:hidden p-2 rounded-xl border transition-all ${
                isDarkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-900' : 'border-slate-200 text-slate-650 hover:bg-slate-100'
              }`}
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-bold text-slate-400 hidden sm:inline-block">NIYANTRAAN - Enterprise Workspace</span>
          </div>

          {/* Theme switcher + Profile name */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-xl border transition-all ${
                isDarkMode ? 'border-slate-850 hover:bg-slate-900 text-amber-450' : 'border-slate-250 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {isDarkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-7xl w-full mx-auto flex flex-col justify-between min-w-0">
          <div className="flex-1">
            {renderContent()}
          </div>
          
          {/* Subtle Watermark Footer */}
          <div className={`mt-12 pt-6 border-t flex flex-col items-center justify-center gap-2 text-[10px] font-bold select-none tracking-wider ${
            isDarkMode ? 'border-slate-900/60 text-slate-550' : 'border-slate-200/60 text-slate-400'
          }`}>
            <div className="flex items-center gap-2">
              <img src="/zylarq.png" alt="Zylarq Logo" style={{ height: '20px' }} className="w-auto object-contain" />
              <span className={isDarkMode ? 'text-slate-400 font-extrabold' : 'text-slate-650 font-extrabold'}>— A ZYLARQ INITIATIVE</span>
            </div>
            <span className="text-[9px] opacity-75">© {new Date().getFullYear()} NIYANTRAAN. All Rights Reserved.</span>
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isChangePasswordOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl ${
                isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">Change Your Password</h3>
                <button
                  onClick={() => {
                    setIsChangePasswordOpen(false);
                    setChangePasswordError('');
                    setChangePasswordSuccess('');
                    setCurrentPassword('');
                    setNewPasswordVal('');
                    setConfirmPassword('');
                  }}
                  className={`p-1 rounded-lg transition-all ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {changePasswordError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-xl mb-4">
                  {changePasswordError}
                </div>
              )}

              {changePasswordSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl mb-4">
                  {changePasswordSuccess}
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Current Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl py-3 pl-10 pr-4 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl py-3 pl-10 pr-4 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl py-3 pl-10 pr-4 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${
                        isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/20 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordOpen(false);
                      setChangePasswordError('');
                      setChangePasswordSuccess('');
                      setCurrentPassword('');
                      setNewPasswordVal('');
                      setConfirmPassword('');
                    }}
                    className={`text-xs font-bold py-2.5 px-4 rounded-xl border transition-all ${
                      isDarkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changePasswordLoading}
                    className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all flex items-center justify-center min-w-[100px]"
                  >
                    {changePasswordLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span>Update</span>
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
