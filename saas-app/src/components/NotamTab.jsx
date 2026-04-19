import React from 'react';
import { Navigation, X, Edit3, Trash2, Plus } from 'lucide-react';
import { Card, Button, tw as uiTw } from './ui/components';

// TW Config Objects - Exact match from original
const tw = {
  input: "w-full bg-slate-950/50 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b]/60 focus:ring-4 focus:ring-[#9cd33b]/10 focus:bg-slate-900 transition-all duration-300 min-w-0 shadow-inner",
  label: "text-[10px] text-slate-400 font-black uppercase tracking-widest pl-1 truncate block group-focus-within:text-[#9cd33b] transition-colors",
  btnBase: "px-5 py-3.5 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.96] relative overflow-hidden group",
  btnPrimary: "bg-gradient-to-r from-[#9cd33b] to-[#7ab02b] text-[#020617] shadow-[0_0_15px_rgba(156,211,59,0.2)] hover:shadow-[0_0_25px_rgba(156,211,59,0.4)] border border-[#bce455]/50",
  btnSecondary: "bg-slate-800/80 backdrop-blur-md text-slate-200 hover:bg-slate-700 hover:shadow-lg border border-slate-700/50 hover:border-slate-600",
  btnDanger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  thead: "bg-slate-800/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-800",
  th: "p-6",
  tr: "hover:bg-slate-800/40 border-b border-slate-800/50 transition-colors",
  td: "p-6",
  actionBtnEdit: "text-blue-500 hover:text-blue-400 mr-4 p-2 transition-colors",
  actionBtnDel: "text-red-500 hover:text-red-400 p-2 transition-colors"
};

const copyToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try { document.execCommand('copy'); } catch (err) {}
  document.body.removeChild(textArea);
};

const NotamTab = ({ notams, isEditing, state, setState, onCancel, onSubmit, onDelete, derived, generate, notify, company }) => {
  if (isEditing) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex">
          <button
            type="button"
            onClick={onCancel}
            className={`${tw.btnBase} ${tw.btnSecondary} py-2 px-3`}
          >
            <X size={14} /> Cancel
          </button>
        </div>
        <Card className="border-[#9cd33b]/20">
        <div className="bg-slate-900 border border-[#9cd33b]/20 rounded-2xl p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-[#9cd33b] mb-8 border-b border-slate-800 pb-6 min-w-0">
            <Navigation size={24} className="shrink-0" />
            <h3 className="text-xl font-black uppercase tracking-tighter truncate">FAA Flight Service Bridge</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 min-w-0">
            <div className="space-y-6 min-w-0">
              <div className="space-y-2"><label className={tw.label}>Filing Date</label><input type="date" className={tw.input} value={state.date} onChange={e => setState({...state, date: e.target.value})} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2 min-w-0">
                  <div className="space-y-2"><label className={tw.label}>Local Start</label><input type="time" className={tw.input} value={state.localStartTime} onChange={e => setState({...state, localStartTime: e.target.value})} /></div>
                  <div className="text-[9px] font-black text-[#9cd33b] uppercase pl-1 truncate">Zulu: {derived.utcStart}Z</div>
                </div>
                <div className="space-y-2"><label className={tw.label}>Radius</label><div className="relative"><input type="number" step="any" className={tw.input} value={state.radius} onChange={e => setState({...state, radius: e.target.value})} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">NM</span></div></div>
                <div className="space-y-2"><label className={tw.label}>Duration</label><div className="relative"><input type="number" step="any" className={tw.input} value={state.duration} onChange={e => setState({...state, duration: e.target.value})} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">HRS</span></div></div>
              </div>

              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 min-w-0">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-800 pb-4 min-w-0">
                  <span className="text-[10px] font-black uppercase text-[#9cd33b] tracking-widest truncate">Airspace Coordinates</span>
                  <select
                    className="bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 p-3 rounded-xl outline-none w-full sm:w-auto truncate"
                    value={state.coordType}
                    onChange={e => setState({...state, coordType: e.target.value})}
                  >
                    <option value="Decimal">Decimal Degrees</option>
                    <option value="DMS">DMS (Deg/Min/Sec)</option>
                  </select>
                </div>
                {state.coordType === 'Decimal' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-w-0">
                    <div className="space-y-2 min-w-0">
                      <label className="text-[10px] text-slate-400 font-black uppercase pl-1 block truncate">Latitude</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors"
                          value={state.latDec}
                          onChange={e => setState({...state, latDec: e.target.value})}
                        />
                        <select
                          className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm font-bold text-slate-200 outline-none focus:border-[#9cd33b] transition-colors"
                          value={state.latDecDir || 'N'}
                          onChange={e => setState({...state, latDecDir: e.target.value})}
                        >
                          <option value="N">N</option>
                          <option value="S">S</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <label className="text-[10px] text-slate-400 font-black uppercase pl-1 block truncate">Longitude</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="any"
                          className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors"
                          value={state.lonDec}
                          onChange={e => setState({...state, lonDec: e.target.value})}
                        />
                        <select
                          className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm font-bold text-slate-200 outline-none focus:border-[#9cd33b] transition-colors"
                          value={state.lonDecDir || 'W'}
                          onChange={e => setState({...state, lonDecDir: e.target.value})}
                        >
                          <option value="W">W</option>
                          <option value="E">E</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-w-0">
                    <div className="space-y-2 min-w-0">
                      <label className="text-[10px] text-slate-400 font-black uppercase truncate block">Latitude (D/M/S)</label>
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          type="number"
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200"
                          placeholder="Deg"
                          value={state.latDMS.d}
                          onChange={e => setState({...state, latDMS: {...state.latDMS, d: e.target.value}})}
                        />
                        <input
                          type="number"
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200"
                          placeholder="Min"
                          value={state.latDMS.m}
                          onChange={e => setState({...state, latDMS: {...state.latDMS, m: e.target.value}})}
                        />
                        <input
                          type="number"
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200"
                          placeholder="Sec"
                          value={state.latDMS.s}
                          onChange={e => setState({...state, latDMS: {...state.latDMS, s: e.target.value}})}
                        />
                        <select
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl font-bold text-slate-200 text-center outline-none"
                          value={state.latDMS.dir}
                          onChange={e => setState({...state, latDMS: {...state.latDMS, dir: e.target.value}})}
                        >
                          <option>N</option><option>S</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2 min-w-0">
                      <label className="text-[10px] text-slate-400 font-black uppercase truncate block">Longitude (D/M/S)</label>
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          type="number"
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200"
                          placeholder="Deg"
                          value={state.lonDMS.d}
                          onChange={e => setState({...state, lonDMS: {...state.lonDMS, d: e.target.value}})}
                        />
                        <input
                          type="number"
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200"
                          placeholder="Min"
                          value={state.lonDMS.m}
                          onChange={e => setState({...state, lonDMS: {...state.lonDMS, m: e.target.value}})}
                        />
                        <input
                          type="number"
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200"
                          placeholder="Sec"
                          value={state.lonDMS.s}
                          onChange={e => setState({...state, lonDMS: {...state.lonDMS, s: e.target.value}})}
                        />
                        <select
                          className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl font-bold text-slate-200 text-center outline-none"
                          value={state.lonDMS.dir}
                          onChange={e => setState({...state, lonDMS: {...state.lonDMS, dir: e.target.value}})}
                        >
                          <option>W</option><option>E</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-slate-950 p-8 rounded-[2rem] border border-slate-800 flex flex-col shadow-inner min-w-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 min-w-0">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest truncate">Verified Output</span>
                <div className="flex gap-4 shrink-0">
                  <button
                    onClick={() => { setState({...state, script: generate()}); notify("Script Staged", "info"); }}
                    className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase"
                  >
                    Stage
                  </button>
                  <button
                    onClick={() => {copyToClipboard(generate()); notify("Copied!", "success");}}
                    className="text-[#9cd33b] hover:text-[#bce455] text-[10px] font-black uppercase"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="flex-1 font-mono text-xs leading-loose text-[#9cd33b] bg-slate-900/50 p-6 rounded-2xl border border-slate-800 break-all whitespace-normal overflow-y-auto">
                {generate()}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-w-0">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[#9cd33b] font-black uppercase text-[10px] tracking-widest">Log Filed NOTAM</h3>
            <button
              onClick={onSubmit}
              className={`${tw.btnBase} ${tw.btnPrimary}`}
            >
              Archive NOTAM
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><label className={tw.label}>Date Filed</label><input type="date" className={tw.input} value={state.date} onChange={e => setState({...state, date: e.target.value})} required /></div>
            <div className="space-y-2"><label className={tw.label}>NOTAM Number</label><input className={tw.input} value={state.notamNumber} onChange={e => setState({...state, notamNumber: e.target.value})} required /></div>
            <div className="md:col-span-2 space-y-2"><label className={tw.label}>Filed Script Details</label><textarea rows={4} className={`${tw.input} resize-vertical`} value={state.script} onChange={e => setState({...state, script: e.target.value})} required /></div>
          </div>
        </div>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-8 animate-fade-in">
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 !p-6 border-[#9cd33b]/20">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <Navigation size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">NOTAM Archives</h2>
            <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">Manage Database Records</p>
          </div>
        </div>
        <Button type="button" onClick={() => setState({ ...defaultNotamState, isEditing: true })} className="flex-1 md:flex-none">
          <Plus size={16} /> Create NOTAM
        </Button>
      </Card>
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-[3rem] overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px] min-w-[600px]">
        <thead className={tw.thead}>
          <tr>
            <th className={tw.th}>Date</th>
            <th className={tw.th}>NOTAM Number</th>
            <th className={tw.th}>Script</th>
            <th className={tw.th + " text-right"}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {notams.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">No NOTAMs.</td></tr>}
          {notams.map(n => (
            <tr key={n.id} className={tw.tr}>
              <td className={tw.td + " min-w-[100px]"}>
                <p className="font-black text-slate-100 text-sm break-words">{String(n.date)}</p>
              </td>
              <td className={tw.td + " min-w-[120px]"}>
                <span className="text-[11px] font-black text-[#9cd33b] bg-slate-950 px-3 py-1 rounded-full border border-slate-800 break-words">
                  {String(n.notamNumber)}
                </span>
              </td>
              <td className={tw.td + " min-w-[200px]"}>
                <p className="text-[9px] font-mono text-slate-300 line-clamp-2 max-w-sm break-all whitespace-normal">
                  {String(n.script)}
                </p>
              </td>
              <td className={tw.td + " text-right whitespace-nowrap"}>
                <button onClick={() => setState({...n, isEditing: true})} className={tw.actionBtnEdit}><Edit3 size={16} /></button>
                <button onClick={() => onDelete('notam_logs', n.id)} className={tw.actionBtnDel}><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      </div>
    </div>
  );
};

const defaultNotamState = {
  date: new Date().toLocaleDateString('en-CA'),
  notamNumber: '',
  script: '',
  localStartTime: '08:00',
  duration: '4',
  radius: '0.5',
  coordType: 'Decimal',
  latDec: '',
  lonDec: '',
  latDecDir: 'N',
  lonDecDir: 'W',
  latDMS: { d: '', m: '', s: '', dir: 'N' },
  lonDMS: { d: '', m: '', s: '', dir: 'W' }
};

export default NotamTab;
