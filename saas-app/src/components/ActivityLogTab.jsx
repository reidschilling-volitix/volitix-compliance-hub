import { useState, useMemo } from 'react';
import { Activity, Search, Filter } from 'lucide-react';
import { Card } from './ui/components';

const ACTION_COLORS = {
  login: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  register: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  create: 'text-[#9cd33b] bg-[#9cd33b]/10 border-[#9cd33b]/30',
  update: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  delete: 'text-red-400 bg-red-500/10 border-red-500/30',
  export: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  settings: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
  billing: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
};

const getColor = (action) => {
  const key = Object.keys(ACTION_COLORS).find((k) => String(action || '').toLowerCase().includes(k));
  return ACTION_COLORS[key] || ACTION_COLORS.update;
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const ActivityLogTab = ({ activityLog = [], customUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const isManager = customUser?.role === 'Manager';

  const actionTypes = useMemo(() => {
    const types = new Set(activityLog.map((e) => e.action).filter(Boolean));
    return ['all', ...Array.from(types).sort()];
  }, [activityLog]);

  const filtered = useMemo(() => {
    let items = [...activityLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (filterAction !== 'all') items = items.filter((e) => e.action === filterAction);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((e) =>
        String(e.action || '').toLowerCase().includes(q) ||
        String(e.detail || '').toLowerCase().includes(q) ||
        String(e.username || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [activityLog, filterAction, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 !p-6 border-[#9cd33b]/20">
        <div className="flex items-center gap-5 min-w-0">
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <Activity size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">Activity Log</h2>
            <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">{filtered.length} event{filtered.length !== 1 ? 's' : ''} recorded</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-56 bg-slate-950 border border-slate-800 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 outline-none focus:border-[#9cd33b] transition-colors"
            />
          </div>
          <div className="relative min-w-0">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full sm:w-44 bg-slate-950 border border-slate-800 pl-9 pr-4 py-2.5 rounded-xl text-xs text-slate-200 outline-none focus:border-[#9cd33b] transition-colors appearance-none"
            >
              {actionTypes.map((t) => (
                <option key={t} value={t} className="bg-slate-900">{t === 'all' ? 'All Actions' : t}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest py-8">No activity events found</p>
          </Card>
        ) : (
          filtered.slice(0, 100).map((event) => (
            <div key={event.id} className="flex items-start gap-4 bg-slate-900/50 border border-slate-800/50 p-4 rounded-2xl hover:bg-slate-800/30 transition-colors">
              <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center border ${getColor(event.action)}`}>
                <Activity size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getColor(event.action)}`}>{event.action}</span>
                  {isManager && event.username && (
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{event.username}</span>
                  )}
                </div>
                <p className="text-sm text-slate-300 font-bold mt-1 break-words">{event.detail}</p>
              </div>
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest shrink-0 mt-1">{timeAgo(event.timestamp)}</span>
            </div>
          ))
        )}
        {filtered.length > 100 && (
          <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest py-2">Showing first 100 of {filtered.length} events</p>
        )}
      </div>
    </div>
  );
};

export default ActivityLogTab;
