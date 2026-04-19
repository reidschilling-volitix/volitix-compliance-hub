import React, { useEffect, useMemo, useState } from 'react';
import { Plane, Cloud, X, Edit3, Trash2, FileText, ShieldCheck, Download, ChevronUp, ChevronDown, CheckSquare, ClipboardCheck } from 'lucide-react';
import { Button, FormCard, TableCard, tw } from './ui/components';

const defaultCustomerState = {
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
  assignedTo: []
};

const defaultProductState = {
  name: '',
  defaultRate: '',
  inventory: '',
  description: ''
};

const MissionLogTab = ({ logs, notams, fleet, customers, products, crops, isEditing, state, setState, onCancel, onSubmit, onDelete, kmlRef, handleKml, notify }) => {
  const [inlineCustomer, setInlineCustomer] = useState(false);
  const [newCustData, setNewCustData] = useState(defaultCustomerState);
  const [inlineProduct, setInlineProduct] = useState(false);
  const [newProdData, setNewProdData] = useState(defaultProductState);
  const [pasteVal, setPasteVal] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = (ids) => setSelectedIds((prev) => prev.size === ids.length ? new Set() : new Set(ids));
  const handleBulkDelete = () => {
    selectedIds.forEach((id) => onDelete('flight_logs', id));
    setSelectedIds(new Set());
    notify(`${selectedIds.size} flight log${selectedIds.size !== 1 ? 's' : ''} deleted.`, 'success');
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const sortedLogs = useMemo(() => {
    const arr = [...logs];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let va, vb;
      switch (sortField) {
        case 'date': va = a.date || ''; vb = b.date || ''; break;
        case 'customer': va = (a.customer || '').toLowerCase(); vb = (b.customer || '').toLowerCase(); break;
        case 'chemical': va = (a.chemical || '').toLowerCase(); vb = (b.chemical || '').toLowerCase(); break;
        case 'acres': va = parseFloat(a.treatedAcreage || a.totalAcreage) || 0; vb = parseFloat(b.treatedAcreage || b.totalAcreage) || 0; return (va - vb) * dir;
        default: return 0;
      }
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return arr;
  }, [logs, sortField, sortDir]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={10} className="inline ml-1" /> : <ChevronDown size={10} className="inline ml-1" />;
  };
  const [parsedSuccess, setParsedSuccess] = useState(false);

  // Auto-calc flight time from start/end when form loads with both set
  useEffect(() => {
    if (isEditing && state.startTime && state.endTime && String(state.startTime).includes(':') && String(state.endTime).includes(':')) {
      const [sh, sm] = state.startTime.split(':').map(Number);
      const [eh, em] = state.endTime.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 1440;
        if (diff > 0) {
          const hrs = (diff / 60).toFixed(1);
          if (state.flightTimeValue !== hrs) {
            setState(prev => ({ ...prev, flightTimeValue: hrs, flightTimeUnit: 'Hours', flightTimeMinutes: String(diff) }));
          }
        }
      }
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCoordPaste = (e) => {
    const val = e.target.value;
    setPasteVal(val);
    const str = val.trim().toUpperCase();
    // DMS format: 38°31'49.64"N 90°14'13.92"W
    const dmsRegex = /(\d+)[^\d]+(\d+)[^\d]+([\d.]+)[^\dNS]*([NS])[^\d]*(\d+)[^\d]+(\d+)[^\d]+([\d.]+)[^\dEW]*([EW])/;
    const dmsMatch = str.match(dmsRegex);
    if (dmsMatch) {
      const latDecVal = (parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600).toFixed(6);
      const lonDecVal = (parseInt(dmsMatch[5]) + parseInt(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600).toFixed(6);
      const newLatDMS = { d: dmsMatch[1], m: dmsMatch[2], s: dmsMatch[3], dir: dmsMatch[4] };
      const newLonDMS = { d: dmsMatch[5], m: dmsMatch[6], s: dmsMatch[7], dir: dmsMatch[8] };
      setState((prev) => ({ ...prev, coordType: 'DMS', latDMS: newLatDMS, lonDMS: newLonDMS, latDec: latDecVal, latDecDir: dmsMatch[4], lonDec: lonDecVal, lonDecDir: dmsMatch[8] }));
      setParsedSuccess(true);
      setTimeout(() => setParsedSuccess(false), 3000);
      return;
    }
    // Decimal format: 38.530456, -90.237200
    const decRegex = /([+-]?\d+\.\d+)[,\s]+([+-]?\d+\.\d+)/;
    const decMatch = str.match(decRegex);
    if (decMatch) {
      const lat = parseFloat(decMatch[1]);
      const lon = parseFloat(decMatch[2]);
      const decToDms = (deg, isLon) => {
        const abs = Math.abs(deg);
        const d = Math.floor(abs);
        const m = Math.floor((abs - d) * 60);
        const s = ((abs - d - m / 60) * 3600).toFixed(2);
        const dir = isLon ? (deg >= 0 ? 'E' : 'W') : (deg >= 0 ? 'N' : 'S');
        return { d: d.toString(), m: m.toString(), s: s.toString(), dir };
      };
      const newLatDec = Math.abs(lat).toFixed(6);
      const newLatDecDir = lat >= 0 ? 'N' : 'S';
      const newLonDec = Math.abs(lon).toFixed(6);
      const newLonDecDir = lon >= 0 ? 'E' : 'W';
      const newLatDMS = decToDms(lat, false);
      const newLonDMS = decToDms(lon, true);
      setState((prev) => ({ ...prev, coordType: 'Decimal', latDec: newLatDec, latDecDir: newLatDecDir, lonDec: newLonDec, lonDecDir: newLonDecDir, latDMS: newLatDMS, lonDMS: newLonDMS }));
      setParsedSuccess(true);
      setTimeout(() => setParsedSuccess(false), 3000);
    }
  };

  const fetchWeather = async () => {
    if (!state.date || !state.startTime) return notify("Please enter a Date and Start Time first.", "error");

    let lat = parseFloat(state.latDec), lon = parseFloat(state.lonDec);
    if (state.coordType === 'DMS') {
      lat = (parseFloat(state.latDMS.d || 0) + parseFloat(state.latDMS.m || 0) / 60 + parseFloat(state.latDMS.s || 0) / 3600) * (state.latDMS.dir === 'S' ? -1 : 1);
      lon = (parseFloat(state.lonDMS.d || 0) + parseFloat(state.lonDMS.m || 0) / 60 + parseFloat(state.lonDMS.s || 0) / 3600) * (state.lonDMS.dir === 'W' ? -1 : 1);
    }
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) return notify("Enter valid coordinates first to auto-fill weather.", "error");

    notify("Fetching historical weather data...", "info");
    try {
      const flightDate = new Date(state.date);
      const today = new Date();
      const daysDiff = (today - flightDate) / (1000 * 60 * 60 * 24);

      const baseUrl = daysDiff > 90 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';

      const res = await fetch(`${baseUrl}?latitude=${lat}&longitude=${lon}&start_date=${state.date}&end_date=${state.date}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
      const data = await res.json();

      if (!data.hourly || data.hourly.temperature_2m.length === 0) throw new Error("No data");

      const hour = parseInt(state.startTime.split(':')[0], 10);

      const t = data.hourly.temperature_2m[hour];
      const h = data.hourly.relative_humidity_2m[hour];
      const ws = data.hourly.wind_speed_10m[hour];
      let wd = data.hourly.wind_direction_10m[hour];

      if (t === null || t === undefined) throw new Error("Not available for this specific hour yet");

      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const dirIdx = Math.round(((wd %= 360) < 0 ? wd + 360 : wd) / 45) % 8;

      setState(prev => ({
        ...prev,
        temp: t,
        humidity: h,
        windSpeed: ws,
        windDirection: dirs[dirIdx]
      }));
      notify(`Weather auto-filled for ${state.date} at ${state.startTime}!`, "success");
    } catch (err) {
      console.error(err);
      notify("Failed to fetch weather. Date might be too far in the future or invalid.", "error");
    }
  };

  if (isEditing) {
    return (
      <FormCard
        title={state.id ? 'Edit Mission Record' : 'Log New Mission'}
        icon={Plane}
        onSubmit={(e) => onSubmit(e, inlineCustomer ? newCustData : null, inlineProduct ? newProdData : null)}
        onCancel={onCancel}
        submitLabel="Save To Vault"
      >
        <div className="space-y-12">
          <div className="space-y-6">
          <h3 className="text-[#9cd33b] font-black uppercase text-[10px] tracking-widest border-b border-slate-800 pb-2">Logistics & Fleet</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-w-0">
            <div className="space-y-2 lg:col-span-2 min-w-0">
              <label className={tw.label}>Aircraft Deployed</label>
              <div className="flex flex-wrap gap-2">
                {fleet.map((d, i) => {
                  const droneId = d.id || `Unknown-${i}`;
                  const isSelected = (state.selectedAircraft || []).includes(droneId);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const cur = state.selectedAircraft || [];
                        const newSelection = (cur || []).includes(droneId)
                          ? cur.filter(a => a !== droneId)
                          : [...cur, droneId];
                        setState({ ...state, selectedAircraft: newSelection });
                      }}
                      className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all truncate max-w-full ${
                        isSelected
                          ? 'bg-[#9cd33b] text-[#020617] border-[#9cd33b] shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-[#9cd33b]/50'
                      }`}
                    >
                      {String(droneId)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <label className={tw.label}>Date</label>
              <input type="date" className={tw.input} value={state.date} onChange={e => setState({ ...state, date: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className={tw.label}>Customer</label>
              <select
                className={tw.input}
                value={inlineCustomer ? 'ADD_NEW' : state.customer}
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    setInlineCustomer(true);
                  } else {
                    setInlineCustomer(false);
                    setState({ ...state, customer: e.target.value });
                  }
                }}
                required
              >
                <option className="bg-slate-900" value="">Select...</option>
                {customers.map(c => <option className="bg-slate-900" key={c.id} value={c.name}>{String(c.name)}</option>)}
                <option className="bg-slate-800 text-[#9cd33b]" value="ADD_NEW">+ Create New Customer</option>
              </select>
            </div>

            {inlineCustomer && (
              <div className="lg:col-span-4 p-6 bg-slate-950 border border-[#9cd33b]/50 rounded-2xl space-y-4 min-w-0 mt-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-2">
                  <span className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest truncate pr-2">New Customer Profile</span>
                  <button onClick={() => setInlineCustomer(false)} className={`${tw.btnBase} ${tw.btnSecondary} py-2 px-3 shrink-0`}><X size={14} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><label className={tw.label}>Company/Farm Name</label><input className={tw.input} value={newCustData.name} onChange={e => setNewCustData({ ...newCustData, name: e.target.value })} required /></div>
                  <div className="space-y-2"><label className={tw.label}>Contact Name</label><input className={tw.input} value={newCustData.contactName} onChange={e => setNewCustData({ ...newCustData, contactName: e.target.value })} /></div>
                  <div className="space-y-2"><label className={tw.label}>Email</label><input type="email" className={tw.input} value={newCustData.email} onChange={e => setNewCustData({ ...newCustData, email: e.target.value })} /></div>
                  <div className="space-y-2"><label className={tw.label}>Phone</label><input className={tw.input} value={newCustData.phone} onChange={e => setNewCustData({ ...newCustData, phone: e.target.value })} /></div>
                  <div className="md:col-span-2 space-y-2"><label className={tw.label}>Address</label><input className={tw.input} value={newCustData.address} onChange={e => setNewCustData({ ...newCustData, address: e.target.value })} /></div>
                  <div className="space-y-2"><label className={tw.label}>City</label><input className={tw.input} value={newCustData.city} onChange={e => setNewCustData({ ...newCustData, city: e.target.value })} /></div>
                  <div className="flex gap-4"><div className="flex-1 min-w-0 space-y-2"><label className={tw.label}>State</label><input className={tw.input} value={newCustData.state} onChange={e => setNewCustData({ ...newCustData, state: e.target.value })} /></div><div className="flex-1 min-w-0 space-y-2"><label className={tw.label}>Zip</label><input className={tw.input} value={newCustData.zip} onChange={e => setNewCustData({ ...newCustData, zip: e.target.value })} /></div></div>
                  <div className="md:col-span-2 space-y-2"><label className={tw.label}>Notes</label><textarea rows={4} className={`${tw.input} resize-vertical`} value={newCustData.notes} onChange={e => setNewCustData({ ...newCustData, notes: e.target.value })} /></div>
                </div>
              </div>
            )}

            <div className="space-y-2 lg:col-span-2 min-w-0">
              <label className={tw.label}>Flight Times</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <input type="time" className={`${tw.input} flex-1 w-full min-w-0`} value={state.startTime} onChange={e => {
                  const newStart = e.target.value;
                  const updated = { ...state, startTime: newStart };
                  if (newStart && state.endTime) {
                    const [sh, sm] = newStart.split(':').map(Number);
                    const [eh, em] = state.endTime.split(':').map(Number);
                    let diff = (eh * 60 + em) - (sh * 60 + sm);
                    if (diff < 0) diff += 1440;
                    if (diff > 0) { updated.flightTimeValue = (diff / 60).toFixed(1); updated.flightTimeUnit = 'Hours'; updated.flightTimeMinutes = String(diff); }
                  }
                  setState(updated);
                }} />
                <input type="time" className={`${tw.input} flex-1 w-full min-w-0`} value={state.endTime} onChange={e => {
                  const newEnd = e.target.value;
                  const updated = { ...state, endTime: newEnd };
                  if (state.startTime && newEnd) {
                    const [sh, sm] = state.startTime.split(':').map(Number);
                    const [eh, em] = newEnd.split(':').map(Number);
                    let diff = (eh * 60 + em) - (sh * 60 + sm);
                    if (diff < 0) diff += 1440;
                    if (diff > 0) { updated.flightTimeValue = (diff / 60).toFixed(1); updated.flightTimeUnit = 'Hours'; updated.flightTimeMinutes = String(diff); }
                  }
                  setState(updated);
                }} />
              </div>
            </div>

            <div className="space-y-2 lg:col-span-2 min-w-0">
              <label className={tw.label}>Total Flight Time</label>
              <div className="flex gap-2">
                <input type="number" className={tw.input} value={state.flightTimeValue} onChange={e => setState({ ...state, flightTimeValue: e.target.value })} required />
                <select className={`${tw.input} w-auto`} value={state.flightTimeUnit} onChange={e => setState({ ...state, flightTimeUnit: e.target.value })}>
                  <option>Hours</option>
                  <option>Minutes</option>
                </select>
              </div>
            </div>

            <div className="lg:col-span-4 bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 min-w-0 mt-2">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-800 pb-4 min-w-0">
                <span className="text-[10px] font-black uppercase text-[#9cd33b] tracking-widest truncate">Mission Coordinates</span>
                <select className="bg-slate-900 border border-slate-700 text-xs font-bold text-slate-300 p-3 rounded-xl outline-none w-full sm:w-auto truncate" value={state.coordType} onChange={e => setState({ ...state, coordType: e.target.value })}>
                  <option value="Decimal">Decimal Degrees</option>
                  <option value="DMS">DMS (Deg/Min/Sec)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className={tw.label}>Quick Paste (Google Earth / Decimals)</label>
                <input
                  type="text"
                  placeholder={`e.g. 38°31'49.64"N 90°14'13.92"W  or  38.530456, -90.237200`}
                  className={tw.input}
                  value={pasteVal}
                  onChange={handleCoordPaste}
                />
                {parsedSuccess && <p className="text-[9px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 animate-pulse">✓ Coordinates parsed successfully!</p>}
              </div>

              {state.coordType === 'Decimal' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 min-w-0">
                  <div className="space-y-2 min-w-0">
                    <label className={tw.label}>Latitude</label>
                    <div className="flex gap-2">
                      <input type="number" step="any" className={tw.input} value={state.latDec} onChange={e => setState({ ...state, latDec: e.target.value })} />
                      <select className={`${tw.input} w-auto`} value={state.latDecDir || 'N'} onChange={e => setState({ ...state, latDecDir: e.target.value })}>
                        <option value="N">N</option>
                        <option value="S">S</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className={tw.label}>Longitude</label>
                    <div className="flex gap-2">
                      <input type="number" step="any" className={tw.input} value={state.lonDec} onChange={e => setState({ ...state, lonDec: e.target.value })} />
                      <select className={`${tw.input} w-auto`} value={state.lonDecDir || 'W'} onChange={e => setState({ ...state, lonDecDir: e.target.value })}>
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
                      <input type="number" className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200" placeholder="Deg" value={state.latDMS.d} onChange={e => setState({ ...state, latDMS: { ...state.latDMS, d: e.target.value } })} />
                      <input type="number" className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200" placeholder="Min" value={state.latDMS.m} onChange={e => setState({ ...state, latDMS: { ...state.latDMS, m: e.target.value } })} />
                      <input type="number" className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200" placeholder="Sec" value={state.latDMS.s} onChange={e => setState({ ...state, latDMS: { ...state.latDMS, s: e.target.value } })} />
                      <select className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl font-bold text-slate-200 text-center outline-none" value={state.latDMS.dir} onChange={e => setState({ ...state, latDMS: { ...state.latDMS, dir: e.target.value } })}><option>N</option><option>S</option></select>
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] text-slate-400 font-black uppercase truncate block">Longitude (D/M/S)</label>
                    <div className="grid grid-cols-4 gap-2">
                      <input type="number" className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200" placeholder="Deg" value={state.lonDMS.d} onChange={e => setState({ ...state, lonDMS: { ...state.lonDMS, d: e.target.value } })} />
                      <input type="number" className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200" placeholder="Min" value={state.lonDMS.m} onChange={e => setState({ ...state, lonDMS: { ...state.lonDMS, m: e.target.value } })} />
                      <input type="number" className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs text-center text-slate-200" placeholder="Sec" value={state.lonDMS.s} onChange={e => setState({ ...state, lonDMS: { ...state.lonDMS, s: e.target.value } })} />
                      <select className="min-w-0 bg-slate-900 border border-slate-800 p-3 rounded-xl font-bold text-slate-200 text-center outline-none" value={state.lonDMS.dir} onChange={e => setState({ ...state, lonDMS: { ...state.lonDMS, dir: e.target.value } })}><option>W</option><option>E</option></select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <h3 className="text-blue-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-800 pb-2">Application Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><label className={tw.label}>Field Name</label><input className={tw.input} value={state.locationName} onChange={e => setState({ ...state, locationName: e.target.value })} /></div>
            <div className="space-y-2"><label className={tw.label}>Total Acreage</label><div className="relative"><input type="number" step="any" className={tw.input} value={state.totalAcreage} onChange={e => setState({ ...state, totalAcreage: e.target.value })} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">AC</span></div></div>
            <div className="space-y-2"><label className={tw.label}>Treated Acreage</label><div className="relative"><input type="number" step="any" className={tw.input} value={state.treatedAcreage} onChange={e => setState({ ...state, treatedAcreage: e.target.value })} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">AC</span></div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2 min-w-0">
              <label className={tw.label}>Target (Crop/Vegetation)</label>
              <select className={tw.input} value={state.whatWasTreated} onChange={e => setState({ ...state, whatWasTreated: e.target.value })}>
                <option className="bg-slate-900" value="">Select Crop...</option>
                <option className="bg-slate-900" value="Corn">Corn</option>
                <option className="bg-slate-900" value="Soybeans">Soybeans</option>
                {crops.filter(c => c.name !== 'Corn' && c.name !== 'Soybeans').map(c => (
                  <option key={c.id} className="bg-slate-900" value={c.name}>{String(c.name)}</option>
                ))}
                <option className="bg-slate-800 text-[#9cd33b]" value="ADD_NEW">+ Add Crop/Vegetation</option>
              </select>
              {state.whatWasTreated === 'ADD_NEW' && (
                <input placeholder="New Crop Name" className={tw.input} value={state.customCrop || ''} onChange={e => setState({ ...state, customCrop: e.target.value })} required />
              )}
            </div>
            <div className="space-y-2"><label className={tw.label}>Target Pest</label><input className={tw.input} value={state.targetPest} onChange={e => setState({ ...state, targetPest: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className={tw.label}>Nozzle Desc</label>
              <select className={tw.input} value={state.nozzleDesc} onChange={e => setState({ ...state, nozzleDesc: e.target.value })}>
              <option value="Atomizer Sprinklers">Atomizer Sprinklers</option>
              <option value="Flat Fan">Flat Fan</option>
              <option value="Hollow Cone">Hollow Cone</option>
              <option value="Solid Cone">Solid Cone</option>
              <option value="Other">Other...</option>
            </select>
            </div>
            <div className="space-y-2"><label className={tw.label}>Target Distance</label><div className="relative"><input type="number" step="any" className={tw.input} value={state.targetDistance} onChange={e => setState({ ...state, targetDistance: e.target.value })} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">FT</span></div></div>
            <div className="space-y-2"><label className={tw.label}>Pump Pressure</label><div className="relative"><input type="number" step="any" className={tw.input} value={state.pumpPressure} onChange={e => setState({ ...state, pumpPressure: e.target.value })} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">PSI</span></div></div>

            <div className="space-y-2 min-w-0">
              <label className={tw.label}>Speed</label>
              <div className="flex gap-2">
                <input type="number" step="any" className={tw.input} value={state.travelSpeed} onChange={e => setState({ ...state, travelSpeed: e.target.value })} />
                <select className={`${tw.input} w-auto`} value={state.speedUnit} onChange={e => setState({ ...state, speedUnit: e.target.value })}>
                  <option>ft/sec</option>
                  <option>mph</option>
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-2"><label className={tw.label}>Drift Management Strategy</label><textarea rows={4} className={`${tw.input} resize-vertical`} value={state.driftPractices} onChange={e => setState({ ...state, driftPractices: e.target.value })} /></div>
        </div>
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-[#9cd33b] font-black uppercase text-[10px] tracking-widest">Environment & Product</h3>
            <button onClick={fetchWeather} className="flex items-center gap-2 py-2 px-4 text-[9px] font-black uppercase tracking-widest rounded-2xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"><Cloud size={12} /> Auto-Fill Weather</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2 min-w-0">
              <label className={tw.label}>Chemical Product</label>
              <select
                className={tw.input}
                value={inlineProduct ? 'ADD_NEW' : state.chemical}
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    setInlineProduct(true);
                  } else {
                    setInlineProduct(false);
                    setState({ ...state, chemical: e.target.value });
                  }
                }}
                required
              >
                <option className="bg-slate-900" value="">Select Product...</option>
                {products.map(p => <option className="bg-slate-900" key={p.id} value={p.name}>{String(p.name)}</option>)}
                <option className="bg-slate-800 text-[#9cd33b]" value="ADD_NEW">+ Create New Product</option>
              </select>
              {inlineProduct && (
                <div className="p-6 bg-slate-950 border border-[#9cd33b]/50 rounded-2xl space-y-4 min-w-0 mt-2">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-2">
                    <span className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest truncate pr-2">New Product Profile</span>
                    <button onClick={() => setInlineProduct(false)} className={`${tw.btnBase} ${tw.btnSecondary} py-2 px-3 shrink-0`}><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2"><label className={tw.label}>Chemical Name</label><input className={tw.input} value={newProdData.name} onChange={e => setNewProdData({ ...newProdData, name: e.target.value })} required /></div>
                    <div className="space-y-2"><label className={tw.label}>Default Rate</label><div className="relative"><input type="number" step="any" className={tw.input} value={newProdData.defaultRate} onChange={e => setNewProdData({ ...newProdData, defaultRate: e.target.value })} required /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">oz/ac</span></div></div>
                    <div className="space-y-2"><label className={tw.label}>Current Inventory</label><div className="relative"><input type="number" step="any" className={tw.input} value={newProdData.inventory} onChange={e => setNewProdData({ ...newProdData, inventory: e.target.value })} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">Gal</span></div></div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2"><label className={tw.label}>Application Volume</label><div className="relative"><input type="number" step="any" className={tw.input} value={state.appRate} onChange={e => setState({ ...state, appRate: e.target.value })} /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">GPA</span></div></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            <div className="space-y-2 min-w-0">
              <label className={tw.label}>Wind</label>
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <input type="number" step="any" placeholder="Speed" className={tw.input} value={state.windSpeed} onChange={e => setState({ ...state, windSpeed: e.target.value })} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 font-black">mph</span>
                </div>
                <select className={`${tw.input} px-2 text-center`} value={state.windDirection} onChange={e => setState({ ...state, windDirection: e.target.value })}>
                  <option>N</option><option>NE</option><option>E</option><option>SE</option><option>S</option><option>SW</option><option>W</option><option>NW</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <label className={tw.label}>Temp</label>
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 min-w-0">
                <input type="number" step="any" className={tw.input} value={state.temp} onChange={e => setState({ ...state, temp: e.target.value })} />
                <select className={`${tw.input} px-2 text-center`} value={state.tempUnit} onChange={e => setState({ ...state, tempUnit: e.target.value })}>
                  <option>F</option><option>C</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <label className={tw.label}>Humidity</label>
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 min-w-0">
                <input type="number" step="any" className={tw.input} value={state.humidity} onChange={e => setState({ ...state, humidity: e.target.value })} />
                <div className={`${tw.input} flex items-center justify-center text-[10px] font-black tracking-widest`}>%</div>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setShowChecklist(p => !p)} className="w-full flex items-center justify-between text-[#9cd33b] font-black uppercase text-[10px] tracking-widest border-b border-slate-800 pb-2 hover:text-white transition-colors">
            <span className="flex items-center gap-2"><ClipboardCheck size={14} /> Pre-Flight Checklist</span>
            <span className="text-slate-500">{showChecklist ? '▲' : '▼'} {(state.checklist || []).filter(c => c.done).length}/{(state.checklist || []).length || 8}</span>
          </button>
          {showChecklist && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(state.checklist && state.checklist.length > 0 ? state.checklist : [
                { label: 'Battery fully charged & secured', done: false },
                { label: 'Propellers inspected, no damage', done: false },
                { label: 'Spray system primed & calibrated', done: false },
                { label: 'GPS / RTK signal verified', done: false },
                { label: 'Airspace authorization confirmed', done: false },
                { label: 'Wind within operational limits', done: false },
                { label: 'Emergency procedures reviewed', done: false },
                { label: 'Observers & crew briefed', done: false },
              ]).map((item, i) => (
                <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  item.done ? 'bg-[#9cd33b]/10 border-[#9cd33b]/30 text-[#9cd33b]' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input type="checkbox" className="accent-[#9cd33b]" checked={item.done} onChange={() => {
                    const list = state.checklist && state.checklist.length > 0 ? [...state.checklist] : [
                      { label: 'Battery fully charged & secured', done: false },
                      { label: 'Propellers inspected, no damage', done: false },
                      { label: 'Spray system primed & calibrated', done: false },
                      { label: 'GPS / RTK signal verified', done: false },
                      { label: 'Airspace authorization confirmed', done: false },
                      { label: 'Wind within operational limits', done: false },
                      { label: 'Emergency procedures reviewed', done: false },
                      { label: 'Observers & crew briefed', done: false },
                    ];
                    list[i] = { ...list[i], done: !list[i].done };
                    setState({ ...state, checklist: list });
                  }} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                </label>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className={tw.label}>Attached NOTAM</label>
                <select className={tw.input} value={state.attachedNotam || ''} onChange={e => setState({ ...state, attachedNotam: e.target.value })}>
                  <option className="bg-slate-900" value="">None</option>
                  {(notams || []).map(n => <option className="bg-slate-900" key={n.id} value={n.notamNumber}>{String(n.notamNumber)} ({String(n.date)})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={tw.label}>FAA Incidents</label>
                <select className={tw.input} value={state.incidents} onChange={e => setState({ ...state, incidents: e.target.value })}>
                  <option className="bg-slate-900" value="None">None</option>
                  <option className="bg-slate-900" value="Damage">Damage</option>
                </select>
              </div>
              {state.incidents === 'Damage' && (
                <div className="space-y-2"><label className={tw.label}>Describe Damage / Incident</label><textarea rows={4} className={`${tw.input} resize-vertical`} value={state.damageDescription} onChange={e => setState({ ...state, damageDescription: e.target.value })} required /></div>
              )}
            </div>
            <div className="space-y-2 min-w-0"><label className={tw.label}>Boundary (KML)</label><div className="flex flex-col sm:flex-row gap-2 min-w-0"><button type="button" onClick={() => kmlRef.current?.click()} className={`flex-1 p-4 rounded-2xl text-xs font-black uppercase border truncate transition-colors min-w-0 ${state.kmlFileName ? 'bg-[#9cd33b]/10 border-[#9cd33b]/50 text-[#9cd33b]' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>{state.kmlFileName || 'Attach KML'}</button>{state.kmlFileName && <button onClick={() => { setState({ ...state, kmlData: null, kmlFileName: '' }); if (kmlRef.current) kmlRef.current.value = ""; }} className={`${tw.btnBase} ${tw.btnDanger} shrink-0`}><X size={16} /></button>}<input type="file" accept=".kml" ref={kmlRef} className="hidden" onChange={handleKml} /></div></div>
          </div>
        </div>
        </div>
      </FormCard>
    );
  }
  const handleExportFlightLogPdf = async () => {
    if (logs.length === 0) { notify('No flight logs to export.', 'error'); return; }
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const rows = logs.map((l) =>
        `<tr><td style="padding:6px;border:1px solid #ddd">${l.date || ''}</td><td style="padding:6px;border:1px solid #ddd">${l.customer || ''}</td><td style="padding:6px;border:1px solid #ddd">${(l.selectedAircraft || []).join(', ')}</td><td style="padding:6px;border:1px solid #ddd">${l.chemical || ''}</td><td style="padding:6px;border:1px solid #ddd">${l.locationName || ''}</td><td style="padding:6px;border:1px solid #ddd">${l.treatedAcreage || l.totalAcreage || ''} ac</td></tr>`
      ).join('');
      const html = `<div style="font-family:sans-serif;padding:20px"><h1 style="font-size:20px;margin-bottom:4px">Flight Record Ledger</h1><p style="color:#666;margin-bottom:16px">Exported ${new Date().toLocaleDateString()}</p><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#222;color:#fff"><th style="padding:8px;border:1px solid #444;text-align:left">Date</th><th style="padding:8px;border:1px solid #444;text-align:left">Client</th><th style="padding:8px;border:1px solid #444;text-align:left">Aircraft</th><th style="padding:8px;border:1px solid #444;text-align:left">Chemical</th><th style="padding:8px;border:1px solid #444;text-align:left">Location</th><th style="padding:8px;border:1px solid #444;text-align:left">Acres</th></tr></thead><tbody>${rows}</tbody></table><p style="color:#999;margin-top:16px;font-size:10px">${logs.length} total flight records</p></div>`;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);
      await html2pdf().set({ margin: 0.5, filename: `Flight_Logs_${new Date().toISOString().slice(0, 10)}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' } }).from(wrapper).save();
      document.body.removeChild(wrapper);
      notify('Flight log PDF exported.', 'success');
    } catch { notify('PDF export failed. Try again.', 'error'); }
  };

  const handleExportFlightLogCsv = () => {
    if (logs.length === 0) { notify('No flight logs to export.', 'error'); return; }
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const headers = ['Date','Start','End','PIC','Customer','Aircraft','Chemical','Rate (oz/ac)','Location','Total Acres','Treated Acres','Flight Time (min)','Coordinates','Wind','Temp','Humidity'];
    const rows = logs.map((l) => [
      l.date, l.startTime, l.endTime, l.pic || '', l.customer, (l.selectedAircraft || []).join('; '),
      l.chemical, l.applicationRate, l.locationName, l.totalAcreage, l.treatedAcreage,
      l.flightTimeMinutes || '', `${l.latitude || ''},${l.longitude || ''}`,
      l.windSpeed ? `${l.windSpeed} ${l.windDirection || ''}` : '', l.temperature, l.humidity
    ].map(esc).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Flight_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Flight log CSV exported.', 'success');
  };

  return (
    <TableCard title="Flight Record Ledger" icon={FileText} actionLabel="Log Mission" onAction={() => setState({ ...defaultLogState, isEditing: true })}>
      <div className="flex flex-wrap justify-end gap-2 p-4">
        {selectedIds.size > 0 && (
          <Button variant="secondary" onClick={handleBulkDelete} className="text-[10px] text-red-400 border-red-500/30 hover:bg-red-500/10 !px-3 !py-2.5">
            <Trash2 size={14} /> Delete ({selectedIds.size})
          </Button>
        )}
        <Button variant="secondary" onClick={handleExportFlightLogCsv} className="text-[10px] !px-3 !py-2.5"><Download size={14} /> CSV</Button>
        <Button variant="secondary" onClick={handleExportFlightLogPdf} className="text-[10px] !px-3 !py-2.5"><Download size={14} /> PDF</Button>
      </div>
      <table className="w-full text-left min-w-[700px]">
        <thead className={tw.thead}>
          <tr>
            <th className={tw.th + " w-10"}>
              <input type="checkbox" className="accent-[#9cd33b]" checked={sortedLogs.length > 0 && selectedIds.size === sortedLogs.length} onChange={() => toggleAll(sortedLogs.map(l => l.id))} />
            </th>
            <th className={tw.th + " cursor-pointer select-none hover:text-slate-200 transition-colors"} onClick={() => toggleSort('date')}>Date / Times<SortIcon field="date" /></th>
            <th className={tw.th + " cursor-pointer select-none hover:text-slate-200 transition-colors"} onClick={() => toggleSort('customer')}>Fleet / Client<SortIcon field="customer" /></th>
            <th className={tw.th + " cursor-pointer select-none hover:text-slate-200 transition-colors"} onClick={() => toggleSort('chemical')}>Product / Location<SortIcon field="chemical" /></th>
            <th className={tw.th + " text-right"}>Audit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {sortedLogs.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">No flights logged.</td></tr>}
          {sortedLogs.map(log => (
            <tr key={log.id} className={tw.tr}>
              <td className={tw.td + " w-10"}>
                <input type="checkbox" className="accent-[#9cd33b]" checked={selectedIds.has(log.id)} onChange={() => toggleSelect(log.id)} />
              </td>
              <td className={tw.td + " min-w-[150px]"}>
                <p className="font-black text-slate-100 text-xs break-words">{String(log.date)}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase break-words">{String(log.startTime)} - {String(log.endTime)}</p>
                {log.attachedNotam && <span className="inline-block mt-2 text-[8px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-black uppercase">NOTAM: {log.attachedNotam}</span>}
              </td>
              <td className={tw.td + " min-w-[150px]"}>
                <div className="flex flex-wrap gap-1 mb-2">{log.selectedAircraft?.map((acID, i) => <span key={i} className="text-[9px] font-black text-[#9cd33b] bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 break-words">{String(acID)}</span>)}</div>
                <p className="text-[10px] text-slate-300 font-black uppercase tracking-tight break-words">{String(log.customer)}</p>
              </td>
              <td className={tw.td + " min-w-[150px]"}>
                <p className="font-black text-[#9cd33b] uppercase text-xs break-words">{String(log.chemical)}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold break-words">{String(log.locationName)} | {String(log.treatedAcreage)} AC</p>
              </td>
              <td className={tw.td + " text-right flex justify-end gap-3 items-center whitespace-nowrap"}>
                <div className="inline-flex items-center gap-2 text-[9px] font-black text-[#9cd33b] border border-[#9cd33b]/30 bg-[#9cd33b]/10 px-3 py-1 rounded-full uppercase tracking-widest"><ShieldCheck size={12} /> Verified</div>
                <button onClick={() => setState({ ...log, isEditing: true })} className={tw.actionBtnEdit}><Edit3 size={16} /></button>
                <button onClick={() => onDelete('flight_logs', log.id)} className={tw.actionBtnDel}><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
};

const defaultLogState = {
  date: new Date().toLocaleDateString('en-CA'),
  startTime: '08:00',
  endTime: '10:00',
  selectedAircraft: [],
  customer: '',
  locationName: '',
  totalAcreage: '',
  treatedAcreage: '',
  whatWasTreated: 'Corn',
  customCrop: '',
  targetPest: '',
  nozzleDesc: 'Atomizer Sprinklers',
  targetDistance: '',
  pumpPressure: '',
  travelSpeed: '',
  speedUnit: 'mph',
  driftPractices: '',
  coordType: 'Decimal',
  latDec: '',
  lonDec: '',
  latDecDir: 'N',
  lonDecDir: 'W',
  latDMS: { d: '', m: '', s: '', dir: 'N' },
  lonDMS: { d: '', m: '', s: '', dir: 'W' },
  coordinates: '',
  chemical: '',
  appRate: '',
  windSpeed: '',
  windDirection: 'N',
  temp: '',
  tempUnit: 'F',
  humidity: '',
  incidents: 'None',
  damageDescription: '',
  flightTimeValue: '',
  flightTimeUnit: 'Hours',
  flightTimeMinutes: '',
  kmlData: null,
  kmlFileName: '',
  attachedNotam: ''
};

export default MissionLogTab;
