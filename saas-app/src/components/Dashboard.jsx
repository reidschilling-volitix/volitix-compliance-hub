import { useMemo, useState, useCallback } from 'react';
import { Plane, User, History, AlertTriangle, Award, CheckCircle, Clock, TrendingUp, MapPin, BarChart3, Plus, FileText, CalendarDays, Users, X } from 'lucide-react';
import { Card } from './ui/components';

const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d)) return Infinity;
  return Math.ceil((d - new Date()) / 86400000);
};

const Dashboard = ({ fleet = [], company = {}, customUser = {}, logs = [], maintRecords = [], certifications = [], subscription, onNavigate }) => {
  const isManager = customUser?.role === 'Manager';

  // --- Cert expiration alerts ---
  const certAlerts = useMemo(() => {
    if (!certifications.length) return [];
    return certifications
      .map((c) => ({ ...c, daysLeft: daysUntil(c.expirationDate) }))
      .filter((c) => c.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [certifications]);

  // --- Trial banner ---
  const trialDaysLeft = useMemo(() => {
    if (!subscription) return null;
    if (subscription.status !== 'trialing') return null;
    const ends = subscription.trialEndsAt || subscription.currentPeriodEnd;
    if (!ends) return null;
    return Math.max(0, daysUntil(ends));
  }, [subscription]);

  // --- Onboarding checklist (managers only) ---
  const onboardingSteps = useMemo(() => {
    if (!isManager) return [];
    const steps = [
      { label: 'Create your company', done: true },
      { label: 'Add aircraft to fleet', done: (fleet?.length || 0) > 0 },
      { label: 'Upload certifications', done: (certifications?.length || 0) > 0 },
      { label: 'Log your first mission', done: (logs?.length || 0) > 0 },
      { label: 'Set up billing', done: subscription?.status === 'active' || subscription?.stripeSubscriptionId },
    ];
    return steps;
  }, [isManager, fleet, certifications, logs, subscription]);

  const onboardingComplete = onboardingSteps.length > 0 && onboardingSteps.every((s) => s.done);

  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    try { return localStorage.getItem('sprayops_onboarding_dismissed') === 'true'; } catch { return false; }
  });
  const dismissOnboarding = useCallback(() => {
    setOnboardingDismissed(true);
    try { localStorage.setItem('sprayops_onboarding_dismissed', 'true'); } catch {}
  }, []);

  // --- KPIs ---
  const totalAcres = useMemo(() => logs.reduce((sum, l) => sum + (parseFloat(l.treatedAcreage) || parseFloat(l.totalAcreage) || 0), 0), [logs]);
  const totalFlightHours = useMemo(() => logs.reduce((sum, l) => {
    const mins = parseFloat(l.flightTimeMinutes || 0);
    if (!isNaN(mins) && mins > 0) return sum + mins / 60;
    const v = parseFloat(l.flightTimeValue || 0);
    if (isNaN(v)) return sum;
    return sum + (l.flightTimeUnit === 'Minutes' ? v / 60 : v);
  }, 0), [logs]);
  const uniqueCustomers = useMemo(() => new Set(logs.map((l) => l.customer).filter(Boolean)).size, [logs]);

  // --- Monthly trends (last 6 months) ---
  const monthlyTrends = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        missions: 0,
        hours: 0,
        acres: 0,
      });
    }
    const monthMap = Object.fromEntries(months.map((m) => [m.key, m]));
    logs.forEach((l) => {
      if (!l.date) return;
      const ld = new Date(l.date);
      const k = `${ld.getFullYear()}-${String(ld.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap[k]) {
        monthMap[k].missions += 1;
        const mins = parseFloat(l.flightTimeMinutes || 0);
        if (!isNaN(mins) && mins > 0) { monthMap[k].hours += mins / 60; }
        else {
          const v = parseFloat(l.flightTimeValue || 0);
          if (!isNaN(v)) monthMap[k].hours += (l.flightTimeUnit === 'Minutes' ? v / 60 : v);
        }
        monthMap[k].acres += parseFloat(l.treatedAcreage) || parseFloat(l.totalAcreage) || 0;
      }
    });
    return months;
  }, [logs]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dashboard Header */}
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 !p-6 border-[#9cd33b]/20">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <BarChart3 size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">Operations Dashboard</h2>
            <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">Real-Time Overview</p>
          </div>
        </div>
      </Card>

      {/* Trial Banner */}
      {trialDaysLeft !== null && isManager && (
        <div className="bg-gradient-to-r from-blue-950/80 to-blue-900/40 border border-blue-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
          <div className="flex items-center gap-3 min-w-0">
            <Clock size={20} className="text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-black text-blue-300 uppercase tracking-widest">{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left in trial</p>
              <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-widest mt-0.5">Subscribe to keep your data and team access</p>
            </div>
          </div>
          <button type="button" onClick={() => onNavigate?.('settings')} className="px-5 py-2.5 rounded-2xl bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest hover:bg-blue-400 transition-colors shrink-0 shadow-lg">
            Subscribe Now
          </button>
        </div>
      )}

      {/* Cert Expiration Alerts */}
      {certAlerts.length > 0 && (
        <div className="space-y-2">
          {certAlerts.map((cert) => (
            <div key={cert.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${cert.daysLeft <= 0 ? 'bg-red-950/60 border-red-500/40' : cert.daysLeft <= 7 ? 'bg-amber-950/40 border-amber-500/30' : 'bg-amber-950/20 border-amber-500/20'}`}>
              <AlertTriangle size={16} className={cert.daysLeft <= 0 ? 'text-red-400' : 'text-amber-400'} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-200 uppercase tracking-widest truncate">{cert.name}{cert.licenseNumber ? ` (${cert.licenseNumber})` : ''}</p>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${cert.daysLeft <= 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {cert.daysLeft <= 0 ? `Expired ${Math.abs(cert.daysLeft)} day${Math.abs(cert.daysLeft) !== 1 ? 's' : ''} ago` : `Expires in ${cert.daysLeft} day${cert.daysLeft !== 1 ? 's' : ''}`}
                </p>
              </div>
              <button type="button" onClick={() => onNavigate?.('certifications')} className="text-[9px] text-slate-400 hover:text-white font-black uppercase tracking-widest transition-colors shrink-0">Renew</button>
            </div>
          ))}
        </div>
      )}

      {/* Onboarding Checklist */}
      {isManager && !onboardingComplete && !onboardingDismissed && (
        <Card>
          <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-4">
            <Award size={16} className="text-[#9cd33b]" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Getting Started</p>
            <button type="button" onClick={dismissOnboarding} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors" aria-label="Dismiss onboarding">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {onboardingSteps.map((step, i) => (
              <div key={i} className={`flex items-center gap-2 p-3 rounded-xl border ${step.done ? 'bg-[#9cd33b]/5 border-[#9cd33b]/30' : 'bg-slate-950 border-slate-800'}`}>
                {step.done ? <CheckCircle size={14} className="text-[#9cd33b] shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-600 shrink-0" />}
                <span className={`text-[10px] font-black uppercase tracking-widest ${step.done ? 'text-[#9cd33b]' : 'text-slate-500'}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12} className="text-[#9cd33b]" /> Missions</p>
          <p className="text-4xl font-black text-[#9cd33b] mt-3">{logs.length}</p>
        </Card>
        <Card>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Clock size={12} className="text-blue-400" /> Flight Hours</p>
          <p className="text-4xl font-black text-blue-400 mt-3">{totalFlightHours.toFixed(1)}</p>
        </Card>
        <Card>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><MapPin size={12} className="text-amber-400" /> Acres Treated</p>
          <p className="text-4xl font-black text-amber-400 mt-3">{totalAcres.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><User size={12} className="text-purple-400" /> Clients Served</p>
          <p className="text-4xl font-black text-purple-400 mt-3">{uniqueCustomers}</p>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: FileText, label: 'Log Mission', tab: 'log', color: 'from-[#9cd33b]/20 to-[#9cd33b]/5', border: 'border-[#9cd33b]/20', text: 'text-[#9cd33b]' },
          { icon: CalendarDays, label: 'New Order', tab: 'schedule', color: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400' },
          { icon: Users, label: 'Add Client', tab: 'customers', color: 'from-purple-500/20 to-purple-500/5', border: 'border-purple-500/20', text: 'text-purple-400' },
          { icon: Plane, label: 'Manage Fleet', tab: 'fleet', color: 'from-blue-500/20 to-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400' },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.tab}
              type="button"
              onClick={() => onNavigate?.(action.tab)}
              className={`flex items-center gap-3 p-4 rounded-2xl border bg-gradient-to-br ${action.color} ${action.border} hover:scale-[1.02] active:scale-[0.98] transition-all group`}
            >
              <div className={`p-2 rounded-xl bg-slate-950/50 ${action.text} group-hover:scale-110 transition-transform`}>
                <Icon size={16} />
              </div>
              <div className="text-left min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-widest ${action.text}`}>{action.label}</p>
                <Plus size={10} className="text-slate-500 mt-0.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Monthly Trends */}
      {logs.length > 0 && (() => {
        const charts = [
          { label: 'Missions / Month', field: 'missions', color: '#9cd33b', fmt: (v) => String(Math.round(v)) },
          { label: 'Flight Hours / Month', field: 'hours', color: '#60a5fa', fmt: (v) => v.toFixed(1) },
          { label: 'Acres Treated / Month', field: 'acres', color: '#fbbf24', fmt: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)) },
        ];
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {charts.map((chart) => {
              const vals = monthlyTrends.map((m) => m[chart.field]);
              const maxVal = Math.max(...vals, 1);
              const total = vals.reduce((s, v) => s + v, 0);
              const avg = vals.length > 0 ? total / vals.filter(v => v > 0).length || 0 : 0;
              // Trend: compare last 2 months
              const last = vals[vals.length - 1] || 0;
              const prev = vals[vals.length - 2] || 0;
              const trendPct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
              return (
                <Card key={chart.field}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <BarChart3 size={12} style={{ color: chart.color }} /> {chart.label}
                    </p>
                    {trendPct !== 0 && (
                      <span className={`text-[9px] font-black uppercase tracking-widest ${trendPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trendPct > 0 ? '▲' : '▼'} {Math.abs(trendPct)}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-black" style={{ color: chart.color }}>{chart.fmt(total)}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">total</span>
                    {avg > 0 && <span className="text-[9px] text-slate-600 font-bold">({chart.fmt(avg)} avg/mo)</span>}
                  </div>
                  <div className="relative h-36">
                    {/* Gridlines */}
                    {[0, 25, 50, 75, 100].map((g) => (
                      <div key={g} className="absolute left-0 right-0 border-t border-slate-800/60" style={{ bottom: `${g}%` }}>
                        {g > 0 && <span className="absolute -top-2.5 -left-0.5 text-[7px] text-slate-700 font-bold">{chart.fmt(maxVal * g / 100)}</span>}
                      </div>
                    ))}
                    <div className="flex items-end gap-2 h-full relative z-10">
                      {monthlyTrends.map((m, i) => {
                        const pct = maxVal > 0 ? (vals[i] / maxVal) * 100 : 0;
                        return (
                          <div key={m.key} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                            {/* Tooltip on hover */}
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 z-20 whitespace-nowrap pointer-events-none">
                              <span className="text-[9px] font-black" style={{ color: chart.color }}>{vals[i] > 0 ? chart.fmt(vals[i]) : '0'}</span>
                            </div>
                            <div className="w-full flex-1 flex items-end">
                              <div
                                className="w-full rounded-t-lg transition-all duration-500 group-hover:brightness-125 relative overflow-hidden"
                                style={{ height: `${Math.max(pct, 3)}%`, opacity: vals[i] > 0 ? 1 : 0.12 }}
                              >
                                <div className="absolute inset-0 rounded-t-lg" style={{ background: `linear-gradient(to top, ${chart.color}66, ${chart.color})` }} />
                              </div>
                            </div>
                            <span className="text-[8px] font-bold text-slate-500 uppercase mt-1.5">{m.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* Original Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative group">
          <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Plane size={14} className="text-[#9cd33b]" /> Active Fleet</p>
          </div>
          {(fleet || []).map((d, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl mb-3 flex flex-col gap-2 min-w-0 shadow-sm">
              <div className="flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <span className="text-sm font-black text-slate-100 block truncate">{String(d.id)}</span>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 truncate">{String(d.model)} | S/N: {String(d.sn || 'N/A')}</p>
                </div>
              </div>
            </div>
          ))}
          {(fleet || []).length === 0 && <p className="text-[10px] text-slate-500 font-bold uppercase text-center py-4">No aircraft in fleet</p>}
        </Card>

        <Card className="min-w-0">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest flex items-center gap-2"><User size={14} className="text-[#9cd33b]" /> PIC In-Charge</p>
          <p className="text-xl font-black text-slate-100 uppercase tracking-tight truncate">{String(company?.supervisor || 'N/A')}</p>
          <p className="text-xs text-[#9cd33b] font-black mt-2 uppercase tracking-widest truncate">{String(company?.name || 'N/A')}</p>
          <p className="text-[10px] text-slate-500 font-mono mt-4 uppercase tracking-widest p-4 bg-slate-950 rounded-xl border border-slate-800 truncate">FAA Exemption: <span className="text-slate-300">{String(company?.exemption || 'N/A')}</span></p>
        </Card>

        <Card>
          <p className="text-[10px] font-black text-slate-500 uppercase mb-6 tracking-widest flex items-center gap-2"><History size={14} className="text-[#9cd33b]" /> Database Metrics</p>
          <div className="flex items-baseline gap-4 mb-4">
            <span className="text-5xl font-black text-[#9cd33b] truncate">{logs.length}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Missions Logged</span>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-black text-slate-300 truncate">{maintRecords.length}</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">Maintenance Records</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
