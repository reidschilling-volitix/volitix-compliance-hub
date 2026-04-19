import { useState } from 'react';
import { Plane, Edit3, Trash2, Plus, Save } from 'lucide-react';
import { Button, Card, Input, Select } from './ui/components';

const PREDEFINED_DRONES = [
  { label: 'DJI Agras T10', rate: 12 },
  { label: 'DJI Agras T20', rate: 20 },
  { label: 'DJI Agras T30', rate: 30 },
  { label: 'DJI Agras T40', rate: 40 },
  { label: 'DJI Agras T50', rate: 45 },
  { label: 'DJI Agras T100', rate: 60 },
  { label: 'XAG P40 / V40', rate: 25 },
  { label: 'XAG P100', rate: 38 },
  { label: 'XAG P100 Pro', rate: 45 },
  { label: 'XAG P150', rate: 55 },
  { label: 'XAG P150 MAX', rate: 60 },
  { label: 'Hylio AG-110', rate: 12 },
  { label: 'Hylio AG-116', rate: 18 },
  { label: 'Hylio AG-122', rate: 25 },
  { label: 'Hylio AG-130 / AG-230', rate: 35 },
  { label: 'Hylio AG-272', rate: 50 },
  { label: 'EAVision J70', rate: 30 },
  { label: 'EAVision J100', rate: 40 },
  { label: 'EAVision J150', rate: 50 },
  { label: 'Ceres Air Black Betty', rate: 35 },
  { label: 'Vector AGR HD580', rate: 55 },
  { label: 'Talos T60x', rate: 50 },
  { label: 'Custom (Add New Model)', rate: '' }
];

const FleetTab = ({ company, setCompany, customUser, subscription, notify, onManageBilling, onSaveFleet }) => {
  const [editingDrone, setEditingDrone] = useState(null);

  const includedDrones = Math.max(0, Number(subscription?.includedDrones ?? 2) || 2);
  const extraDrones = Math.max(0, Number(subscription?.extraDrones ?? 0) || 0);
  const allowedDrones = includedDrones + extraDrones;
  const fleetCount = Array.isArray(company?.fleet) ? company.fleet.length : 0;
  const atOrAboveCap = fleetCount >= allowedDrones;

  const addNewDrone = () => {
    if (atOrAboveCap) {
      notify?.(`Fleet limit reached (${allowedDrones}). Increase billed drones in Billing & Plan.`, 'error');
      return;
    }

    const newId = `N-${Math.floor(1000 + Math.random() * 9000)}`;
    const updated = [
      ...(company.fleet || []),
      { id: newId, model: 'DJI Agras T40', sprayRate: 40, sn: '0000' }
    ];
    setCompany({ ...company, fleet: updated });
    onSaveFleet?.(updated);
    setEditingDrone(updated.length - 1);
  };

  const saveFleet = (fleet) => {
    setCompany({ ...company, fleet });
  };

  return (
    <div className="space-y-8 animate-fade-in min-w-0">
      <Card className="flex flex-col md:flex-row justify-between items-center gap-6 !p-6 border-[#9cd33b]/20">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <Plane size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">Aircraft Fleet</h2>
            <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">Manage deployed aircraft</p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2">
              Capacity: {fleetCount}/{allowedDrones} aircraft ({includedDrones} included + {extraDrones} billed add-on)
            </p>
          </div>
        </div>
        {customUser?.role === 'Manager' && (
          <div className="w-full md:w-auto shrink-0 flex flex-col md:flex-row gap-2">
            <Button onClick={addNewDrone} className="w-full md:w-auto" disabled={atOrAboveCap}>
              <Plus size={16} /> Register Aircraft
            </Button>
            {atOrAboveCap && (
              <Button type="button" variant="secondary" className="w-full md:w-auto" onClick={() => onManageBilling?.()}>
                Manage Billing
              </Button>
            )}
          </div>
        )}
      </Card>

      {customUser?.role === 'Manager' && atOrAboveCap && (
        <Card className="border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">
            Fleet cap reached. Add more billed drones in Billing & Plan to register additional aircraft.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(company.fleet || []).map((drone, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex flex-col gap-2 min-w-0 shadow-xl relative">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <span className="text-2xl font-black text-slate-100 block truncate">{String(drone.id)}</span>
                <p className="text-sm text-[#9cd33b] font-bold uppercase mt-1 truncate">
                  {String(drone.model)}
                  <span className="text-slate-500 font-mono text-[10px] ml-2">({String(drone.sprayRate || 30)} AC/HR @ 2 GPA)</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">S/N: {String(drone.sn)}</p>
              </div>
              {customUser?.role === 'Manager' && (
                <button
                  onClick={() => setEditingDrone(editingDrone === idx ? null : idx)}
                  className={`shrink-0 p-3 rounded-xl transition-colors ${
                    editingDrone === idx ? 'bg-slate-800 text-white' : 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20'
                  }`}
                >
                  <Edit3 size={16} />
                </button>
              )}
            </div>

            {editingDrone === idx && (
              <div className="mt-4 pt-6 border-t border-slate-800 space-y-4">
                <Input
                  label="N-Number"
                  placeholder="N-Number"
                  value={drone.id}
                  onChange={(e) => {
                    const fleet = [...(company.fleet || [])];
                    fleet[idx].id = e.target.value;
                    saveFleet(fleet);
                  }}
                />

                <Select
                  label="Drone Model"
                  value={PREDEFINED_DRONES.some((p) => p.label === drone.model) ? drone.model : 'Custom (Add New Model)'}
                  onChange={(e) => {
                    const val = e.target.value;
                    const fleet = [...(company.fleet || [])];
                    if (val === 'Custom (Add New Model)') {
                      fleet[idx].model = '';
                      fleet[idx].sprayRate = '';
                    } else {
                      const preset = PREDEFINED_DRONES.find((p) => p.label === val);
                      fleet[idx].model = val;
                      fleet[idx].sprayRate = preset?.rate || '';
                    }
                    saveFleet(fleet);
                  }}
                >
                  {PREDEFINED_DRONES.map((preset) => (
                    <option className="bg-slate-900" value={preset.label} key={preset.label}>
                      {preset.label}
                    </option>
                  ))}
                </Select>

                {(!PREDEFINED_DRONES.some((p) => p.label === drone.model) || drone.model === '') && (
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Custom Model Name"
                      value={drone.model}
                      onChange={(e) => {
                        const fleet = [...(company.fleet || [])];
                        fleet[idx].model = e.target.value;
                        saveFleet(fleet);
                      }}
                    />
                    <Input
                      label="Spray Rate (Acres/Hr @ 2 GPA)"
                      type="number"
                      step="any"
                      value={drone.sprayRate}
                      onChange={(e) => {
                        const fleet = [...(company.fleet || [])];
                        fleet[idx].sprayRate = e.target.value;
                        saveFleet(fleet);
                      }}
                    />
                  </div>
                )}

                <Input
                  label="Serial Number"
                  placeholder="S/N"
                  value={drone.sn}
                  onChange={(e) => {
                    const fleet = [...(company.fleet || [])];
                    fleet[idx].sn = e.target.value;
                    saveFleet(fleet);
                  }}
                />

                <div className="flex gap-3 pt-4 border-t border-slate-800">
                  <Button variant="secondary" className="flex-1 py-4 text-xs" onClick={() => { onSaveFleet?.(company.fleet); setEditingDrone(null); }}>
                    <Save size={14} /> Save & Close
                  </Button>
                  <Button
                    variant="danger"
                    className="py-4 px-6 shrink-0"
                    onClick={() => {
                      const fleet = (company.fleet || []).filter((_, i) => i !== idx);
                      saveFleet(fleet);
                      onSaveFleet?.(fleet);
                      setEditingDrone(null);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {(company.fleet || []).length === 0 && (
          <div className="col-span-full p-12 border-2 border-dashed border-slate-800 rounded-[2rem] flex flex-col items-center justify-center text-slate-500">
            <Plane size={48} className="mb-4 opacity-30" />
            <p className="text-xs font-bold uppercase tracking-widest text-center mt-4">No aircraft in fleet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FleetTab;
