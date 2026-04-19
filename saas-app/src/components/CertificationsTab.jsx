import { Award, AlertTriangle } from 'lucide-react';
import { FormCard, TableCard, Input, Select, ActionButtons } from './ui/components';

const defaultCertState = {
  id: '',
  isEditing: false,
  name: 'FAA Part 137',
  customName: '',
  licenseNumber: '',
  state: 'FEDERAL',
  expirationDate: ''
};

const daysUntil = (dateStr) => {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d)) return Infinity;
  return Math.ceil((d - new Date()) / 86400000);
};

const ExpirationBadge = ({ dateStr }) => {
  const days = daysUntil(dateStr);
  if (days > 30) return <p className="text-slate-100 text-sm break-words">{String(dateStr)}</p>;
  const expired = days <= 0;
  return (
    <div className="flex items-center gap-2">
      <p className={`text-sm break-words font-black ${expired ? 'text-red-400' : 'text-amber-400'}`}>{String(dateStr)}</p>
      <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${expired ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
        <AlertTriangle size={10} />{expired ? 'Expired' : `${days}d left`}
      </span>
    </div>
  );
};

const CertificationsTab = ({ items, isEditing, state, setState, onCancel, onSubmit, onDelete }) => {
  if (isEditing) {
    return (
      <FormCard
        title={state.id ? 'Edit Certification' : 'Upload Certification'}
        icon={Award}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel={state.id ? 'Update Cert' : 'Add Cert'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
          <Select label="Cert Type" value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required>
            <option className="bg-slate-900" value="FAA Part 137">FAA Part 137</option>
            <option className="bg-slate-900" value="FAA 44807">FAA 44807</option>
            <option className="bg-slate-900" value="FAA Part 107">FAA Part 107</option>
            <option className="bg-slate-900" value="Medical">Medical Certificate</option>
            <option className="bg-slate-900" value="State Pesticide">State Pesticide</option>
            <option className="bg-slate-900" value="Other">Other...</option>
          </Select>
          {state.name === 'Other' && <Input label="Specify Cert Name" value={state.customName} onChange={(e) => setState({ ...state, customName: e.target.value })} required />}
          <Input label="License #" value={state.licenseNumber} onChange={(e) => setState({ ...state, licenseNumber: e.target.value })} />
          <Input label="State (If Applicable)" value={state.state} onChange={(e) => setState({ ...state, state: e.target.value })} />
          <Input type="date" label="Expiration Date" value={state.expirationDate} onChange={(e) => setState({ ...state, expirationDate: e.target.value })} required />
        </div>
      </FormCard>
    );
  }

  return (
    <TableCard title="Compliance Certifications" icon={Award} actionLabel="Certificate" onAction={() => setState({ ...defaultCertState, isEditing: true })}>
      <table className="w-full text-left min-w-[600px]">
        <thead className="thead">
          <tr>
            <th className="th">Certificate</th>
            <th className="th">License #</th>
            <th className="th">Expiration</th>
            <th className={`${'th'} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {items.length === 0 ? (
            <tr>
              <td colSpan="4" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                No certs filed.
              </td>
            </tr>
          ) : (
            items.map((cert) => (
              <tr key={cert.id} className="tr">
                <td className="td min-w-[150px]">
                  <p className="font-black text-slate-200 text-sm break-words">{String(cert.name)}</p>
                  <p className="text-[10px] text-slate-400 uppercase mt-1 tracking-widest break-words">{String(cert.state || 'FEDERAL')}</p>
                </td>
                <td className="td min-w-[150px]"><p className="text-slate-300 font-mono text-xs break-all">{String(cert.licenseNumber)}</p></td>
                <td className="td min-w-[150px]"><ExpirationBadge dateStr={cert.expirationDate} /></td>
                <td className="td text-right whitespace-nowrap"><ActionButtons onEdit={() => setState({ ...cert, isEditing: true })} onDelete={() => onDelete('certifications', cert.id)} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableCard>
  );
};

export default CertificationsTab;
