import { Users, FileCode, FileText } from 'lucide-react';
import { FormCard, TableCard, Input, Select, TextArea, ActionButtons, Button } from './ui/components';

const defaultCustomerState = {
  id: '',
  isEditing: false,
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

const CustomersTab = ({
  items,
  pilots,
  customUser,
  isEditing,
  state,
  setState,
  onCancel,
  onSubmit,
  onDelete,
  onExport,
  logs = [],
  company = {}
}) => {
  const generateClientSummary = async (customer) => {
    const customerLogs = logs.filter(l => l.customer === customer.name);
    if (customerLogs.length === 0) return;
    const totalAcres = customerLogs.reduce((a, l) => a + (parseFloat(l.treatedAcreage) || parseFloat(l.totalAcreage) || 0), 0);
    const chemicals = [...new Set(customerLogs.map(l => l.chemical).filter(Boolean))];
    const rows = customerLogs.map((l, idx) =>
      `<tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#e5e7eb'}"><td style="padding:10px 8px;border:1px solid #d1d5db;font-size:14px;line-height:1.5">${l.date || ''}</td><td style="padding:10px 8px;border:1px solid #d1d5db;font-size:14px;line-height:1.5">${(l.selectedAircraft || []).join(', ')}</td><td style="padding:10px 8px;border:1px solid #d1d5db;font-size:14px;line-height:1.5">${l.chemical || ''}</td><td style="padding:10px 8px;border:1px solid #d1d5db;font-size:14px;line-height:1.5">${Number(l.treatedAcreage || l.totalAcreage || 0).toFixed(2)} ac</td><td style="padding:10px 8px;border:1px solid #d1d5db;font-size:14px;line-height:1.5">${l.locationName || ''}</td></tr>`
    ).join('');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:900px;margin:auto;background:#fff;padding:32px 24px 24px 24px;border-radius:16px;box-shadow:0 2px 12px #0001">
        <div style="text-align:center;margin-bottom:32px">
          <h1 style="margin:0;font-size:2.2em;letter-spacing:0.02em;color:#222">${company.name || 'SprayOps'}</h1>
          <p style="color:#4b5563;font-size:1.1em;margin-top:4px;margin-bottom:0;font-weight:600">Client Application Summary</p>
        </div>
        <div style="margin-bottom:24px">
          <h2 style="font-size:1.5em;margin:0 0 8px 0;color:#2563eb">${customer.name}</h2>
          <p style="font-size:1.1em;margin:0 0 4px 0"><strong>Contact:</strong> ${customer.contactName || '—'}</p>
          <p style="font-size:1.1em;margin:0 0 4px 0"><strong>Email:</strong> ${customer.email || '—'}</p>
          <p style="font-size:1.1em;margin:0 0 4px 0"><strong>Phone:</strong> ${customer.phone || '—'}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
          <thead>
            <tr style="background:#dbeafe">
              <th style="padding:12px 8px;border:1px solid #93c5fd;text-align:left;font-size:15px;letter-spacing:0.01em">Date</th>
              <th style="padding:12px 8px;border:1px solid #93c5fd;text-align:left;font-size:15px;letter-spacing:0.01em">Aircraft</th>
              <th style="padding:12px 8px;border:1px solid #93c5fd;text-align:left;font-size:15px;letter-spacing:0.01em">Product</th>
              <th style="padding:12px 8px;border:1px solid #93c5fd;text-align:left;font-size:15px;letter-spacing:0.01em">Acres</th>
              <th style="padding:12px 8px;border:1px solid #93c5fd;text-align:left;font-size:15px;letter-spacing:0.01em">Location</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <div style="font-size:1.1em;margin-bottom:8px">
          <strong>Total Missions:</strong> ${customerLogs.length} &nbsp; | &nbsp;
          <strong>Total Acres:</strong> ${Number(totalAcres).toFixed(2)} &nbsp; | &nbsp;
          <strong>Products:</strong> ${chemicals.join(', ') || '—'}
        </div>
        <div style="color:#6b7280;font-size:12px;margin-top:32px;text-align:right">Generated ${new Date().toLocaleDateString()}</div>
      </div>
    `;
    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const el = document.createElement('div');
      el.innerHTML = html;
      await html2pdf().set({ margin: 10, filename: `Client_Summary_${customer.name.replace(/\s+/g, '_')}.pdf`, html2canvas: { scale: 2 }, jsPDF: { format: 'letter' } }).from(el).save();
    } catch { /* PDF generation failed */ }
  };

  const togglePilot = (username) => {
    const assigned = state.assignedTo || [];
    const next = (assigned || []).includes(username)
      ? assigned.filter((user) => user !== username)
      : [...assigned, username];
    setState({ ...state, assignedTo: next });
  };

  if (isEditing) {
    return (
      <FormCard
        title={state.id ? 'Edit Customer Profile' : 'New Customer Profile'}
        icon={Users}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel={state.id ? 'Update Customer' : 'Add Customer'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
          <Input label="Company/Farm Name" value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required />
          <Input label="Contact Name" value={state.contactName} onChange={(e) => setState({ ...state, contactName: e.target.value })} />
          <Input label="Email" type="email" value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} />
          <Input label="Phone" value={state.phone} onChange={(e) => setState({ ...state, phone: e.target.value })} />
          <Input label="Address" value={state.address} onChange={(e) => setState({ ...state, address: e.target.value })} />
          <Input label="City" value={state.city} onChange={(e) => setState({ ...state, city: e.target.value })} />
          <Input label="State" value={state.state} onChange={(e) => setState({ ...state, state: e.target.value })} />
          <Input label="Zip" value={state.zip} onChange={(e) => setState({ ...state, zip: e.target.value })} />
          <div className="md:col-span-2"><TextArea label="Notes" value={state.notes} onChange={(e) => setState({ ...state, notes: e.target.value })} /></div>
          {customUser?.role === 'Manager' && (
            <div className="md:col-span-2 space-y-2 min-w-0">
              <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest pl-1 truncate block">Assign to Pilots</label>
              <div className="flex flex-wrap gap-2">
                {pilots.map((pilot) => {
                  const selected = (state.assignedTo || []).includes(pilot.username);
                  return (
                    <button
                      key={pilot.id}
                      type="button"
                      onClick={() => togglePilot(pilot.username)}
                      className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selected ? 'bg-[#9cd33b] text-[#020617] shadow-lg' : 'bg-slate-950 border border-slate-800 text-slate-500 hover:border-[#9cd33b]/50'}`}
                    >
                      {pilot.username}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </FormCard>
    );
  }

  return (
    <TableCard
      title="Client Roster"
      icon={Users}
      actionLabel="Customer"
      onAction={() => setState({ ...defaultCustomerState, isEditing: true })}
      secondaryActionLabel={<span className="flex items-center gap-1"><FileCode size={14} /> Export Invoices</span>}
      onSecondaryAction={onExport}
    >
      <table className="w-full text-left min-w-[600px]">
        <thead className="thead">
          <tr>
            <th className="th">Company / Contact</th>
            <th className="th">Contact Info</th>
            <th className={`${'th'} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {items.length === 0 ? (
            <tr>
              <td colSpan="3" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                No customers saved.
              </td>
            </tr>
          ) : (
            items.map((customer) => (
              <tr key={customer.id} className="tr">
                <td className="td min-w-[200px]">
                  <p className="font-black text-slate-200 text-sm break-words">{String(customer.name)}</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-1 tracking-widest break-words">{String(customer.contactName)}</p>
                </td>
                <td className="td min-w-[200px]">
                  <p className="text-slate-300 text-xs break-all">{String(customer.email)}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-1 break-words">{String(customer.phone)}</p>
                </td>
                <td className="td text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    {logs.filter(l => l.customer === customer.name).length > 0 && (
                      <button onClick={() => generateClientSummary(customer)} className="p-2 rounded-xl text-blue-400/60 hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="Client Summary PDF">
                        <FileText size={16} />
                      </button>
                    )}
                    <ActionButtons onEdit={() => setState({ ...customer, isEditing: true })} onDelete={() => onDelete('customers', customer.id)} />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableCard>
  );
};

export default CustomersTab;
