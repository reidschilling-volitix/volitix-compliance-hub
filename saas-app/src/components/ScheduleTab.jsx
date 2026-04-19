import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Plus, ClipboardCheck, Clock, GripVertical, MapPin, ChevronLeft, ChevronRight, LayoutDashboard, Globe, X, Download, Repeat, CloudSun, Map } from 'lucide-react';
import L from 'leaflet';
import { Button, Card, FormCard, Input, Select, TableCard, ActionButtons, TextArea, tw } from './ui/components';
import FieldMapper from './FieldMapper';

const defaultField = {
  id: '',
  acres: '',
  chemical: '',
  appRate: '',
  kmlData: null,
  kmlFileName: '',
  coordType: 'Decimal',
  latDec: '',
  lonDec: '',
  latDecDir: 'N',
  lonDecDir: 'W',
  latDMS: { d: '', m: '', s: '', dir: 'N' },
  lonDMS: { d: '', m: '', s: '', dir: 'W' },
  finalLat: '',
  finalLon: '',
};

const defaultWorkOrderState = {
  id: '',
  title: '',
  customer: '',
  date: '',
  products: [],
  acres: '',
  appRate: '',
  kmlData: null,
  kmlFileName: '',
  coordType: 'Decimal',
  latDec: '',
  lonDec: '',
  latDecDir: 'N',
  lonDecDir: 'W',
  latDMS: { d: '', m: '', s: '', dir: 'N' },
  lonDMS: { d: '', m: '', s: '', dir: 'W' },
  finalLat: '',
  finalLon: '',
  selectedAircraft: [],
  status: 'Pending Dispatch',
  isScheduled: false,
  estHoursMin: '1.0',
  estHoursMax: '2.0',
  // recurrence: 'none',
  // recurrenceEnd: '',
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Pending Dispatch':
      return 'bg-slate-800/80 text-slate-300 border-slate-700';
    case 'Scheduled':
      return 'bg-[#9cd33b]/10 text-[#9cd33b] border-[#9cd33b]/20';
    case 'In Progress':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'Paused (Weather Hold)':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'Completed':
      return 'bg-slate-800 text-slate-300 border-slate-700';
    case 'Cancelled':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    default:
      return 'bg-slate-800/80 text-slate-300 border-slate-700';
  }
};

// Haversine distance in meters between two [lat,lon] pairs
const haversineDist = ([lat1, lon1], [lat2, lon2]) => {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Shoelace formula for polygon area in sq meters from [lat,lon] points
const polygonAreaSqM = (pts) => {
  if (pts.length < 3) return 0;
  // Project to approximate meters using center latitude
  const avgLat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(avgLat * Math.PI / 180);
  const projected = pts.map(([lat, lon]) => [(lon - pts[0][1]) * mPerDegLon, (lat - pts[0][0]) * mPerDegLat]);
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i][0] * projected[j][1];
    area -= projected[j][0] * projected[i][1];
  }
  return Math.abs(area) / 2;
};

// Analyze KML polygon shape → efficiency multiplier (1.0 = perfect rectangle, higher = less efficient)
const analyzeKmlShape = (kml) => {
  if (!kml || typeof kml !== 'string') return { shapeMultiplier: 1.0, fieldCount: 0, detail: '' };

  // Extract all coordinate blocks
  const blocks = [...kml.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)];
  if (blocks.length === 0) return { shapeMultiplier: 1.0, fieldCount: 0, detail: '' };

  const polygons = blocks.map((m) => {
    const raw = (m[1] || '').trim();
    return raw.split(/\s+/).map((pair) => {
      const [lonS, latS] = pair.split(',');
      const lat = parseFloat(latS);
      const lon = parseFloat(lonS);
      return (!isNaN(lat) && !isNaN(lon)) ? [lat, lon] : null;
    }).filter(Boolean);
  }).filter((pts) => pts.length >= 3);

  if (polygons.length === 0) return { shapeMultiplier: 1.0, fieldCount: 0, detail: '' };

  let worstEfficiency = 0;
  const details = [];

  polygons.forEach((pts, idx) => {
    // Polygon perimeter
    let perimeter = 0;
    for (let i = 0; i < pts.length; i++) {
      perimeter += haversineDist(pts[i], pts[(i + 1) % pts.length]);
    }

    // Polygon area
    const areaSqM = polygonAreaSqM(pts);
    const areaAcres = areaSqM / 4046.86;

    // Bounding box
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const bboxW = haversineDist([minLat, minLon], [minLat, maxLon]);
    const bboxH = haversineDist([minLat, minLon], [maxLat, minLon]);
    const bboxArea = bboxW * bboxH;

    // Metrics
    const fillRatio = bboxArea > 0 ? Math.min(1, areaSqM / bboxArea) : 1; // 1.0 = perfect rectangle
    const aspect = bboxW > 0 && bboxH > 0 ? Math.max(bboxW, bboxH) / Math.min(bboxW, bboxH) : 1; // 1.0 = square
    const compactness = perimeter > 0 ? (4 * Math.PI * areaSqM) / (perimeter * perimeter) : 1; // 1.0 = circle, ~0.78 = square
    const vertexCount = pts.length;

    // Efficiency score: 0 (perfect) to 1+ (very irregular)
    let irregularity = 0;

    // Fill ratio penalty: perfect rect = ~1.0 → 0 penalty; L-shape ~0.5 → big penalty
    irregularity += Math.max(0, (1 - fillRatio)) * 0.35;

    // Aspect ratio penalty: very long narrow fields need more turns at ends
    if (aspect > 4) irregularity += 0.15;
    else if (aspect > 2.5) irregularity += 0.08;

    // Compactness penalty: low compactness = jagged/irregular
    irregularity += Math.max(0, (0.78 - compactness)) * 0.4;

    const label = polygons.length > 1 ? `Field ${idx + 1}` : 'Field';
    details.push(`${label}: fill ${(fillRatio * 100).toFixed(0)}%, aspect ${aspect.toFixed(1)}:1, ${vertexCount} vertices`);
    worstEfficiency = Math.max(worstEfficiency, irregularity);
  });

  // Multi-field ferry penalty: each additional field adds ferry time
  const ferryPenalty = polygons.length > 1 ? (polygons.length - 1) * 0.1 : 0;

  // Final multiplier: 1.0 (perfect rectangle) up to ~1.6 (very irregular multi-field)
  const shapeMultiplier = 1.0 + worstEfficiency + ferryPenalty;

  return {
    shapeMultiplier: Math.min(1.7, shapeMultiplier),
    fieldCount: polygons.length,
    detail: details.join(' | ')
  };
};

const calculateEstimate = (acresStr, aircraftArr, kml, appRateStr) => {
  const acres = parseFloat(acresStr) || 0;
  if (!acres || !aircraftArr || aircraftArr.length === 0) {
    return { min: '1.0', max: '2.0', shapeDetail: '' };
  }

  // Sum spray rates from fleet objects (ac/hr per drone)
  let totalAcresPerHour = 0;
  aircraftArr.forEach((drone) => {
    const rate = drone?.sprayRate ? parseFloat(drone.sprayRate) : 30;
    totalAcresPerHour += rate;
  });
  if (!totalAcresPerHour) totalAcresPerHour = 30;

  // GPA adjustment: higher GPA means more refills/slower passes
  const gpa = parseFloat(appRateStr) || 2;
  const gpaMultiplier = Math.max(0.8, 1 + (gpa - 2) * 0.08);

  // Base hours = acres / throughput, adjusted for GPA + 10min setup
  let baseHours = (acres / totalAcresPerHour) * gpaMultiplier + 0.17;

  // Hazard keywords from KML text (only when hazards actually found)
  let hazardMultiplier = 1.0;
  if (kml) {
    const kmlLower = (kml || '').toLowerCase();
    if (kmlLower.includes('power') || kmlLower.includes('line')) hazardMultiplier += 0.15;
    if (kmlLower.includes('tree') || kmlLower.includes('obstacle') || kmlLower.includes('house')) hazardMultiplier += 0.1;
  }

  // Shape-based efficiency from polygon geometry
  const { shapeMultiplier, fieldCount, detail } = analyzeKmlShape(kml);

  const adjustedHours = baseHours * hazardMultiplier * shapeMultiplier;
  return {
    min: Math.max(0.2, (adjustedHours * 0.9)).toFixed(1),
    max: Math.max(0.3, (adjustedHours * 1.15)).toFixed(1),
    shapeDetail: detail,
    shapeMultiplier: shapeMultiplier.toFixed(2),
    fieldCount
  };
};

const parseKmlCoordinates = (kml) => {
  const match = kml.match(/<coordinates>([^<]+)<\/coordinates>/i);
  if (!match) return null;
  const coords = match[1].trim().split(',');
  if (coords.length < 2) return null;
  return { lon: coords[0], lat: coords[1] };
};

const extractKmlLatLngGroups = (kml) => {
  if (!kml || typeof kml !== 'string') return [];
  const matches = [...kml.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/gi)];
  return matches
    .map((m) => (m[1] || '').trim())
    .filter(Boolean)
    .map((block) => block
      .split(/\s+/)
      .map((pair) => {
        const [lonStr, latStr] = pair.split(',');
        const lat = parseFloat(latStr);
        const lon = parseFloat(lonStr);
        if (isNaN(lat) || isNaN(lon)) return null;
        return [lat, lon];
      })
      .filter(Boolean))
    .filter((group) => group.length > 1);
};

const InlineCustomerForm = ({ data, setData, onClose, onSave }) => (
  <div className="p-6 bg-slate-950 border border-[#9cd33b]/50 rounded-2xl space-y-4 min-w-0 mt-2">
    <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-2">
      <span className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest truncate pr-2">New Customer Profile</span>
      <Button variant="secondary" onClick={onClose} className="py-2 px-3 shrink-0"><X size={14}/></Button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Input label="Company/Farm Name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} required />
      <Input label="Contact Name" value={data.contactName} onChange={(e) => setData({ ...data, contactName: e.target.value })} />
      <Input label="Email" type="email" value={data.email || ''} onChange={(e) => setData({ ...data, email: e.target.value })} />
      <Input label="Phone" value={data.phone || ''} onChange={(e) => setData({ ...data, phone: e.target.value })} />
      <Input label="Address" value={data.address || ''} onChange={(e) => setData({ ...data, address: e.target.value })} />
      <Input label="City" value={data.city || ''} onChange={(e) => setData({ ...data, city: e.target.value })} />
      <Input label="State" value={data.state || ''} onChange={(e) => setData({ ...data, state: e.target.value })} />
      <Input label="Zip" value={data.zip || ''} onChange={(e) => setData({ ...data, zip: e.target.value })} />
    </div>
    <Button onClick={onSave} className="w-full mt-2">Save Customer</Button>
  </div>
);

const InlineProductForm = ({ data, setData, onClose, onSave }) => (
  <div className="p-6 bg-slate-950 border border-[#9cd33b]/50 rounded-2xl space-y-4 min-w-0 mt-2">
    <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-2">
      <span className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest truncate pr-2">New Product Profile</span>
      <Button variant="secondary" onClick={onClose} className="py-2 px-3 shrink-0"><X size={14}/></Button>
    </div>
    <div className="grid grid-cols-1 gap-4">
      <Input label="Chemical Name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} required />
      <Input label="Default Rate" type="number" step="any" value={data.defaultRate} onChange={(e) => setData({ ...data, defaultRate: e.target.value })} required rightElement={<span className="text-[9px] text-slate-500 font-black">oz/ac</span>} />
      <Input label="Current Inventory" type="number" step="any" value={data.inventory || ''} onChange={(e) => setData({ ...data, inventory: e.target.value })} rightElement={<span className="text-[9px] text-slate-500 font-black">Gal</span>} />
    </div>
    <Button onClick={onSave} className="w-full mt-2">Save Product</Button>
  </div>
);

const computeFinalCoords = (latDec, latDecDir, lonDec, lonDecDir, latDMS, lonDMS, coordType) => {
  if (coordType === 'Decimal') {
    const lat = parseFloat(latDec);
    const lon = parseFloat(lonDec);
    if (isNaN(lat) || isNaN(lon)) return { finalLat: '', finalLon: '' };
    return {
      finalLat: String(latDecDir === 'S' ? -Math.abs(lat) : Math.abs(lat)),
      finalLon: String(lonDecDir === 'W' ? -Math.abs(lon) : Math.abs(lon)),
    };
  }
  const dmsToDecStr = (dms, isNeg) => {
    const d = parseFloat(dms?.d) || 0;
    const m = parseFloat(dms?.m) || 0;
    const s = parseFloat(dms?.s) || 0;
    const val = d + m / 60 + s / 3600;
    return isNaN(val) ? '' : String(isNeg ? -val : val);
  };
  return {
    finalLat: dmsToDecStr(latDMS, latDMS?.dir === 'S'),
    finalLon: dmsToDecStr(lonDMS, lonDMS?.dir === 'W'),
  };
};

const GeoAndKmlInput = ({ state, setState, notify, kmlRef, workOrders }) => {
  const [pasteVal, setPasteVal] = useState('');
  const [parsedSuccess, setParsedSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showFieldMapper, setShowFieldMapper] = useState(false);

  const handleKml = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const kmlText = ev.target.result;
      const coords = parseKmlCoordinates(kmlText);
      const est = calculateEstimate(state.acres, fleet.filter((f) => (state.selectedAircraft || []).includes(f.id)), kmlText, state.appRate);
      setState((prev) => ({
        ...prev,
        kmlData: kmlText,
        kmlFileName: file.name,
        finalLat: coords?.lat || prev.finalLat,
        finalLon: coords?.lon || prev.finalLon,
        estHoursMin: est.min,
        estHoursMax: est.max,
      }));
      notify('KML route attached. Estimate adjusted for field shape.', 'success');
    };
    reader.readAsText(file);
  };

  const handlePaste = (e) => {
    const val = e.target.value;
    setPasteVal(val);
    const str = val.trim().toUpperCase();
    const dmsRegex = /(\d+)[^\d]+(\d+)[^\d]+([\d.]+)[^\dNS]*([NS])[^\d]*(\d+)[^\d]+(\d+)[^\d]+([\d.]+)[^\dEW]*([EW])/;
    const dmsMatch = str.match(dmsRegex);
    if (dmsMatch) {
      const latDecVal = (parseInt(dmsMatch[1]) + parseInt(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600).toFixed(6);
      const lonDecVal = (parseInt(dmsMatch[5]) + parseInt(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600).toFixed(6);
      const newLatDMS = { d: dmsMatch[1], m: dmsMatch[2], s: dmsMatch[3], dir: dmsMatch[4] };
      const newLonDMS = { d: dmsMatch[5], m: dmsMatch[6], s: dmsMatch[7], dir: dmsMatch[8] };
      const coords = computeFinalCoords(latDecVal, dmsMatch[4], lonDecVal, dmsMatch[8], newLatDMS, newLonDMS, 'DMS');
      setState((prev) => ({ ...prev, coordType: 'DMS', latDMS: newLatDMS, lonDMS: newLonDMS, latDec: latDecVal, latDecDir: dmsMatch[4], lonDec: lonDecVal, lonDecDir: dmsMatch[8], ...coords }));
      setParsedSuccess(true);
      setTimeout(() => setParsedSuccess(false), 3000);
      return;
    }
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
      const coords = computeFinalCoords(newLatDec, newLatDecDir, newLonDec, newLonDecDir, newLatDMS, newLonDMS, 'Decimal');
      setState((prev) => ({ ...prev, coordType: 'Decimal', latDec: newLatDec, latDecDir: newLatDecDir, lonDec: newLonDec, lonDecDir: newLonDecDir, latDMS: newLatDMS, lonDMS: newLonDMS, ...coords }));
      setParsedSuccess(true);
      setTimeout(() => setParsedSuccess(false), 3000);
    }
  };

  return (
    <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-6 min-w-0 md:col-span-2">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-800 pb-4">
        <span className="text-[10px] font-black uppercase text-[#9cd33b] tracking-widest">Geolocation</span>
        <select
          className={tw.input + ' w-full sm:w-auto'}
          value={state.coordType}
          onChange={(e) => setState({ ...state, coordType: e.target.value })}
        >
          <option value="Decimal">Decimal Degrees</option>
          <option value="DMS">DMS (Deg/Min/Sec)</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className={tw.label}>Quick Paste (Google Earth / Decimals)</label>
        <input
          type="text"
          placeholder={`e.g. 38°31'49.64"N 90°14'13.92"W`}
          className={tw.input}
          value={pasteVal}
          onChange={handlePaste}
        />
        {parsedSuccess && <p className="text-[9px] text-[#9cd33b] font-black uppercase tracking-widest pl-1 mt-2">Parsed successfully!</p>}
      </div>

      {state.coordType === 'Decimal' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className={tw.label}>Latitude</label>
            <div className="flex gap-2">
              <input
                type="number" step="any" className={tw.input}
                value={state.latDec || ''}
                onChange={(e) => {
                  const coords = computeFinalCoords(e.target.value, state.latDecDir, state.lonDec, state.lonDecDir, state.latDMS, state.lonDMS, 'Decimal');
                  setState({ ...state, latDec: e.target.value, ...coords });
                }}
              />
              <select
                className={tw.input + ' w-auto'}
                value={state.latDecDir || 'N'}
                onChange={(e) => {
                  const coords = computeFinalCoords(state.latDec, e.target.value, state.lonDec, state.lonDecDir, state.latDMS, state.lonDMS, 'Decimal');
                  setState({ ...state, latDecDir: e.target.value, ...coords });
                }}
              >
                <option value="N">N</option>
                <option value="S">S</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className={tw.label}>Longitude</label>
            <div className="flex gap-2">
              <input
                type="number" step="any" className={tw.input}
                value={state.lonDec || ''}
                onChange={(e) => {
                  const coords = computeFinalCoords(state.latDec, state.latDecDir, e.target.value, state.lonDecDir, state.latDMS, state.lonDMS, 'Decimal');
                  setState({ ...state, lonDec: e.target.value, ...coords });
                }}
              />
              <select
                className={tw.input + ' w-auto'}
                value={state.lonDecDir || 'W'}
                onChange={(e) => {
                  const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, e.target.value, state.latDMS, state.lonDMS, 'Decimal');
                  setState({ ...state, lonDecDir: e.target.value, ...coords });
                }}
              >
                <option value="W">W</option>
                <option value="E">E</option>
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className={tw.label}>Latitude (D/M/S)</label>
            <div className="grid grid-cols-4 gap-2">
              <input type="number" className={tw.input + ' text-center'} placeholder="Deg" value={state.latDMS?.d || ''}
                onChange={(e) => { const dms = { ...state.latDMS, d: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, dms, state.lonDMS, 'DMS'); setState({ ...state, latDMS: dms, ...coords }); }} />
              <input type="number" className={tw.input + ' text-center'} placeholder="Min" value={state.latDMS?.m || ''}
                onChange={(e) => { const dms = { ...state.latDMS, m: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, dms, state.lonDMS, 'DMS'); setState({ ...state, latDMS: dms, ...coords }); }} />
              <input type="number" className={tw.input + ' text-center'} placeholder="Sec" value={state.latDMS?.s || ''}
                onChange={(e) => { const dms = { ...state.latDMS, s: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, dms, state.lonDMS, 'DMS'); setState({ ...state, latDMS: dms, ...coords }); }} />
              <select className={tw.input + ' text-center font-bold'} value={state.latDMS?.dir || 'N'}
                onChange={(e) => { const dms = { ...state.latDMS, dir: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, dms, state.lonDMS, 'DMS'); setState({ ...state, latDMS: dms, ...coords }); }}>
                <option>N</option><option>S</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className={tw.label}>Longitude (D/M/S)</label>
            <div className="grid grid-cols-4 gap-2">
              <input type="number" className={tw.input + ' text-center'} placeholder="Deg" value={state.lonDMS?.d || ''}
                onChange={(e) => { const dms = { ...state.lonDMS, d: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, state.latDMS, dms, 'DMS'); setState({ ...state, lonDMS: dms, ...coords }); }} />
              <input type="number" className={tw.input + ' text-center'} placeholder="Min" value={state.lonDMS?.m || ''}
                onChange={(e) => { const dms = { ...state.lonDMS, m: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, state.latDMS, dms, 'DMS'); setState({ ...state, lonDMS: dms, ...coords }); }} />
              <input type="number" className={tw.input + ' text-center'} placeholder="Sec" value={state.lonDMS?.s || ''}
                onChange={(e) => { const dms = { ...state.lonDMS, s: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, state.latDMS, dms, 'DMS'); setState({ ...state, lonDMS: dms, ...coords }); }} />
              <select className={tw.input + ' text-center font-bold'} value={state.lonDMS?.dir || 'W'}
                onChange={(e) => { const dms = { ...state.lonDMS, dir: e.target.value }; const coords = computeFinalCoords(state.latDec, state.latDecDir, state.lonDec, state.lonDecDir, state.latDMS, dms, 'DMS'); setState({ ...state, lonDMS: dms, ...coords }); }}>
                <option>W</option><option>E</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-slate-800">
        <label className={tw.label + ' mb-2 block'}>Field Boundary Configuration</label>
        <div
          className={`flex flex-col sm:flex-row gap-4 mt-2 p-4 rounded-[2rem] border-2 border-dashed transition-all duration-300 ${isDragging ? 'border-[#9cd33b] bg-[#9cd33b]/10 scale-[1.02]' : 'border-transparent bg-slate-900/30'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file?.name.toLowerCase().endsWith('.kml')) {
              handleKml({ target: { files: [file] } });
            } else if (notify) {
              notify('Please drop a valid .KML file', 'error');
            }
          }}
        >
          <a
            href="https://earth.google.com/web/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-4 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-blue-500/20 transition-colors no-underline"
          >
            <Globe size={16} />
            Open Google Earth
          </a>
          <button
            type="button"
            onClick={() => setShowFieldMapper(true)}
            className="flex-1 px-4 py-4 rounded-2xl bg-[#9cd33b]/10 text-[#9cd33b] border border-[#9cd33b]/30 text-[10px] font-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-[#9cd33b]/20 transition-colors"
          >
            <Map size={16} />
            Draw on Map
          </button>
          <button
            type="button"
            onClick={() => kmlRef?.current?.click()}
            className="flex-1 px-4 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 font-black uppercase tracking-widest text-[10px]"
          >
            Attach KML
          </button>
          <input ref={kmlRef} type="file" accept=".kml" className="hidden" onChange={handleKml} />
          {state.kmlFileName && (
            <span className="text-[10px] uppercase tracking-widest text-[#9cd33b] font-black self-center">{state.kmlFileName}</span>
          )}
        </div>
      </div>
      <FieldMapper
        open={showFieldMapper}
        onClose={() => setShowFieldMapper(false)}
        initialLat={state.finalLat}
        initialLon={state.finalLon}
        initialKml={state.kmlData}
        workOrders={workOrders}
        onApply={(data) => {
          setState((prev) => ({
            ...prev,
            kmlData: data.kmlData,
            kmlFileName: data.kmlFileName,
            finalLat: data.finalLat,
            finalLon: data.finalLon,
            latDec: data.finalLat,
            lonDec: data.finalLon,
            acres: String(data.acres),
          }));
          if (notify) notify(`Field boundary applied — ${data.acres} acres`, 'success');
        }}
      />
    </div>
  );
};

const StatsRow = ({ stats }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
    <Card className="p-4">
      <p className="text-[9px] uppercase tracking-widest text-slate-400">Unscheduled</p>
      <p className="text-3xl font-black text-amber-500">{stats.unscheduled}</p>
    </Card>
    <Card className="p-4">
      <p className="text-[9px] uppercase tracking-widest text-slate-400">This Week</p>
      <p className="text-3xl font-black text-slate-100">{stats.thisWeekCount}</p>
    </Card>
    <Card className="p-4">
      <p className="text-[9px] uppercase tracking-widest text-slate-400">Active Jobs</p>
      <p className="text-3xl font-black text-blue-400">{stats.activeCount}</p>
    </Card>
    <Card className="p-4">
      <p className="text-[9px] uppercase tracking-widest text-slate-400">Scheduled Acres</p>
      <p className="text-3xl font-black text-slate-200">{Number(stats.schedAcres).toFixed(2)}</p>
    </Card>
  </div>
);

const ScheduleTab = ({ workOrders, setWorkOrders, customers, products, fleet, notify, onAddCustomer, onAddProduct, onLogMission }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [state, setState] = useState(defaultWorkOrderState);
  const [inlineCustomer, setInlineCustomer] = useState(false);
  const [inlineProduct, setInlineProduct] = useState(false);
  const [newCustData, setNewCustData] = useState({ name: '', contactName: '', email: '', phone: '', address: '', city: '', state: '', zip: '' });
  const [newProdData, setNewProdData] = useState({ name: '', defaultRate: '', inventory: '' });
  const [viewMode, setViewMode] = useState('calendar');
  const [calendarBaseDate, setCalendarBaseDate] = useState(new Date());
  const [selectedMapJob, setSelectedMapJob] = useState(null);
  const kmlRef = useRef(null);

  // Weather forecast cache for scheduled dates
  const [weatherCache, setWeatherCache] = useState({});
  useEffect(() => {
    const dates = [...new Set(workOrders.filter(w => w.isScheduled && w.date).map(w => w.date))];
    const today = new Date().toISOString().slice(0, 10);
    const futureDates = dates.filter(d => d >= today && !weatherCache[d]);
    if (futureDates.length === 0) return;
    const startDate = futureDates.sort()[0];
    const endDate = futureDates.sort().pop();
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=32.0&longitude=-99.0&daily=wind_speed_10m_max,temperature_2m_max,precipitation_probability_max&start_date=${startDate}&end_date=${endDate}&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=America%2FChicago`)
      .then(r => r.json())
      .then(data => {
        if (!data.daily) return;
        const cache = { ...weatherCache };
        data.daily.time.forEach((d, i) => {
          const wind = data.daily.wind_speed_10m_max[i];
          const temp = data.daily.temperature_2m_max[i];
          const rain = data.daily.precipitation_probability_max[i];
          let grade = 'green';
          if (wind > 15 || rain > 60 || temp > 105) grade = 'red';
          else if (wind > 10 || rain > 30 || temp > 95) grade = 'yellow';
          cache[d] = { wind: Math.round(wind), temp: Math.round(temp), rain, grade };
        });
        setWeatherCache(cache);
      })
      .catch(() => {});
  }, [workOrders]);

  const WeatherBadge = ({ date }) => {
    const wx = weatherCache[date];
    if (!wx) return null;
    const colors = { green: 'text-emerald-400', yellow: 'text-amber-400', red: 'text-red-400' };
    const bg = { green: 'bg-emerald-500/10', yellow: 'bg-amber-500/10', red: 'bg-red-500/10' };
    return (
      <div className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-widest mt-1 px-1.5 py-0.5 rounded-full ${bg[wx.grade]} ${colors[wx.grade]}`}>
        <CloudSun size={8} /> {wx.wind}mph {wx.rain}%
      </div>
    );
  };

  const weekDays = useMemo(() => {
    const start = new Date(calendarBaseDate);
    start.setDate(calendarBaseDate.getDate() - calendarBaseDate.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [calendarBaseDate]);

  const scheduleStats = useMemo(() => {
    const endOfWeek = new Date(weekDays[0]);
    endOfWeek.setDate(weekDays[0].getDate() + 6);
    return {
      unscheduled: workOrders.filter((w) => !w.isScheduled && w.status !== 'Scheduled' && w.status !== 'Completed').length,
      unscheduledJobs: workOrders.filter((w) => !w.isScheduled && w.status !== 'Scheduled' && w.status !== 'Completed'),
      thisWeekCount: workOrders.filter((w) => w.isScheduled && new Date(w.date) >= weekDays[0] && new Date(w.date) <= endOfWeek).length,
      activeCount: workOrders.filter((w) => w.status === 'Scheduled' || w.status === 'In Progress').length,
      schedAcres: workOrders.filter((w) => w.status === 'Scheduled' || w.status === 'In Progress').reduce((a, w) => a + (parseFloat(w.acres) || 0), 0)
    };
  }, [workOrders, weekDays]);

  const formatMonthDay = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const calendarDateRange = `${formatMonthDay(weekDays[0])} - ${formatMonthDay(weekDays[6])}, ${weekDays[6].getFullYear()}`;

  const [wasCompleted, setWasCompleted] = useState(false);

  const startEditing = (order) => {
    setState({ ...order });
    setWasCompleted(order.status === 'Completed');
    setIsEditing(true);
  };

  const handleSubmit = () => {
    if (!state.title || !state.customer) {
      notify('Title and customer are required.', 'error');
      return;
    }

    // Split into separate jobs for each field
    const jobs = (state.fields || []).map((field, idx) => {
      const id = state.id ? `${state.id}-f${idx}` : `wo-${Date.now()}-f${idx}`;
      return {
        ...state,
        ...field,
        id,
        fieldIdx: idx,
        fields: undefined, // Remove fields array from each job
        title: state.title + (state.fields.length > 1 ? ` - Field ${idx + 1}` : ''),
        status: state.date ? 'Scheduled' : 'Pending Dispatch',
        isScheduled: !!state.date,
      };
    });

    if (state.id) {
      setWorkOrders((prev) => [
        ...prev.filter((item) => !item.id.startsWith(state.id)),
        ...jobs
      ]);
    } else {
      setWorkOrders((prev) => [...jobs, ...prev]);
    }

    setState(defaultWorkOrderState);
    setIsEditing(false);
    setWasCompleted(false);

    notify('Work order saved.', 'success');
  };

  const handleDelete = (id) => {
    setWorkOrders((prev) => prev.filter((item) => item.id !== id));
    notify('Work order removed.', 'success');
  };

  const handleDrop = (e, date) => {
    const id = e.dataTransfer.getData('text/plain');
    setWorkOrders((prev) => prev.map((job) => {
      if (job.id !== id) return job;
      return {
        ...job,
        date: date.toISOString().slice(0, 10),
        isScheduled: true,
        status: job.status === 'Pending Dispatch' ? 'Scheduled' : job.status
      };
    }));
  };

  const handleDropToBacklog = (e) => {
    const id = e.dataTransfer.getData('text/plain');
    setWorkOrders((prev) => prev.map((job) => {
      if (job.id !== id) return job;
      return { ...job, date: '', isScheduled: false, status: 'Pending Dispatch' };
    }));
  };

  const dayJobs = (date) => workOrders.filter((w) => w.isScheduled && w.date === date.toISOString().slice(0, 10));

  const LeafletJobMap = ({ job }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);

    useEffect(() => {
      if (!mapRef.current) return;

      if (!mapInstanceRef.current) {
        const m = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
        // Esri satellite imagery
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        }).addTo(m);
        // Road names overlay
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19, pane: 'overlayPane',
        }).addTo(m);
        // Place labels overlay
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19, pane: 'overlayPane',
        }).addTo(m);
        mapInstanceRef.current = m;
        layerGroupRef.current = L.layerGroup().addTo(m);
      }

      const map = mapInstanceRef.current;
      const layers = layerGroupRef.current;
      layers.clearLayers();

      const lat = parseFloat(job?.finalLat);
      const lon = parseFloat(job?.finalLon);
      const bounds = [];

      if (!isNaN(lat) && !isNaN(lon)) {
        const marker = L.marker([lat, lon]);
        marker.bindPopup(`<div style=\"font-size:12px;font-weight:800\">${job?.title || job?.customer || 'Work Order'}</div><div style=\"font-size:10px;opacity:0.7\">${job?.chemical || ''} · ${Number(job?.acres).toFixed(2) || '?'} ac</div>`);
        marker.addTo(layers);
        bounds.push([lat, lon]);
      }

      const kmlGroups = extractKmlLatLngGroups(job?.kmlData);
      kmlGroups.forEach((group) => {
        const polygon = L.polygon(group, {
          color: '#9cd33b',
          weight: 3,
          fillColor: '#9cd33b',
          fillOpacity: 0.2,
        });
        polygon.addTo(layers);
        group.forEach((pt) => bounds.push(pt));
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 });
      } else {
        map.setView([39.82, -98.57], 4);
      }

      setTimeout(() => map.invalidateSize(), 100);

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          layerGroupRef.current = null;
        }
      };
    }, [job]);

    return <div ref={mapRef} className="h-full w-full rounded-[2.5rem] overflow-hidden bg-slate-900 border border-slate-800" />;
  };

  const renderCalendar = () => (
    <div className="flex flex-col gap-6 min-w-0 flex-1">
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-xl flex flex-col overflow-hidden min-w-0 min-h-[400px]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 min-w-0 gap-4">
          <div className="flex items-center gap-4 lg:gap-6 min-w-0">
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { const d = new Date(calendarBaseDate); d.setDate(d.getDate() - 7); setCalendarBaseDate(d); }} className="p-2 bg-slate-950 rounded-xl hover:bg-slate-800 text-slate-400"><ChevronLeft size={16} /></button>
              <button onClick={() => { const d = new Date(calendarBaseDate); d.setDate(d.getDate() + 7); setCalendarBaseDate(d); }} className="p-2 bg-slate-950 rounded-xl hover:bg-slate-800 text-slate-400"><ChevronRight size={16} /></button>
            </div>
            <span className="text-sm lg:text-lg font-black text-slate-100 uppercase tracking-tight truncate">{calendarDateRange}</span>
          </div>
          <Button variant="secondary" onClick={() => setCalendarBaseDate(new Date())} className="shrink-0 text-[9px] py-2 px-3">Today</Button>
        </div>
        <div className="flex-1 grid grid-cols-7 divide-x divide-slate-800 overflow-x-auto min-w-[600px]">
          {weekDays.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const jobs = dayJobs(date);
            return (
              <div key={idx} className={`flex flex-col min-w-[85px] ${isToday ? 'bg-[#9cd33b]/5' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, date)}>
                <div className={`p-2 lg:p-4 text-center border-b border-slate-800 ${isToday ? 'bg-[#9cd33b] text-[#020617]' : 'text-slate-400'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  <p className="text-xl font-black">{date.getDate()}</p>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', job.id)}
                      onClick={() => startEditing(job)}
                      className={`p-2 lg:p-3 rounded-xl text-[9px] lg:text-[10px] shadow-sm border cursor-grab active:cursor-grabbing hover:opacity-80 transition-opacity min-w-0 ${getStatusColor(job.status)}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-black uppercase truncate mb-1 block">{String(job.title || job.customer)}</span>
                        <button className="text-slate-400 hover:text-white" type="button"><ClipboardCheck size={12} /></button>
                      </div>
                      <div className="font-bold opacity-80 font-mono truncate block">{Number(job.acres).toFixed(2)} AC</div>
                      <WeatherBadge date={job.date} />
                    </div>
                  ))}
                  <div onClick={() => { setState({ ...defaultWorkOrderState, date: date.toISOString().slice(0, 10), isScheduled: true }); setIsEditing(true); }} className="w-full h-8 lg:h-10 border border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-600 hover:border-slate-500 cursor-pointer transition-colors mt-2">
                    <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Plus size={10} /> Add</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] flex flex-col shadow-xl overflow-hidden shrink-0 max-h-[400px]" onDragOver={(e) => e.preventDefault()} onDrop={handleDropToBacklog}>
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center min-w-0">
          <span className="text-xs font-black uppercase tracking-widest text-slate-200 flex items-center gap-2 truncate"><Clock size={14} className="text-amber-500 shrink-0" /> Backlog (Unscheduled Orders)</span>
        </div>
        <div className="p-3 border-b border-slate-800 bg-amber-500/5 min-w-0">
          <p className="text-[9px] text-amber-500/80 font-black uppercase tracking-widest text-center truncate">Drag jobs to calendar to schedule</p>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          {scheduleStats.unscheduledJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 py-8">
              <Clock size={32} className="mb-4 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-center px-4">All Caught Up</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {scheduleStats.unscheduledJobs.map((job) => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', job.id)}
                  className="bg-slate-950 border border-slate-800 p-4 rounded-2xl cursor-grab hover:border-[#9cd33b]/50 shadow-sm active:cursor-grabbing min-w-0 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                    <span className="text-[10px] font-black text-slate-200 uppercase truncate block">{String(job.title || job.customer)}</span>
                    <GripVertical size={14} className="text-slate-600 shrink-0" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 truncate">{String(job.customer)}</p>
                  <p className="text-[9px] text-slate-500 font-mono mt-1 truncate">{Number(job.acres).toFixed(2)} AC {job.appRate ? `| ${job.appRate} GPA` : ''}</p>
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => startEditing(job)} className={tw.actionBtnEdit}><ClipboardCheck size={12} /></button>
                    <button onClick={() => handleDelete(job.id)} className={tw.actionBtnDel}><GripVertical size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMapView = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[500px] min-w-0">
      <div className="w-full lg:w-80 bg-slate-900 border border-slate-800 rounded-[3rem] flex flex-col shadow-xl shrink-0 h-full overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-slate-900/50 min-w-0 shrink-0">
          <h3 className="font-black uppercase tracking-widest text-slate-100 text-xs truncate">Mapped Locations</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {workOrders.filter((w) => (w.finalLat && w.finalLon) || w.kmlData).map((job) => (
            <div
              key={job.id}
              onClick={() => setSelectedMapJob(job)}
              className={`p-5 rounded-2xl cursor-pointer transition-colors border shadow-sm min-w-0 ${selectedMapJob?.id === job.id ? 'bg-slate-800 border-[#9cd33b]' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
            >
              <div className="flex justify-between items-start mb-2 gap-2 min-w-0">
                <p className="text-[11px] font-black text-slate-200 uppercase truncate block">{String(job.title || job.customer)}</p>
                <button onClick={(e) => { e.stopPropagation(); startEditing(job); }} className={tw.actionBtnEdit}><GripVertical size={14} /></button>
              </div>
              <p className="text-[9px] text-slate-500 font-mono mt-1 bg-slate-900 p-2 rounded-lg inline-block truncate max-w-full">{job.finalLat && job.finalLon ? `${String(job.finalLat)}, ${String(job.finalLon)}` : (job.kmlFileName || 'Drawn Boundary')}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-3 tracking-widest truncate">{String(job.date || 'Backlog')} | {Number(job.acres).toFixed(2)} AC {job.appRate ? `| ${job.appRate} GPA` : ''}</p>
            </div>
          ))}
          {workOrders.filter((w) => (w.finalLat && w.finalLon) || w.kmlData).length === 0 && (
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center mt-10">No mapped work orders</p>
          )}
        </div>
      </div>
      <div className="flex-1 bg-slate-950 border border-slate-800 shadow-xl rounded-[3rem] relative min-w-0 p-2 h-full overflow-hidden z-10 flex flex-col">
        {selectedMapJob ? (
          <LeafletJobMap job={selectedMapJob} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600 border border-slate-800/50 rounded-[2.5rem] bg-slate-950/50">
            <div className="text-center px-4">
              <MapPin size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-[11px] font-black uppercase tracking-widest mt-4">Select a job to view map</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const handleExportOrdersCsv = () => {
    if (workOrders.length === 0) { notify('No work orders to export.', 'error'); return; }
    const esc = (v) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const headers = ['Title','Customer','Date','Status','Acres','Product','Rate (oz/ac)','Aircraft','Location','Latitude','Longitude','Notes'];
    const rows = workOrders.map((w) => [
      w.title, w.customer, w.date, w.status, w.acres, w.product, w.applicationRate,
      (w.selectedAircraft || []).join('; '), w.locationName || '', w.finalLat || '', w.finalLon || '', w.notes || ''
    ].map(esc).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Work_Orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Work orders CSV exported.', 'success');
  };

  return isEditing ? (
    <FormCard
      title={state.id ? 'Edit Work Order' : 'Create Work Order'}
      icon={CalendarDays}
      onSubmit={handleSubmit}
      onCancel={() => {
        const dirty = state.title || state.customer || state.acres || state.chemical;
        if (dirty) {
          if (window.confirm('Save changes before closing?')) { handleSubmit(); return; }
        }
        setIsEditing(false); setState(defaultWorkOrderState); setWasCompleted(false);
      }}
      submitLabel={state.status === 'Completed' && !wasCompleted ? 'Save & Log Mission' : 'Save Schedule'}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <Input label="Job Title" value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} required placeholder="e.g. Field 1 Spray" />
        <div className="flex flex-col gap-2 min-w-0">
          <Select
            label="Customer"
            value={inlineCustomer ? 'ADD_NEW' : state.customer}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW') {
                setInlineCustomer(true);
              } else {
                setInlineCustomer(false);
                setState({ ...state, customer: e.target.value });
              }
            }}
            required
          >
            <option className="bg-slate-900" value="">
              Select Customer...
            </option>
            {customers.map((customer) => (
              <option className="bg-slate-900" key={customer.id} value={customer.name}>
                {customer.name}
              </option>
            ))}
            <option className="bg-slate-800 text-[#9cd33b]" value="ADD_NEW">
              + Create New Customer
            </option>
          </Select>
          {inlineCustomer && <InlineCustomerForm data={newCustData} setData={setNewCustData} onClose={() => setInlineCustomer(false)} onSave={() => {
            if (!newCustData.name) { notify('Customer name is required.', 'error'); return; }
            const saved = onAddCustomer(newCustData);
            setState({ ...state, customer: saved.name });
            setNewCustData({ name: '', contactName: '', email: '', phone: '', address: '', city: '', state: '', zip: '' });
            setInlineCustomer(false);
            notify('Customer added.', 'success');
          }} />}
        </div>

        <Input
          type="date"
          label="Scheduled Date (Optional)"
          value={state.date}
          onChange={(e) => {
            const newDate = e.target.value;
            let newStatus = state.status;
            if (newDate && (!newStatus || newStatus === 'Pending Dispatch')) newStatus = 'Scheduled';
            if (!newDate) newStatus = 'Pending Dispatch';
            setState({ ...state, date: newDate, status: newStatus, isScheduled: !!newDate });
          }}
        />

        <div className="space-y-2 lg:col-span-2 min-w-0">
          <label className={tw.label}>Assign Aircraft (Auto-calculates ETA)</label>
          <div className="flex flex-wrap gap-2">
            {fleet.map((d) => {
              const droneId = d.id || 'Unknown';
              const selected = (state.selectedAircraft || []).includes(droneId);
              return (
                <button
                  key={droneId}
                  type="button"
                  onClick={() => {
                    const current = state.selectedAircraft || [];
                    const next = (current || []).includes(droneId) ? current.filter((id) => id !== droneId) : [...current, droneId];
                    const est = calculateEstimate(state.acres, fleet.filter((f) => (next || []).includes(f.id)), state.kmlData, state.appRate);
                    setState({ ...state, selectedAircraft: next, estHoursMin: est.min, estHoursMax: est.max });
                  }}
                  className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all truncate max-w-full ${selected ? 'bg-[#9cd33b] text-[#020617] border-[#9cd33b] shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-[#9cd33b]/50'}`}
                >
                  {droneId}
                </button>
              );
            })}
          </div>
        </div>

        <Input label="Acreage" type="number" value={state.acres} onChange={e => setState({ ...state, acres: e.target.value })} required />
        {/* Multi-product support: allow adding multiple products */}
        <div className="space-y-2">
          <label className={tw.label}>Products</label>
          {(state.products || []).map((prod, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <Select value={prod} onChange={e => {
                const newProducts = [...state.products];
                newProducts[idx] = e.target.value;
                setState({ ...state, products: newProducts });
              }} required>
                <option className="bg-slate-900" value="" disabled>Select Product...</option>
                {products.map((product) => (
                  <option className="bg-slate-900" key={product.id} value={product.name}>{product.name}</option>
                ))}
              </Select>
              <button type="button" className="text-red-400 text-xs font-bold" onClick={() => setState({ ...state, products: state.products.filter((_, i) => i !== idx) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="px-4 py-2 rounded-xl border border-[#9cd33b] text-[#9cd33b] font-black uppercase text-xs tracking-widest bg-slate-900 hover:bg-slate-800 transition" onClick={() => setState({ ...state, products: [...(state.products || []), ''] })}>+ Add Product</button>
        </div>
        <Input label="App Vol. (GPA)" type="number" step="any" value={state.appRate} onChange={e => setState({ ...state, appRate: e.target.value })} rightElement={<span className="text-[9px] text-slate-500 font-black">GPA</span>} />
        <GeoAndKmlInput state={state} setState={setState} notify={notify} kmlRef={kmlRef} workOrders={workOrders} />

        <div className="md:col-span-2">
          <Select
            label="Chemical / Product"
            value={inlineProduct ? 'ADD_NEW' : (state.chemical || '')}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW') {
                setInlineProduct(true);
              } else {
                setInlineProduct(false);
                setState({ ...state, chemical: e.target.value });
              }
            }}
            required
          >
            <option className="bg-slate-900" value="" disabled>
              Select Product...
            </option>
            {products.map((product) => (
              <option className="bg-slate-900" key={product.id} value={product.name}>
                {product.name}
              </option>
            ))}
            <option className="bg-slate-800 text-[#9cd33b]" value="ADD_NEW">
              + Create New Product
            </option>
          </Select>
          {inlineProduct && <InlineProductForm data={newProdData} setData={setNewProdData} onClose={() => setInlineProduct(false)} onSave={() => {
            if (!newProdData.name) { notify('Product name is required.', 'error'); return; }
            const saved = onAddProduct(newProdData);
            setState({ ...state, chemical: saved.name });
            setNewProdData({ name: '', defaultRate: '', inventory: '' });
            setInlineProduct(false);
            notify('Product added.', 'success');
          }} />}
        </div>

        <GeoAndKmlInput state={state} setState={setState} notify={notify} kmlRef={kmlRef} workOrders={workOrders} />

        <Select label="Job Status" value={state.status} onChange={(e) => setState({ ...state, status: e.target.value })}>
          <option className="bg-slate-900" value="Pending Dispatch">Pending Dispatch</option>
          <option className="bg-slate-900" value="Scheduled">Scheduled</option>
          <option className="bg-slate-900" value="In Progress">In Progress</option>
          <option className="bg-slate-900" value="Paused (Weather Hold)">Paused (Weather Hold)</option>
          <option className="bg-slate-900" value="Completed">Completed</option>
          <option className="bg-slate-900" value="Cancelled">Cancelled</option>
        </Select>

          {/* Recurrence removed as requested */}
        {state.recurrence && state.recurrence !== 'none' && (
          <Input type="date" label="Repeat Until" value={state.recurrenceEnd || ''} onChange={(e) => setState({ ...state, recurrenceEnd: e.target.value })} />
        )}
      </div>
    </FormCard>
  ) : (
    <div className="space-y-6 animate-fade-in min-w-0 h-full flex flex-col">
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 !p-6 border-[#9cd33b]/20 shrink-0">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <CalendarDays size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">Smart Weather Routing</h2>
            <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">Manage Database Records</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 shrink-0">
          <div className="flex bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm p-1">
            <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest ${viewMode === 'calendar' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutDashboard size={14} /> Calendar</button>
            <button onClick={() => setViewMode('map')} className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest ${viewMode === 'map' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><MapPin size={14} /> Map</button>
          </div>
          <Button variant="secondary" onClick={handleExportOrdersCsv} className="text-[10px]"><Download size={14} /> Export CSV</Button>
          <Button onClick={() => { setState(defaultWorkOrderState); setIsEditing(true); }}><Plus size={16} /> New Order</Button>
        </div>
      </Card>

      <StatsRow stats={scheduleStats} />

      {viewMode === 'calendar' ? renderCalendar() : renderMapView()}
    </div>
  );
};

export default ScheduleTab;
