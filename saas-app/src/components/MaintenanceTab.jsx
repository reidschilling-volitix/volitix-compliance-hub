import { useState } from 'react';
import { Wrench, X, AlertTriangle } from 'lucide-react';
import { Button, FormCard, Input, Select, TableCard, ActionButtons, TextArea, tw } from './ui/components';

const defaultRecord = {
  id: '',
  date: '',
  assetId: '',
  workPerformed: '',
  notes: ''
};

const EQUIPMENT_TYPES = ['Drone', 'Battery', 'Generator', 'Controller', 'Spray System', 'Other'];

const defaultEquipment = {
  id: '',
  name: '',
  type: 'Drone',
  serialNumber: '',
  nextServiceDate: '',
};

const MaintenanceTab = ({ maintenanceRecords, setMaintenanceRecords, equipmentList, setEquipmentList, fleet, notify }) => {
  const [editingLog, setEditingLog] = useState(false);
  const [record, setRecord] = useState(defaultRecord);
  const [editingEquip, setEditingEquip] = useState(false);
  const [equipState, setEquipState] = useState(defaultEquipment);
  const [inlineEquip, setInlineEquip] = useState(false);
  const [newEquipData, setNewEquipData] = useState({ name: '', type: 'Drone', serialNumber: '' });

  const saveRecord = () => {
    if (!record.date || !record.assetId || !record.workPerformed) {
      notify('Date, asset, and maintenance details are required.', 'error');
      return;
    }

    if (record.id) {
      setMaintenanceRecords((prev) => prev.map((item) => (item.id === record.id ? { ...record } : item)));
      notify('Maintenance record updated.', 'success');
    } else {
      setMaintenanceRecords((prev) => [{ ...record, id: `m-${Date.now()}` }, ...prev]);
      notify('Maintenance record logged.', 'success');
    }
    setEditingLog(false);
    setInlineEquip(false);
    setRecord(defaultRecord);
  };

  const saveRecordWithInlineEquipment = () => {
    if (inlineEquip) {
      if (!newEquipData.name) {
        notify('Equipment name is required.', 'error');
        return;
      }
      const created = { ...newEquipData, id: `e-${Date.now()}` };
      setEquipmentList((prev) => [created, ...prev]);
      setRecord((prev) => ({ ...prev, assetId: `${created.name} (${created.type})` }));
      setInlineEquip(false);
      setNewEquipData({ name: '', type: 'Drone', serialNumber: '' });
      notify('Equipment added to roster.', 'success');
      return;
    }
    saveRecord();
  };

  const saveEquipment = () => {
    if (!equipState.name) {
      notify('Equipment name is required.', 'error');
      return;
    }

    if (equipState.id) {
      setEquipmentList((prev) => prev.map((item) => (item.id === equipState.id ? { ...equipState } : item)));
      notify('Equipment updated.', 'success');
    } else {
      setEquipmentList((prev) => [{ ...equipState, id: `e-${Date.now()}` }, ...prev]);
      notify('Equipment added.', 'success');
    }

    setEditingEquip(false);
    setEquipState(defaultEquipment);
  };

  const editItem = (item) => {
    setRecord(item);
    setEditingLog(true);
  };

  const deleteItem = (id) => {
    setMaintenanceRecords((prev) => prev.filter((item) => item.id !== id));
    notify('Maintenance record deleted.', 'success');
  };

  const deleteEquipment = (id) => {
    setEquipmentList((prev) => prev.filter((item) => item.id !== id));
    notify('Equipment removed.', 'success');
  };

  const equipmentOptions = [
    ...(equipmentList || []),
    ...((fleet || []).map((f) => ({ id: `fleet-${f.id}`, name: f.model || f.id, type: 'Drone', serialNumber: f.sn || '' }))),
  ];

  if (editingEquip) {
    return (
      <FormCard
        title={equipState.id ? 'Edit Equipment' : 'Add New Equipment'}
        icon={Wrench}
        onSubmit={saveEquipment}
        onCancel={() => {
          setEditingEquip(false);
          setEquipState(defaultEquipment);
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
          <Input label="Equipment Name / Asset ID" value={equipState.name} onChange={(e) => setEquipState({ ...equipState, name: e.target.value })} required />
          <Select label="Equipment Type" value={equipState.type} onChange={(e) => setEquipState({ ...equipState, type: e.target.value })}>
            {EQUIPMENT_TYPES.map((t) => <option className="bg-slate-900" key={t} value={t}>{t}</option>)}
          </Select>
          <div className="md:col-span-2">
            <Input label="Serial Number (Optional)" value={equipState.serialNumber} onChange={(e) => setEquipState({ ...equipState, serialNumber: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Input label="Next Service Date" type="date" value={equipState.nextServiceDate || ''} onChange={(e) => setEquipState({ ...equipState, nextServiceDate: e.target.value })} />
          </div>
        </div>
      </FormCard>
    );
  }

  return editingLog ? (
    <FormCard
      title={record.id ? 'Edit Log' : 'New Maintenance Log'}
      icon={Wrench}
      onSubmit={saveRecordWithInlineEquipment}
      onCancel={() => {
        setEditingLog(false);
        setInlineEquip(false);
        setRecord(defaultRecord);
      }}
      submitLabel="Save Record"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <Input label="Date" type="date" value={record.date} onChange={(e) => setRecord({ ...record, date: e.target.value })} required />
        <div className="flex flex-col gap-2 min-w-0">
          <Select
            label="Asset ID / Equipment"
            value={inlineEquip ? 'ADD_NEW' : record.assetId}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW') {
                setInlineEquip(true);
              } else {
                setInlineEquip(false);
                setRecord({ ...record, assetId: e.target.value });
              }
            }}
            required
          >
            <option className="bg-slate-900" value="">Select Equipment...</option>
            {equipmentOptions.map((eq) => (
              <option className="bg-slate-900" key={eq.id} value={`${eq.name} (${eq.type})`}>
                {eq.name} ({eq.type})
              </option>
            ))}
            <option className="bg-slate-800 text-[#9cd33b]" value="ADD_NEW">+ Add New Equipment</option>
          </Select>
          {inlineEquip && (
            <div className="p-6 bg-slate-950 border border-[#9cd33b]/50 rounded-2xl space-y-4 min-w-0 mt-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-2">
                <span className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest truncate pr-2">New Equipment Profile</span>
                <Button variant="secondary" onClick={() => setInlineEquip(false)} className="py-2 px-3 shrink-0"><X size={14} /></Button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Input label="Equipment Name / ID" value={newEquipData.name} onChange={(e) => setNewEquipData({ ...newEquipData, name: e.target.value })} required />
                <Select label="Type" value={newEquipData.type} onChange={(e) => setNewEquipData({ ...newEquipData, type: e.target.value })}>
                  {EQUIPMENT_TYPES.map((t) => <option className="bg-slate-900" key={t} value={t}>{t}</option>)}
                </Select>
                <Input label="Serial Number" value={newEquipData.serialNumber} onChange={(e) => setNewEquipData({ ...newEquipData, serialNumber: e.target.value })} />
              </div>
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <TextArea label="Detailed Work Performed" value={record.workPerformed} onChange={(e) => setRecord({ ...record, workPerformed: e.target.value })} required />
        </div>
      </div>
    </FormCard>
  ) : (
    <div className="space-y-8">
      <TableCard title="Maintenance Logs" icon={Wrench} actionLabel="Log" onAction={() => { setRecord(defaultRecord); setEditingLog(true); }}>
        <table className="w-full text-left min-w-[600px]">
          <thead className={tw.thead}>
            <tr>
              <th className={tw.th}>Date / Asset</th>
              <th className={tw.th}>Work Performed</th>
              <th className={`${tw.th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {maintenanceRecords.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  No maintenance recorded.
                </td>
              </tr>
            ) : (
              maintenanceRecords.map((m) => (
                <tr key={m.id} className={tw.tr}>
                  <td className={`${tw.td} min-w-[150px]`}>
                    <p className="font-mono text-[#9cd33b] text-xs font-black break-words">{String(m.date)}</p>
                    <p className="text-[11px] text-slate-200 font-bold uppercase mt-1 tracking-widest break-words">{String(m.assetId)}</p>
                  </td>
                  <td className={`${tw.td} min-w-[300px]`}>
                    <p className="text-slate-400 text-xs leading-relaxed max-w-2xl break-words">{String(m.workPerformed)}</p>
                  </td>
                  <td className={`${tw.td} text-right whitespace-nowrap`}>
                    <ActionButtons onEdit={() => editItem(m)} onDelete={() => deleteItem(m.id)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>

      <TableCard title="Equipment Roster" icon={Wrench} actionLabel="Add Equipment" onAction={() => { setEquipState(defaultEquipment); setEditingEquip(true); }}>
        <table className="w-full text-left min-w-[600px]">
          <thead className={tw.thead}>
            <tr>
              <th className={tw.th}>Equipment Name / ID</th>
              <th className={tw.th}>Type</th>
              <th className={tw.th}>Next Service</th>
              <th className={`${tw.th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {(equipmentList || []).length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  No equipment added.
                </td>
              </tr>
            ) : (
              equipmentList.map((eq) => (
                <tr key={eq.id} className={tw.tr}>
                  <td className={`${tw.td} min-w-[150px]`}>
                    <p className="font-black text-slate-200 text-sm break-words">{String(eq.name)}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 tracking-widest break-words">S/N: {String(eq.serialNumber || 'N/A')}</p>
                  </td>
                  <td className={`${tw.td} min-w-[150px]`}>
                    <span className="bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{String(eq.type)}</span>
                  </td>
                  <td className={`${tw.td} min-w-[130px]`}>
                    {eq.nextServiceDate ? (() => {
                      const days = Math.ceil((new Date(eq.nextServiceDate) - new Date()) / 86400000);
                      return (
                        <div>
                          <p className="text-xs font-mono text-slate-300">{eq.nextServiceDate}</p>
                          {days <= 0 && <p className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest text-red-400"><AlertTriangle size={10} /> Overdue</p>}
                          {days > 0 && days <= 7 && <p className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest text-amber-400"><AlertTriangle size={10} /> Due Soon</p>}
                        </div>
                      );
                    })() : <span className="text-[10px] text-slate-500 font-bold uppercase">—</span>}
                  </td>
                  <td className={`${tw.td} text-right whitespace-nowrap`}>
                    <ActionButtons onEdit={() => { setEquipState(eq); setEditingEquip(true); }} onDelete={() => deleteEquipment(eq.id)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
};

export default MaintenanceTab;
