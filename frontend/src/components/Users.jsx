import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, 
  Users as UsersIcon, 
  Edit2, 
  Key, 
  Shield, 
  UserX, 
  UserCheck, 
  X, 
  MapPin,
  Lock,
  Building,
  Trash2
} from 'lucide-react';
import apiClient from '../api';

export default function Users({ users, sites, user: currentUser, onRefresh, isDarkMode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('supervisor');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [isCustomRole, setIsCustomRole] = useState(false);

  // Reset Password Fields
  const [newPassword, setNewPassword] = useState('');

  const defaultRoles = ['admin', 'supervisor', 'accountant', 'staff', 'client'];
  const uniqueRoles = Array.from(new Set([
    ...defaultRoles,
    ...(users || []).map(u => u.role).filter(Boolean)
  ]));

  const openAddModal = () => {
    setEditUser(null);
    setLoginId('');
    setPassword('');
    setIsCustomRole(false);
    setRole('supervisor');
    setName('');
    setStatus('active');
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (usr) => {
    setEditUser(usr);
    setLoginId(usr.login_id);
    setPassword('dummy-value'); // Not editing password in main edit modal
    const isCustom = !defaultRoles.includes(usr.role);
    setIsCustomRole(isCustom);
    setRole(usr.role);
    setName(usr.name);
    setStatus(usr.status);
    setError('');
    setIsModalOpen(true);
  };

  const openResetModal = (usr) => {
    setResetUser(usr);
    setNewPassword('');
    setError('');
    setIsResetModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const computedSiteAccess = (role === 'admin' || role === 'accountant')
      ? 'all'
      : (editUser && editUser.role === role ? editUser.site_access : 'none');

    const payload = {
      role,
      site_access: computedSiteAccess,
      status,
      name
    };

    try {
      if (editUser) {
        // Edit user
        await apiClient.put(`/auth/users/${editUser.id}`, payload);
      } else {
        // Create user
        await apiClient.post('/auth/users', {
          ...payload,
          login_id: loginId,
          password
        });
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiClient.put(`/auth/users/${resetUser.id}/password`, {
        password: newPassword
      });
      setIsResetModalOpen(false);
      alert('Password reset successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (usr) => {
    const newStatus = usr.status === 'active' ? 'disabled' : 'active';
    try {
      await apiClient.put(`/auth/users/${usr.id}`, {
        role: usr.role,
        site_access: usr.site_access,
        name: usr.name,
        status: newStatus
      });
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleDeleteUser = async (usr) => {
    if (window.confirm(`Are you sure you want to permanently delete user "${usr.name}"? This action cannot be undone.`)) {
      try {
        await apiClient.delete(`/auth/users/${usr.id}`);
        onRefresh();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to delete user.');
      }
    }
  };

  const getRoleLabel = (r) => {
    switch (r) {
      case 'admin': return 'Administrator';
      case 'accountant': return 'Accountant';
      case 'supervisor': return 'Supervisor';
      case 'staff': return 'Staff/User';
      case 'client': return 'Client / Owner';
      default: return r ? (r.charAt(0).toUpperCase() + r.slice(1)) : 'Unknown';
    }
  };

  const getRoleBadge = (r) => {
    switch (r) {
      case 'admin': return 'bg-brand-500/10 text-brand-400 border-brand-500/25';
      case 'accountant': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'supervisor': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      case 'staff': return 'bg-slate-500/10 text-slate-400 border-slate-500/25';
      case 'client': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25';
      default: return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            User & Role Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Create enterprise accounts, reset passwords, update security groups and site permissions.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg hover:shadow-brand-500/20 transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee User</span>
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users && users.length > 0 ? (
          users.map((usr, i) => {
            const isMe = usr.id === currentUser.id;

            return (
              <motion.div
                key={usr.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`p-6 rounded-3xl ${isDarkMode ? 'glass border-slate-800' : 'glass-light border-slate-200'} relative overflow-hidden`}
              >
                {/* Status Indicator */}
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Sys ID: {usr.id} &bull; Login ID: {usr.login_id}</span>
                    <h3 className={`text-base font-extrabold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{usr.name}</h3>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${
                    usr.status === 'active' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {usr.status}
                  </span>
                </div>

                <div className="space-y-3 mt-4 text-xs font-semibold text-slate-400">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-500" />
                    <span>Role: <strong className={`px-2 py-0.5 rounded border text-[10px] uppercase ${getRoleBadge(usr.role)}`}>{getRoleLabel(usr.role)}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-slate-500" />
                    <span className="truncate">
                      Site Access: <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{usr.site_access === 'all' ? 'All Sites Allowed' : usr.site_access}</strong>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {!isMe && (
                  <div className={`flex gap-2 justify-end mt-6 pt-4 border-t ${isDarkMode ? 'border-slate-800/85' : 'border-slate-200/85'}`}>
                    <button
                      onClick={() => openEditModal(usr)}
                      className={`flex items-center gap-1 text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-350' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-650'}`}
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => openResetModal(usr)}
                      className={`flex items-center gap-1 text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all ${isDarkMode ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-350' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-650'}`}
                    >
                      <Key className="w-3 h-3" />
                      <span>Reset Pass</span>
                    </button>
                    <button
                      onClick={() => toggleUserStatus(usr)}
                      className={`flex items-center gap-1 text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all ${
                        usr.status === 'active'
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-450 border-rose-500/20'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-450 border-emerald-500/20'
                      }`}
                    >
                      {usr.status === 'active' ? (
                        <>
                          <UserX className="w-3 h-3" />
                          <span>Disable</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3 h-3" />
                          <span>Enable</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(usr)}
                      className={`flex items-center gap-1 text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all bg-red-500/10 hover:bg-red-500/20 text-red-450 border-red-500/20`}
                      title="Permanently Delete User"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center text-slate-500 glass rounded-3xl border border-slate-800">
            <UsersIcon className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <h3 className="text-base font-bold text-slate-400">No employees listed</h3>
          </div>
        )}
      </div>

      {/* Add / Edit User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">
                  {editUser ? 'Modify User Profile' : 'Create Employee Account'}
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
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Login ID / Username</label>
                    <input
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      disabled={!!editUser}
                      className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white disabled:opacity-40' : 'bg-slate-50 border-slate-200 text-slate-900 disabled:opacity-50'}`}
                      placeholder="e.g. supervisor_west"
                      required
                    />
                  </div>
                  {!editUser && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  )}
                </div>

                 <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assigned Role</label>
                      <select
                        value={isCustomRole ? 'custom' : role}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setIsCustomRole(true);
                            setRole('');
                          } else {
                            setIsCustomRole(false);
                            setRole(e.target.value);
                          }
                        }}
                        className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      >
                        {uniqueRoles.map(r => (
                          <option key={r} value={r}>{getRoleLabel(r)}</option>
                        ))}
                        <option value="custom">+ Create New Custom Role...</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Account Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={`w-full text-xs font-semibold rounded-xl p-3 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </div>
                  </div>

                  {isCustomRole && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 rounded-2xl border bg-slate-500/5 border-slate-500/10 space-y-1.5"
                    >
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">New Custom Role Name</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={role}
                          onChange={(e) => setRole(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                          className={`w-full text-xs font-semibold rounded-xl p-2.5 pr-20 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                          placeholder="e.g. engineer, manager"
                          maxLength={20}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomRole(false);
                            setRole('supervisor');
                          }}
                          className="absolute right-2 top-1.5 px-2.5 py-1 text-[10px] font-bold bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-500 block">Lowercase alphanumeric characters only, max 20 chars.</span>
                    </motion.div>
                  )}
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
                      <span>Save User</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black tracking-tight">Reset User Password</h3>
                <button
                  onClick={() => setIsResetModalOpen(false)}
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

              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Resetting password for user <strong className={isDarkMode ? 'text-white' : 'text-slate-900'}>{resetUser?.name} ({resetUser?.login_id})</strong>.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full text-xs font-semibold rounded-xl py-3 pl-10 pr-4 border focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all ${isDarkMode ? 'bg-slate-950 border-slate-800 focus:border-transparent text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/20 flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
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
                      <span>Reset</span>
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
