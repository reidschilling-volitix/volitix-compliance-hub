import { useMemo, useState, useRef, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, Plane, Award, X, FlaskConical, Wrench } from 'lucide-react';

const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d)) return Infinity;
  return Math.ceil((d - new Date()) / 86400000);
};

const NotificationCenter = ({ certifications = [], subscription, fleetCount = 0, allowedSeats = 0, isManager = false, products = [], equipmentList = [] }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const alerts = useMemo(() => {
    const items = [];

    // Cert expiration alerts
    certifications.forEach((c) => {
      const days = daysUntil(c.expirationDate);
      if (days <= 30) {
        items.push({
          id: `cert-${c.id}`,
          type: days <= 0 ? 'critical' : days <= 7 ? 'warning' : 'info',
          icon: Award,
          title: days <= 0 ? `${c.name} EXPIRED` : `${c.name} expiring`,
          detail: days <= 0
            ? `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`
            : `${days} day${days !== 1 ? 's' : ''} remaining`,
          sort: days,
        });
      }
    });

    // Trial countdown
    if (subscription?.status === 'trialing') {
      const ends = subscription.trialEndsAt || subscription.currentPeriodEnd;
      if (ends) {
        const days = Math.max(0, daysUntil(ends));
        items.push({
          id: 'trial',
          type: days <= 3 ? 'critical' : days <= 7 ? 'warning' : 'info',
          icon: Clock,
          title: `Free trial: ${days} day${days !== 1 ? 's' : ''} left`,
          detail: 'Subscribe to keep your data and team access',
          sort: days,
        });
      }
    }

    // Past due
    if (subscription?.status === 'past_due') {
      items.push({
        id: 'past-due',
        type: 'critical',
        icon: AlertTriangle,
        title: 'Payment past due',
        detail: 'Update billing to avoid service interruption',
        sort: -100,
      });
    }

    // Fleet capacity
    if (isManager && allowedSeats > 0) {
      const pct = Math.round((fleetCount / allowedSeats) * 100);
      if (fleetCount > allowedSeats) {
        items.push({
          id: 'fleet-over',
          type: 'critical',
          icon: Plane,
          title: `Fleet over capacity`,
          detail: `${fleetCount} drones / ${allowedSeats} seats — add seats or remove aircraft`,
          sort: -50,
        });
      } else if (pct >= 80) {
        items.push({
          id: 'fleet-near',
          type: 'warning',
          icon: Plane,
          title: `Fleet near capacity (${pct}%)`,
          detail: `${fleetCount} of ${allowedSeats} seats used`,
          sort: 10,
        });
      }
    }

    // Low-stock inventory alerts
    products.forEach((p) => {
      if (p.lowStockThreshold && parseFloat(p.inventory || 0) <= parseFloat(p.lowStockThreshold)) {
        const inv = parseFloat(p.inventory || 0).toFixed(1);
        items.push({
          id: `lowstock-${p.id}`,
          type: parseFloat(p.inventory || 0) <= 0 ? 'critical' : 'warning',
          icon: FlaskConical,
          title: `${p.name} low stock`,
          detail: `${inv} gal remaining (threshold: ${p.lowStockThreshold})`,
          sort: 5,
        });
      }
    });

    // Maintenance due reminders
    equipmentList.forEach((eq) => {
      if (eq.nextServiceDate) {
        const days = daysUntil(eq.nextServiceDate);
        if (days <= 14) {
          items.push({
            id: `maint-${eq.id}`,
            type: days <= 0 ? 'critical' : days <= 3 ? 'warning' : 'info',
            icon: Wrench,
            title: days <= 0 ? `${eq.name} service overdue` : `${eq.name} service due`,
            detail: days <= 0 ? `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}` : `Due in ${days} day${days !== 1 ? 's' : ''}`,
            sort: days,
          });
        }
      }
    });

    items.sort((a, b) => a.sort - b.sort);
    return items;
  }, [certifications, subscription, fleetCount, allowedSeats, isManager, products, equipmentList]);

  const criticalCount = alerts.filter((a) => a.type === 'critical').length;
  const totalCount = alerts.length;

  const TYPE_STYLES = {
    critical: 'bg-red-100 border-red-400 text-red-700',
    warning: 'bg-amber-100 border-amber-400 text-amber-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700',
  };

  const ICON_STYLES = {
    critical: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all font-black uppercase tracking-widest text-[10px] ${
          criticalCount > 0
            ? 'text-white bg-red-600 border border-red-500 hover:bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]'
            : totalCount > 0
            ? 'text-white bg-amber-600 border border-amber-500 hover:bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
            : 'text-slate-200 hover:text-[#9cd33b] bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-[#9cd33b]/30'
        }`}
        aria-label="Notifications"
      >
        <Bell size={18} />
        <span className="hidden sm:inline">{totalCount > 0 ? `${totalCount} Alert${totalCount !== 1 ? 's' : ''}` : 'Alerts'}</span>
        {totalCount > 0 && (
          <span className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] flex items-center justify-center text-[10px] font-black rounded-full px-1 ${
            criticalCount > 0
              ? 'bg-white text-red-600 ring-2 ring-red-600'
              : 'bg-white text-amber-600 ring-2 ring-amber-600'
          }`}>
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed top-0 right-0 z-[9999] h-full w-[400px] max-w-[90vw] bg-white flex flex-col shadow-[-4px_0_30px_rgba(0,0,0,0.3)]" style={{ animation: 'slideInRight 0.2s ease-out' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${criticalCount > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <Bell size={16} className={criticalCount > 0 ? 'text-red-600' : 'text-amber-600'} />
                </div>
                <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Alerts ({totalCount})</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-10 text-center">
                  <Bell size={32} className="text-gray-300 mx-auto mb-4" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">All clear — no alerts</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {alerts.map((alert) => {
                    const Icon = alert.icon;
                    return (
                      <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-xl border-l-4 border ${TYPE_STYLES[alert.type]}`}>
                        <Icon size={18} className={`shrink-0 mt-0.5 ${ICON_STYLES[alert.type]}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black uppercase tracking-wide">{alert.title}</p>
                          <p className="text-[11px] font-semibold mt-1 opacity-75">{alert.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
