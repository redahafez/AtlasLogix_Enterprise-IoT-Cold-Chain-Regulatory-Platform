'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { TenantUser, Role } from '@/lib/types';
import { AppShell } from '@/components/AppShell';
import {
  Search, UserPlus, Shield, Info, CheckCircle2, Lock, MoreHorizontal,
  Key, Trash2, Edit3, AlertTriangle, RefreshCw, X, Check, Users,
  UserCheck, UserX, Copy, Eye, EyeOff, ShieldAlert, Sparkles, Filter
} from 'lucide-react';

export default function AdministrationPage() {
  const { user, activeTenantId, switchTenant, hasPermission } = useAuth();
  
  // Data state
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTenant, setSearchTenant] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null);

  // Form states
  const [inviteForm, setInviteForm] = useState({
    email: '',
    username: '',
    role: 'OPERATIONS_MANAGER' as Role,
    password: '',
    isActive: true,
  });
  const [editForm, setEditForm] = useState({
    username: '',
    role: 'OPERATIONS_MANAGER' as Role,
    isActive: true,
  });
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    if (!activeTenantId) return;
    setLoading(true);
    try {
      const res = await api.getTenantUsers(activeTenantId);
      setTenantUsers(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch tenant users:', err);
      showToast(err.message || 'Failed to load tenant users', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTenantId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Calculations for KPI Cards
  const totalUsers = tenantUsers.length;
  const activeUsersCount = tenantUsers.filter((u) => u.isActive).length;
  const adminCount = tenantUsers.filter((u) => u.role === 'TENANT_ADMIN').length;
  const auditorCount = tenantUsers.filter((u) => u.role === 'COMPLIANCE_AUDITOR').length;
  const operationsCount = tenantUsers.filter((u) => u.role === 'OPERATIONS_MANAGER').length;

  // Filtered Users
  const filteredUsers = tenantUsers.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.userId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.isActive) ||
      (statusFilter === 'INACTIVE' && !u.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    let res = 'ALX-';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  const handleOpenInvite = () => {
    const defaultPass = generateRandomPassword();
    setInviteForm({
      email: '',
      username: '',
      role: 'OPERATIONS_MANAGER',
      password: defaultPass,
      isActive: true,
    });
    setShowPassword(false);
    setCopiedPass(false);
    setIsInviteModalOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId) return;
    if (!inviteForm.email.includes('@')) {
      showToast('Please provide a valid email address', 'error');
      return;
    }

    setActionLoading(true);
    try {
      await api.createTenantUser(activeTenantId, inviteForm);
      showToast(`User ${inviteForm.email} successfully invited!`);
      setIsInviteModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to create user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = (targetUser: TenantUser) => {
    setSelectedUser(targetUser);
    setEditForm({
      username: targetUser.username,
      role: targetUser.role,
      isActive: targetUser.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId || !selectedUser) return;

    setActionLoading(true);
    try {
      await api.updateTenantUser(activeTenantId, selectedUser.userId, editForm);
      showToast(`User ${selectedUser.email} updated successfully!`);
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatusQuick = async (targetUser: TenantUser) => {
    if (!activeTenantId) return;
    try {
      await api.updateTenantUser(activeTenantId, targetUser.userId, {
        isActive: !targetUser.isActive,
      });
      showToast(`User ${targetUser.email} is now ${!targetUser.isActive ? 'Active' : 'Deactivated'}`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle user status', 'error');
    }
  };

  const handleOpenResetPassword = (targetUser: TenantUser) => {
    setSelectedUser(targetUser);
    setResetPasswordValue(generateRandomPassword());
    setShowPassword(true);
    setCopiedPass(false);
    setIsResetPasswordModalOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenantId || !selectedUser) return;

    setActionLoading(true);
    try {
      await api.resetTenantUserPassword(activeTenantId, selectedUser.userId, resetPasswordValue);
      showToast(`Password for ${selectedUser.email} was reset successfully!`);
      setIsResetPasswordModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDelete = (targetUser: TenantUser) => {
    setSelectedUser(targetUser);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!activeTenantId || !selectedUser) return;

    setActionLoading(true);
    try {
      await api.deleteTenantUser(activeTenantId, selectedUser.userId);
      showToast(`User membership for ${selectedUser.email} removed.`);
      setIsDeleteModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove user', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
  };

  const getInitials = (name: string, email: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    const cleanEmail = email.split('@')[0].replace(/[._-]/g, ' ');
    const parts = cleanEmail.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'TENANT_ADMIN':
        return {
          label: 'Tenant Admin',
          badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          avatarBg: 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white',
          access: 'Full access · Users · Shipments · Telemetry',
        };
      case 'COMPLIANCE_AUDITOR':
        return {
          label: 'Compliance Auditor',
          badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          avatarBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
          access: 'Approve · Audit · Sensors',
        };
      case 'OPERATIONS_MANAGER':
        return {
          label: 'Operations Manager',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          avatarBg: 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white',
          access: 'Shipments · Audit · Sensors',
        };
      case 'WAREHOUSE_SUPERVISOR':
        return {
          label: 'Warehouse Supervisor',
          badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          avatarBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white',
          access: 'Shipments · Sensors',
        };
      case 'VIEWER':
      default:
        return {
          label: 'Viewer',
          badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          avatarBg: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white',
          access: 'Read-only records',
        };
    }
  };

  const activeTenantObj = user?.tenants.find((t) => t.tenantId === activeTenantId);

  return (
    <AppShell>
      <div className="space-y-8 animate-fade-in relative">
        
        {/* Floating Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-slide-up transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border-emerald-700 backdrop-blur-md'
                : 'bg-rose-900/90 text-rose-100 border-rose-700 backdrop-blur-md'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/10 rounded-md ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-[#2563EB] uppercase block">
                TENANT ADMINISTRATION & ACCESS GOVERNANCE
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {activeTenantObj?.name || activeTenantId}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              User & Access Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Role-Based Access Control (RBAC), user lifecycle provisioning, and 21 CFR Part 11 audit trails.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleOpenInvite}
              className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Invite tenant user
            </button>
          </div>
        </div>

        {/* Top 4 KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Users */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Total Organization Users</span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">{totalUsers}</div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Assigned to this tenant</span>
            </div>
          </div>

          {/* Card 2: Active Accounts */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Active Accounts</span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{activeUsersCount}</div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {totalUsers > 0 ? `${Math.round((activeUsersCount / totalUsers) * 100)}% operational` : '0%'}
              </span>
            </div>
          </div>

          {/* Card 3: Role Distribution */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Role Coverage</span>
              <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                {adminCount} Admin &bull; {auditorCount} Auditor
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">{operationsCount} Operations Specialists</span>
            </div>
          </div>

          {/* Card 4: Data Isolation */}
          <div className="p-5 bg-white dark:bg-[#102B62] rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">Tenant Security Isolation</span>
              <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Multi-Tenant Scoped
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">{activeTenantId}</span>
            </div>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Organization Tenants & Role Guide (1/3 width) */}
          <div className="space-y-5">
            
            {/* Tenants Card */}
            <div className="bg-white dark:bg-[#102B62] p-5 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Accessible Tenants</h3>
                  <p className="text-xs text-slate-400">Switch active organization scope</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {user?.tenants.length || 0} orgs
                </span>
              </div>

              {/* Search Tenants Input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                  placeholder="Search organizations..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>

              {/* Tenant Cards */}
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {user?.tenants
                  .filter((t) =>
                    t.name.toLowerCase().includes(searchTenant.toLowerCase()) ||
                    t.tenantId.toLowerCase().includes(searchTenant.toLowerCase())
                  )
                  .map((t) => {
                    const isSelected = t.tenantId === activeTenantId;
                    return (
                      <div
                        key={t.tenantId}
                        onClick={() => switchTenant(t.tenantId)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/50 border-blue-400 text-blue-900 dark:text-blue-100 shadow-sm ring-1 ring-blue-400'
                            : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs block truncate pr-2">{t.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {isSelected ? 'Active Scope' : 'Select'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{t.tenantId}</span>
                          <span className="text-slate-500 uppercase font-semibold">{t.region}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Role Governance & Permissions Hierarchy Guide */}
            <div className="bg-white dark:bg-[#102B62] p-5 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-500" /> RBAC Permission Profiles
              </h4>
              <div className="space-y-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-700 dark:text-purple-300">TENANT_ADMIN</span>
                    <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">users:write</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px]">User provisioning, roles, and full telemetry stream tickets.</p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700 dark:text-amber-300">COMPLIANCE_AUDITOR</span>
                    <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">compliance:approve</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px]">Audit logs, lock compliance decisions, and excursion reports.</p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-700 dark:text-blue-300">OPERATIONS_MANAGER</span>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">shipments:read</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px]">Dispatch workflows, delay investigations, live cargo tracking.</p>
                </div>
              </div>
            </div>

            {/* Audit Trail Note Card */}
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> 21 CFR Part 11 Audit Trail
              </span>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                All role alterations, password resets, and account status toggles are immutably signed and timestamped in the audit log.
              </p>
            </div>

          </div>

          {/* Right Column: Tenant Users Table & Controls (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-[#102B62] p-6 rounded-[14px] border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5">
              
              {/* Header & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Organization Members</h3>
                  <p className="text-xs text-slate-400">Manage user credentials, operational roles, and active status.</p>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full self-start sm:self-auto">
                  {filteredUsers.length} shown of {tenantUsers.length}
                </span>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                {/* Search input */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or user ID..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>

                {/* Role Filter */}
                <div className="flex items-center gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Roles</option>
                    <option value="TENANT_ADMIN">Tenant Admin</option>
                    <option value="COMPLIANCE_AUDITOR">Compliance Auditor</option>
                    <option value="OPERATIONS_MANAGER">Operations Manager</option>
                    <option value="WAREHOUSE_SUPERVISOR">Warehouse Supervisor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Status</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Deactivated</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 pr-4">USER & CREDENTIALS</th>
                      <th className="pb-3 px-4">ROLE & ACCESS</th>
                      <th className="pb-3 px-4">STATUS</th>
                      <th className="pb-3 px-4">JOINED</th>
                      <th className="pb-3 pl-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                          <span>Loading tenant users...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                          <p className="font-semibold">No members match your criteria</p>
                          <p className="text-[11px] mt-1">Try adjusting your filters or invite a new member.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const meta = getRoleBadge(u.role);
                        const isSelf = u.email === user?.email;

                        return (
                          <tr key={u.userId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                            
                            {/* User details */}
                            <td className="py-3.5 pr-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl ${meta.avatarBg} font-bold text-xs flex items-center justify-center shrink-0 shadow-sm`}>
                                  {getInitials(u.username, u.email)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 dark:text-white truncate block">
                                      {u.username || u.email.split('@')[0]}
                                    </span>
                                    {isSelf && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-400 block font-mono truncate">{u.email}</span>
                                  <span className="text-[9px] text-slate-400 block font-mono">ID: {u.userId}</span>
                                </div>
                              </div>
                            </td>

                            {/* Role and permissions */}
                            <td className="py-3.5 px-4">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${meta.badge}`}>
                                {meta.label}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
                                {meta.access}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => handleToggleStatusQuick(u)}
                                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                                  u.isActive
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 hover:bg-emerald-200'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                                }`}
                                title="Click to toggle status"
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    u.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                  }`}
                                />
                                <span>{u.isActive ? 'Active' : 'Deactivated'}</span>
                              </button>
                            </td>

                            {/* Date Joined */}
                            <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                              {new Date(u.dateJoined).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3.5 pl-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(u)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                                  title="Edit role and details"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenResetPassword(u)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition-colors"
                                  title="Reset password"
                                >
                                  <Key className="w-4 h-4" />
                                </button>
                                {!isSelf && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDelete(u)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                                    title="Remove from tenant"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Blue Information Banner */}
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start gap-3">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300 block">
                    Enterprise RBAC Enforcement
                  </span>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                    Changes take effect immediately across all active API sessions. Deactivated users cannot authenticate or maintain WebSocket telemetry streams.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* MODAL 1: Invite / Add User Modal */}
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#0d2350] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Invite Tenant User</h3>
                    <p className="text-xs text-slate-400 font-mono">{activeTenantId}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="e.g. tarek.salem@atlaslogix.test"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name / Display Name
                  </label>
                  <input
                    type="text"
                    value={inviteForm.username}
                    onChange={(e) => setInviteForm({ ...inviteForm, username: e.target.value })}
                    placeholder="e.g. Tarek Salem"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as Role })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="OPERATIONS_MANAGER">Operations Manager (Shipments & Live Fleet)</option>
                    <option value="COMPLIANCE_AUDITOR">Compliance Auditor (Audit & Sign-off)</option>
                    <option value="WAREHOUSE_SUPERVISOR">Warehouse Supervisor (Intake & Sensors)</option>
                    <option value="VIEWER">Viewer (Read-only Access)</option>
                    <option value="TENANT_ADMIN">Tenant Administrator (Full Control)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Initial Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const pass = generateRandomPassword();
                        setInviteForm({ ...inviteForm, password: pass });
                      }}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={inviteForm.password}
                      onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                      className="w-full pl-3 pr-20 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(inviteForm.password)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copy password"
                      >
                        {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="inviteActive"
                    checked={inviteForm.isActive}
                    onChange={(e) => setInviteForm({ ...inviteForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="inviteActive" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                    Activate account immediately upon creation
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold shadow-md transition-all flex items-center gap-2"
                  >
                    {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Confirm & Invite
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* MODAL 2: Edit User Modal */}
        {isEditModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#0d2350] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Member Details</h3>
                    <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="OPERATIONS_MANAGER">Operations Manager</option>
                    <option value="COMPLIANCE_AUDITOR">Compliance Auditor</option>
                    <option value="WAREHOUSE_SUPERVISOR">Warehouse Supervisor</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="TENANT_ADMIN">Tenant Administrator</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="editActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="editActive" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                    Account is Active
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white font-bold shadow-md transition-all flex items-center gap-2"
                  >
                    {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* MODAL 3: Reset Password Modal */}
        {isResetPasswordModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#0d2350] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset User Password</h3>
                    <p className="text-xs text-slate-400 font-mono">{selectedUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      New Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setResetPasswordValue(generateRandomPassword())}
                      className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-generate
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      className="w-full pl-3 pr-20 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(resetPasswordValue)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copy password"
                      >
                        {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">Minimum 6 characters required.</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                  Make sure to share the newly generated credentials securely with the user.
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsResetPasswordModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md transition-all flex items-center gap-2"
                  >
                    {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Update Password
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* MODAL 4: Delete Confirmation Modal */}
        {isDeleteModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#0d2350] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
              
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Revoke Tenant Access?</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedUser.email}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900 dark:text-white">{selectedUser.username || selectedUser.email}</strong> from the organization <strong>{activeTenantId}</strong>?
                The user will immediately lose access to this tenant&apos;s shipments, sensor data, and audit records.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Revocation
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
