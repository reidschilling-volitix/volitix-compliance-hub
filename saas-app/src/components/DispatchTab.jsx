import { useRef, useState } from 'react';
import { Send, Plus, Globe, X, Edit3, Trash2, MapPin } from 'lucide-react';
import { Button, Card, FormCard, Input, Select, TableCard, tw } from './ui/components';
import FieldMapper from './FieldMapper';

const defaultDispatchState = {
  id: '',
  title: '',
  customer: '',
  acres: '',
  chemical: '',
  appRate: '',
  status: 'Pending',
  kmlData: null,
  kmlFileName: '',
  coordType: 'Decimal',
  latDec: '',
  lonDec: '',
  latDecDir: 'N',
  lonDecDir: 'W',
  latDMS: { d: '', m: '', s: '', dir: 'N' },
  lonDMS: { d: '', m: '', s: '', dir: 'W' }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Pending': return 'bg-slate-800/80 text-slate-300 border-slate-700';
    case 'Scheduled': return 'bg-[#9cd33b]/10 text-[#9cd33b] border-[#9cd33b]/20';
    case 'Completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    default: return 'bg-slate-800/80 text-slate-300 border-slate-700';
  }
};

const DispatchTab = ({ workOrders, setWorkOrders, customers, products, notify, customUser, onAddCustomer, onAddProduct }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [state, setState] = useState(defaultDispatchState);
  const [inlineCustomer, setInlineCustomer] = useState(false);
  const [inlineProduct, setInlineProduct] = useState(false);
  const [newCustData, setNewCustData] = useState({ name: '', contactName: '' });
  const [newProdData, setNewProdData] = useState({ name: '', defaultRate: '' });
  const kmlRef = useRef(null);

  const handleKml = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setState((prev) => ({ ...prev, kmlData: ev.target?.result || null, kmlFileName: file.name }));
      notify('Boundary file attached to dispatch order.', 'success');
    };
    reader.readAsText(file);
  };

  const handleCreateCustomer = () => {
    if (!newCustData.name) {
      notify('Customer name is required.', 'error');
      return;
    }
    const created = onAddCustomer ? onAddCustomer({ ...newCustData, id: `c-${Date.now()}` }) : { ...newCustData, id: `c-${Date.now()}` };
    setState((prev) => ({ ...prev, customer: created.name }));
    setInlineCustomer(false);
    setNewCustData({ name: '', contactName: '' });
    notify('Customer created for dispatch.', 'success');
  };

  const handleCreateProduct = () => {
    if (!newProdData.name) {
      notify('Product name is required.', 'error');
      return;
    }
    const created = onAddProduct ? onAddProduct({ ...newProdData, id: `p-${Date.now()}` }) : { ...newProdData, id: `p-${Date.now()}` };
    setState((prev) => ({ ...prev, chemical: created.name }));
    setInlineProduct(false);
    setNewProdData({ name: '', defaultRate: '' });
    notify('Product created for dispatch.', 'success');
  };

  const handleSubmit = () => {
    if (!state.title || !state.customer) {
      notify('Job title and customer are required.', 'error');
      return;
    }
    const now = new Date();
    const finalState = customUser?.role === 'Dispatcher'
      ? { ...state, status: 'Pending', date: '', isScheduled: false, createdBy: customUser?.username || '', createdAt: state.createdAt || now.toISOString() }
      : { ...state, createdBy: state.createdBy || customUser?.username || '', createdAt: state.createdAt || now.toISOString() };

    if (state.id) {
      setWorkOrders((prev) => prev.map((item) => (item.id === state.id ? finalState : item)));
    } else {
      setWorkOrders((prev) => [{ ...finalState, id: `disp-${Date.now()}` }, ...prev]);
    }
    setState(defaultDispatchState);
    setIsEditing(false);
    notify('Dispatch order sent to ops.', 'success');
  };

  const handleDelete = (id) => {
    setWorkOrders((prev) => prev.filter((item) => item.id !== id));
    notify('Dispatch order deleted.', 'success');
  };


  // --- Map/FieldMapper/Google Earth/KML UI for all roles ---
  // (Copying the pattern from ScheduleTab, but simplified for DispatchTab)
  const [showFieldMapper, setShowFieldMapper] = useState(false);

  // If dispatcher has no customers or products, show a prompt instead of the form
  if (isEditing && customUser?.role === 'Dispatcher' && customers.length === 0) {
    return (
      <FormCard title="Create a Customer First" icon={Send} onCancel={() => { setIsEditing(false); setState(defaultDispatchState); }} submitLabel="">
        <div className="p-6 text-center text-slate-400 text-sm">
          You must create at least one customer before sending a new work order.<br />
          <Button className="mt-4" onClick={() => { setInlineCustomer(true); }}>Create Customer</Button>
        </div>
      </FormCard>
    );
  }
  if (isEditing && customUser?.role === 'Dispatcher' && products.length === 0) {
    return (
      <FormCard title="Create a Product First" icon={Send} onCancel={() => { setIsEditing(false); setState(defaultDispatchState); }} submitLabel="">
        <div className="p-6 text-center text-slate-400 text-sm">
          You must create at least one product before sending a new work order.<br />
          <Button className="mt-4" onClick={() => { setInlineProduct(true); }}>Create Product</Button>
        </div>
      </FormCard>
    );
  }

  return isEditing ? (
    <FormCard title={state.id ? 'Edit Work Order' : 'Send New Work Order'} icon={Send} onSubmit={handleSubmit} onCancel={() => { setIsEditing(false); setState(defaultDispatchState); }} submitLabel="Submit Order to Ops">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <Input label="Job Title" value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} required />
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
          {inlineCustomer && (
            <div className="p-6 bg-slate-950 border border-[#9cd33b]/50 rounded-2xl space-y-4 min-w-0 mt-2">
              <Input label="Customer Name" value={newCustData.name} onChange={(e) => setNewCustData({ ...newCustData, name: e.target.value })} required />
              <Input label="Contact Name" value={newCustData.contactName} onChange={(e) => setNewCustData({ ...newCustData, contactName: e.target.value })} />
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleCreateCustomer} className="py-2 px-3 text-[9px]">
                  Save Customer
                </Button>
                <Button variant="secondary" onClick={() => { setInlineCustomer(false); setNewCustData({ name: '', contactName: '' }); }} className="py-2 px-3 text-[9px]">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
        <Input type="number" label="Acreage" value={state.acres} onChange={(e) => setState({ ...state, acres: e.target.value })} />
        <Select label="Order Status" value={state.status} onChange={(e) => setState({ ...state, status: e.target.value })}>
          <option className="bg-slate-900" value="Pending">Pending</option>
          <option className="bg-slate-900" value="Scheduled">Scheduled</option>
          <option className="bg-slate-900" value="Completed">Completed</option>
        </Select>

        {/* Map/FieldMapper/Google Earth/KML UI for all roles */}
        <div className="md:col-span-2 bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
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
              <MapPin size={16} />
              Draw on Map
            </button>
            <button
              type="button"
              onClick={() => kmlRef.current?.click()}
              className="flex-1 px-4 py-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 font-black uppercase tracking-widest text-[10px]"
            >
              {state.kmlFileName || 'Attach KML'}
            </button>
            {state.kmlFileName && (
              <Button variant="danger" className="shrink-0" onClick={() => { setState({ ...state, kmlData: null, kmlFileName: '' }); if (kmlRef.current) kmlRef.current.value = ''; }}>
                <X size={16} />
              </Button>
            )}
            <input ref={kmlRef} type="file" accept=".kml" className="hidden" onChange={handleKml} />
          </div>
          <FieldMapper
            open={showFieldMapper}
            onClose={() => setShowFieldMapper(false)}
            initialLat={state.latDec}
            initialLon={state.lonDec}
            initialKml={state.kmlData}
            workOrders={workOrders}
            onApply={(data) => {
              setState((prev) => ({
                ...prev,
                kmlData: data.kmlData,
                kmlFileName: data.kmlFileName,
                latDec: data.finalLat,
                lonDec: data.finalLon,
                acres: String(data.acres),
              }));
              notify && notify(`Field boundary applied — ${data.acres} acres`, 'success');
            }}
          />
        </div>

        <div className="md:col-span-2">
          <div className="flex flex-col gap-2 min-w-0">
            <Select
              label="Chemical / Product"
              value={inlineProduct ? 'ADD_NEW' : state.chemical}
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
            {inlineProduct && (
              <div className="p-6 bg-slate-950 border border-[#9cd33b]/50 rounded-2xl space-y-4 min-w-0 mt-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-2">
                  <span className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest truncate pr-2">New Product Profile</span>
                  <Button variant="secondary" onClick={() => { setInlineProduct(false); setNewProdData({ name: '', defaultRate: '', inventory: '' }); }} className="py-2 px-3 shrink-0"><X size={14}/></Button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <Input label="Chemical Name" value={newProdData.name} onChange={(e) => setNewProdData({ ...newProdData, name: e.target.value })} required />
                  <Input label="Default Rate" type="number" step="any" value={newProdData.defaultRate} onChange={(e) => setNewProdData({ ...newProdData, defaultRate: e.target.value })} required rightElement={<span className="text-[9px] text-slate-500 font-black">oz/ac</span>} />
                  <Input label="Current Inventory" type="number" step="any" value={newProdData.inventory || ''} onChange={(e) => setNewProdData({ ...newProdData, inventory: e.target.value })} rightElement={<span className="text-[9px] text-slate-500 font-black">Gal</span>} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleCreateProduct} className="py-2 px-3 text-[9px]">
                    Save Product
                  </Button>
                  <Button variant="secondary" onClick={() => { setInlineProduct(false); setNewProdData({ name: '', defaultRate: '', inventory: '' }); }} className="py-2 px-3 text-[9px]">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Input label="Application Rate" value={state.appRate} onChange={(e) => setState({ ...state, appRate: e.target.value })} rightElement={<span className="text-[9px] text-slate-500 font-black">GPA</span>} />
    </FormCard>
  ) : (
    <div className="space-y-6 animate-fade-in min-w-0">
      {/* Removed redundant My Orders/Dispatcher order queue section for dispatchers */}

      <TableCard title="My Dispatched Orders" icon={Send} actionLabel="Send New Order" onAction={() => setIsEditing(true)}>
        <table className="w-full text-left min-w-[700px]">
          <thead className={tw.thead}>
            <tr>
              <th className={tw.th}>Job Info</th>
              <th className={tw.th}>Client / Product</th>
              <th className={tw.th}>Status</th>
              <th className={`${tw.th} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {workOrders.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  No orders submitted yet.
                </td>
              </tr>
            ) : (
              workOrders.map((job) => (
                <tr key={job.id} className={tw.tr}>
                  <td className={tw.td}>
                    <p className="font-black text-slate-200 text-sm break-words">{String(job.title || 'Untitled Job')}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase break-words">{String(job.acres)} AC</p>
                  </td>
                  <td className={tw.td}>
                    <p className="text-sm text-slate-200 font-black uppercase break-words">{String(job.customer)}</p>
                    <p className="text-[10px] text-[#9cd33b] font-bold uppercase break-words">{String(job.chemical)} {job.appRate ? `| ${job.appRate} GPA` : ''}</p>
                  </td>
                  <td className={tw.td}>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(job.status)}`}>
                      {job.status}
                    </div>
                  </td>
                  <td className={`${tw.td} text-right whitespace-nowrap`}>
                    <div className="flex justify-end gap-2 items-center">
                      {/* Edit: Dispatchers can edit only within 1 hour of creation; Managers can always edit */}
                      {(() => {
                        const isDispatcher = customUser?.role === 'Dispatcher';
                        const created = job.createdAt ? new Date(job.createdAt) : null;
                        const now = new Date();
                        const withinHour = created && (now - created < 60 * 60 * 1000);
                        if (!isDispatcher || withinHour) {
                          return (
                            <button onClick={() => { setState(job); setIsEditing(true); }} className={tw.actionBtnEdit}><Edit3 size={16} /></button>
                          );
                        }
                        return null;
                      })()}
                      {/* Delete: Always show for all roles */}
                      <button onClick={() => handleDelete(job.id)} className={tw.actionBtnDel}><Trash2 size={16} /></button>
                    </div>
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

export default DispatchTab;
