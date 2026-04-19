import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Users, Plane, FileText, CalendarDays, Award, FlaskConical, ArrowRight } from 'lucide-react';

const CATEGORIES = [
  { key: 'customers', icon: Users, label: 'Customers', color: 'text-purple-400' },
  { key: 'fleet', icon: Plane, label: 'Aircraft', color: 'text-[#9cd33b]' },
  { key: 'logs', icon: FileText, label: 'Flight Logs', color: 'text-blue-400' },
  { key: 'orders', icon: CalendarDays, label: 'Work Orders', color: 'text-amber-400' },
  { key: 'certs', icon: Award, label: 'Certifications', color: 'text-emerald-400' },
  { key: 'products', icon: FlaskConical, label: 'Products', color: 'text-cyan-400' },
];

const GlobalSearch = ({ open, onClose, customers = [], fleet = [], logs = [], workOrders = [], certifications = [], products = [], onNavigate }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onClose?.(!open);
      }
      if (e.key === 'Escape' && open) onClose?.(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const match = useCallback((text) => {
    if (!query) return false;
    return String(text || '').toLowerCase().includes((query || '').toLowerCase());
  }, [query]);

  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    const items = [];

    customers.forEach((c) => {
      if (match(c.name) || match(c.contactName) || match(c.email) || match(c.city)) {
        items.push({ cat: 'customers', title: c.name, sub: [c.contactName, c.city].filter(Boolean).join(' • '), tab: 'customers' });
      }
    });

    fleet.forEach((d) => {
      if (match(d.id) || match(d.model) || match(d.sn)) {
        items.push({ cat: 'fleet', title: d.id, sub: `${d.model} • S/N: ${d.sn || 'N/A'}`, tab: 'fleet' });
      }
    });

    logs.forEach((l) => {
      if (match(l.customer) || match(l.locationName) || match(l.chemical) || match(l.date)) {
        items.push({ cat: 'logs', title: `${l.date} — ${l.customer || 'Unknown'}`, sub: [l.locationName, l.chemical, `${l.treatedAcreage || l.totalAcreage || '?'} ac`].filter(Boolean).join(' • '), tab: 'log' });
      }
    });

    workOrders.forEach((w) => {
      if (match(w.title) || match(w.customer) || match(w.status) || match(w.date)) {
        items.push({ cat: 'orders', title: w.title || 'Untitled Order', sub: [w.customer, w.status, w.date].filter(Boolean).join(' • '), tab: 'schedule' });
      }
    });

    certifications.forEach((c) => {
      if (match(c.name) || match(c.licenseNumber) || match(c.certState)) {
        items.push({ cat: 'certs', title: c.name, sub: [c.licenseNumber, c.certState, c.expirationDate].filter(Boolean).join(' • '), tab: 'certifications' });
      }
    });

    products.forEach((p) => {
      if (match(p.name) || match(p.description)) {
        items.push({ cat: 'products', title: p.name, sub: [p.defaultRate ? `${p.defaultRate} oz/ac` : '', p.inventory ? `${p.inventory} gal` : ''].filter(Boolean).join(' • '), tab: 'products' });
      }
    });

    return items.slice(0, 30);
  }, [query, customers, fleet, logs, workOrders, certifications, products, match]);

  const grouped = useMemo(() => {
    const map = {};
    results.forEach((r) => {
      if (!map[r.cat]) map[r.cat] = [];
      map[r.cat].push(r);
    });
    return CATEGORIES.filter((c) => map[c.key]).map((c) => ({ ...c, items: map[c.key] }));
  }, [results]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => onClose?.(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-slate-800">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, aircraft, logs, orders..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none font-bold"
          />
          <kbd className="hidden sm:inline text-[9px] text-slate-500 font-mono bg-slate-800 px-2 py-1 rounded-lg border border-slate-700">ESC</kbd>
          <button type="button" onClick={() => onClose?.(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            <div className="p-8 text-center">
              <Search size={28} className="text-slate-700 mx-auto mb-3" />
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Type 2+ characters to search</p>
              <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-1">Ctrl+K to toggle</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="py-2">
              {grouped.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.key}>
                    <div className="px-4 py-2 flex items-center gap-2">
                      <Icon size={12} className={group.color} />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{group.label}</span>
                      <span className="text-[8px] text-slate-600 font-bold">{group.items.length}</span>
                    </div>
                    {group.items.map((item, i) => (
                      <button
                        key={`${group.key}-${i}`}
                        type="button"
                        onClick={() => { onNavigate?.(item.tab); onClose?.(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800/60 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-200 truncate">{item.title}</p>
                          {item.sub && <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate mt-0.5">{item.sub}</p>}
                        </div>
                        <ArrowRight size={12} className="text-slate-600 group-hover:text-slate-300 shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
