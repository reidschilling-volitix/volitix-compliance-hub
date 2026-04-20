import { useEffect, useState } from 'react';
import { BarChart3, Eye, EyeOff, Lock, Trash2, Users, Download } from 'lucide-react';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { Button, FormCard, Input, Select } from './ui/components';
import { updateProfileName, updateUserPassword } from '../services/authService.js';
import { updateSubscription } from '../services/subscriptionService.js';
import { openStripePortal, startStripeCheckout } from '../services/stripeBillingService.js';
import { appId } from '../utils/config';
import { db } from '../firebase.js';

const TIME_ZONES = [
  { offset: -8, label: 'UTC-8 Pacific' },
  { offset: -7, label: 'UTC-7 Mountain' },
  { offset: -6, label: 'UTC-6 Central' },
  { offset: -5, label: 'UTC-5 Eastern' },
  { offset: 0, label: 'UTC+0 London' }
];

const normalizeTenantId = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
const makeJoinCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const SettingsTab = ({ company, setCompany, handleCompanySettingsSave, customUser, tenantId, subscription, notify, onPasswordChanged, onProfileNameChanged, onSubscriptionChanged, tenantData }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState(customUser?.username || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [plan, setPlan] = useState(subscription?.plan || 'starter');
  const [status, setStatus] = useState(subscription?.status || 'trialing');
  const [billingEmail, setBillingEmail] = useState(subscription?.billingEmail || customUser?.email || '');
  const [billingBusy, setBillingBusy] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const canManageCompany = customUser?.role === 'Manager';
  const roleLabel = `${customUser?.role || 'User'} Name`;

  const baseIncludedDrones = 2;
  const fleetCount = Array.isArray(company?.fleet) ? company.fleet.length : 0;
  const subscriptionIncludedDrones = Math.max(0, Number(subscription?.includedDrones ?? baseIncludedDrones) || baseIncludedDrones);
  const subscriptionExtraDrones = Math.max(0, Number(subscription?.extraDrones ?? 0) || 0);
  const allowedFleetCount = subscriptionIncludedDrones + subscriptionExtraDrones;
  const overCapacity = fleetCount > allowedFleetCount;
  const projectedExtraDrones = Math.max(0, fleetCount - baseIncludedDrones);
  const estimatedMonthly = 50 + (projectedExtraDrones * 10);

  useEffect(() => {
    setDisplayName(customUser?.username || '');
  }, [customUser?.username]);

  useEffect(() => {
    setPlan(subscription?.plan || 'starter');
    setStatus(subscription?.status || 'trialing');
    setBillingEmail(subscription?.billingEmail || customUser?.email || '');
  }, [subscription?.plan, subscription?.status, subscription?.billingEmail, customUser?.email]);

  // Load team members for managers
  useEffect(() => {
    if (!canManageCompany || !tenantId) return;
    let cancelled = false;
    const loadTeam = async () => {
      setTeamLoading(true);
      try {
        const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'saas_users');
        const q = query(usersRef, where('tenantId', '==', tenantId));
        const snap = await getDocs(q);
        if (!cancelled) {
          setTeamMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setTeamLoading(false);
      }
    };
    loadTeam();
    return () => { cancelled = true; };
  }, [canManageCompany, tenantId]);

  const onRemoveMember = async (member) => {
    if (member.uid === customUser?.uid) return notify('You cannot remove yourself.', 'error');
    if (!window.confirm(`Remove ${member.username || member.email} from the team?`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'saas_users', member.uid || member.id));
      setTeamMembers((prev) => prev.filter((m) => (m.uid || m.id) !== (member.uid || member.id)));
      notify(`${member.username || member.email} removed.`, 'success');
    } catch (err) {
      notify(`Failed to remove member: ${err.message}`, 'error');
    }
  };

  const onSaveSettings = async (e) => {
    e.preventDefault();
    await handleCompanySettingsSave(e);
  };

  const onGenerateJoinCodes = () => {
    setCompany({
      ...company,
      pilotJoinCode: makeJoinCode(),
      dispatcherJoinCode: makeJoinCode(),
    });
  };

  const onUpdatePassword = async (e) => {
    e.preventDefault();

    if (!oldPassword || !newPassword) {
      notify('Both password fields are required.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      notify('New password must be at least 6 characters.', 'error');
      return;
    }

    await updateUserPassword({ email: customUser?.email, currentPassword: oldPassword, password: newPassword });
    if (typeof onPasswordChanged === 'function') onPasswordChanged();

    setOldPassword('');
    setNewPassword('');
    notify('Password updated successfully.', 'success');
  };

  const onUpdateProfileName = async (e) => {
    e.preventDefault();
    const trimmed = String(displayName || '').trim();
    if (!trimmed) {
      notify(`${roleLabel} is required.`, 'error');
      return;
    }

    const savedName = await updateProfileName({ name: trimmed });
    if (typeof onProfileNameChanged === 'function') onProfileNameChanged(savedName);
    notify(`${roleLabel} updated.`, 'success');
  };

  const onUpdateBilling = async (e) => {
    e.preventDefault();
    const tenantId = normalizeTenantId(customUser?.tenantId || customUser?.companyName || company?.name);
    if (!tenantId) {
      notify('Unable to resolve tenant for billing update.', 'error');
      return;
    }

    const next = await updateSubscription(tenantId, {
      plan: 'base',
      status,
      billingEmail: String(billingEmail || '').trim(),
      includedDrones: baseIncludedDrones,
      droneCount: fleetCount,
      extraDrones: projectedExtraDrones,
    });

    if (typeof onSubscriptionChanged === 'function') onSubscriptionChanged(next);
    notify('Billing profile updated.', 'success');
  };

  const onStartCheckout = async () => {
    const resolvedTenantId = tenantId || normalizeTenantId(customUser?.tenantId || customUser?.companyName || company?.name);
    if (!resolvedTenantId) {
      notify('Unable to resolve tenant for checkout.', 'error');
      return;
    }

    try {
      setBillingBusy(true);
      await startStripeCheckout({
        tenantId: resolvedTenantId,
        email: String(billingEmail || customUser?.email || '').trim(),
        plan: 'base',
        droneCount: fleetCount,
      });
    } catch (err) {
      notify(`Checkout error: ${err.message}`, 'error');
    } finally {
      setBillingBusy(false);
    }
  };

  const onOpenPortal = async () => {
    const resolvedTenantId = tenantId || normalizeTenantId(customUser?.tenantId || customUser?.companyName || company?.name);
    if (!resolvedTenantId) {
      notify('Unable to resolve tenant for billing portal.', 'error');
      return;
    }

    try {
      setBillingBusy(true);
      await openStripePortal({
        tenantId: resolvedTenantId,
        email: String(billingEmail || customUser?.email || '').trim(),
      });
    } catch (err) {
      notify(`Billing portal error: ${err.message}`, 'error');
    } finally {
      setBillingBusy(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in min-w-0">
      {canManageCompany && (
        <FormCard title="Command Settings" icon={Lock} onSubmit={onSaveSettings} submitLabel="Update Settings">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Input
              label="Organization Name"
              value={company.name}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
              required
            />
            <Input
              label="FAA Exemption Number"
              value={company.exemption}
              onChange={(e) => setCompany({ ...company, exemption: e.target.value })}
            />
            <Input
              label="Chief Supervisor / Pilot"
              value={company.supervisor}
              onChange={(e) => setCompany({ ...company, supervisor: e.target.value })}
              required
            />
            <Input
              label="Part 137 / 107 Cert Number"
              value={company.certNo}
              onChange={(e) => setCompany({ ...company, certNo: e.target.value })}
            />
            <Input
              label="Business Phone"
              value={company.phone || ''}
              onChange={(e) => setCompany({ ...company, phone: e.target.value })}
            />
            <Select
              label="Local Time Zone"
              value={company.timezone}
              onChange={(e) => setCompany({ ...company, timezone: parseInt(e.target.value, 10) })}
            >
              {TIME_ZONES.map((tz) => (
                <option className="bg-slate-900" key={tz.offset} value={tz.offset}>
                  {tz.label}
                </option>
              ))}
            </Select>
            <div className="md:col-span-2">
              <Input
                label="Business Address"
                value={company.address || ''}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
              />
            </div>
            <Input
              label="Pilot Join Code"
              value={company.pilotJoinCode || ''}
              onChange={(e) => setCompany({ ...company, pilotJoinCode: e.target.value.trim() })}
              required
            />
            <Input
              label="Dispatcher Join Code"
              value={company.dispatcherJoinCode || ''}
              onChange={(e) => setCompany({ ...company, dispatcherJoinCode: e.target.value.trim() })}
              required
            />
            <div className="md:col-span-2">
              <Button type="button" variant="secondary" onClick={onGenerateJoinCodes}>
                Generate New Join Codes
              </Button>
            </div>
          </div>
        </FormCard>
      )}

      {canManageCompany && (
        <FormCard title="Team Members" icon={Users} onSubmit={(e) => e.preventDefault()} submitLabel="">
          {teamLoading ? (
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center py-4">Loading team...</p>
          ) : teamMembers.length === 0 ? (
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center py-4">No team members found</p>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((m) => (
                <div key={m.uid || m.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-2xl min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-200 truncate">{m.username || m.email}</p>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">{m.role} • {m.email}</p>
                  </div>
                  {(m.uid || m.id) !== customUser?.uid && (
                    <button type="button" onClick={() => onRemoveMember(m)} className="ml-3 p-2 rounded-xl text-red-500/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</p>
            </div>
          )}
        </FormCard>
      )}

      <FormCard title="Profile" icon={Lock} onSubmit={onUpdateProfileName} submitLabel="Update Name">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Input
            label={roleLabel}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
      </FormCard>

      {/* Billing & Plan section only for managers */}
      {canManageCompany && (() => {
        const STATUS_STYLES = {
          active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          past_due: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          canceled: 'bg-red-500/20 text-red-400 border-red-500/30',
        };
        const statusStyle = STATUS_STYLES[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        const utilPct = allowedFleetCount > 0 ? Math.min(100, Math.round((fleetCount / allowedFleetCount) * 100)) : 0;
        const utilBarClass = utilPct >= 90 ? 'bg-red-500' : utilPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
        const utilTextClass = utilPct >= 90 ? 'text-red-400' : utilPct >= 70 ? 'text-amber-400' : 'text-emerald-400';
        const trialStart = subscription?.createdAt ? new Date(subscription.createdAt) : null;
        const periodEnd = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : (trialStart ? new Date(trialStart.getTime() + 14 * 86400000) : null);
        const fmt = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
        return (
          <FormCard title="Billing & Plan" icon={BarChart3} onSubmit={onUpdateBilling} submitLabel="Save Billing Email">
            <div className="space-y-6">
              {/* Plan overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${statusStyle}`}>
                    {status}
                  </span>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Monthly Total</p>
                  <p className="text-2xl font-black text-slate-100">${estimatedMonthly}</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Base Plan</p>
                  <p className="text-2xl font-black text-slate-100">$50</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase">incl. 2 drones</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-center">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Add-On Seats</p>
                  <p className="text-2xl font-black text-slate-100">{projectedExtraDrones}</p>
                  <p className="text-[8px] text-slate-500 font-bold uppercase">${projectedExtraDrones * 10}/mo</p>
                </div>
              </div>

              {/* Fleet utilization */}
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Fleet Utilization</p>
                  <p className="text-xs font-black text-slate-300">{fleetCount} / {allowedFleetCount} seats</p>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${utilBarClass}`}
                    style={{ width: `${utilPct}%` }}
                  />
                </div>
                <p className={`text-[9px] font-bold uppercase tracking-widest mt-2 ${utilTextClass}`}>
                  {utilPct}% utilized{utilPct >= 90 ? ' — near capacity' : ''}
                </p>
                {overCapacity && (
                  <p className="text-[9px] text-amber-300 font-black uppercase tracking-widest mt-2">
                    Fleet exceeds current seats by {fleetCount - allowedFleetCount}. Add drone seats via Manage Subscription.
                  </p>
                )}
              </div>

              {/* Period dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Period Start</p>
                  <p className="text-sm font-black text-slate-200">{fmt(trialStart)}</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Period End / Renewal</p>
                  <p className="text-sm font-black text-slate-200">{fmt(periodEnd)}</p>
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-3">Cost Breakdown</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Base Plan (2 drones)</span><span className="font-bold text-slate-200">$50.00</span></div>
                  {projectedExtraDrones > 0 && (
                    <div className="flex justify-between"><span className="text-slate-400">{projectedExtraDrones} Add-On Seat{projectedExtraDrones !== 1 ? 's' : ''} × $10</span><span className="font-bold text-slate-200">${projectedExtraDrones * 10}.00</span></div>
                  )}
                  <div className="border-t border-slate-700 pt-2 flex justify-between"><span className="text-slate-300 font-bold">Total / month</span><span className="font-black text-white">${estimatedMonthly}.00</span></div>
                </div>
              </div>

              {/* Billing email */}
              <Input
                label="Billing Email"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
              />

              {/* Subscription actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {status === 'trialing' && (
                  <Button type="button" onClick={onStartCheckout} disabled={billingBusy}>
                    {billingBusy ? 'Opening...' : 'Activate Subscription'}
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={onOpenPortal} disabled={billingBusy}>
                  {billingBusy ? 'Opening...' : 'Manage Subscription'}
                </Button>
                {status !== 'canceled' && (
                  <Button type="button" variant="danger" onClick={onOpenPortal} disabled={billingBusy}>
                    {billingBusy ? 'Opening...' : 'Cancel Subscription'}
                  </Button>
                )}
              </div>
            </div>
          </FormCard>
        );
      })()}

      <FormCard title="Account Security" icon={Lock} onSubmit={onUpdatePassword} submitLabel="Update Password">
        {canManageCompany && tenantData && (
          <div className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Full Account Data Export</p>
            <Button type="button" variant="secondary" onClick={() => {
              const payload = { exportedAt: new Date().toISOString(), tenantId, company, ...tenantData };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `SprayOps_Export_${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              notify('Account data exported as JSON.', 'success');
            }}>
              <Download size={14} /> Export All Data (JSON)
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2 min-w-0">
            <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest pl-1 truncate block">{roleLabel}</label>
            <input
              className="w-full bg-slate-950/50 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none cursor-not-allowed opacity-50"
              value={customUser?.username || ''}
              disabled
            />
          </div>
          <div className="space-y-4 md:col-span-2 lg:col-span-1">
            <Input
              label="Current Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Verify current password..."
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-slate-500 hover:text-slate-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
        </div>
      </FormCard>
    </div>
  );
};

export default SettingsTab;
