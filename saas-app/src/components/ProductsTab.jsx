import { FlaskConical, AlertTriangle } from 'lucide-react';
import { FormCard, TableCard, Input, TextArea, ActionButtons } from './ui/components';

const defaultProductState = {
  id: '',
  isEditing: false,
  name: '',
  defaultRate: '',
  inventory: '',
  description: ''
};

const ProductsTab = ({ items, isEditing, state, setState, onCancel, onSubmit, onDelete }) => {
  if (isEditing) {
    return (
      <FormCard
        title={state.id ? 'Edit Product' : 'New Chemical Product'}
        icon={FlaskConical}
        onSubmit={onSubmit}
        onCancel={onCancel}
        submitLabel={state.id ? 'Update Product' : 'Add Product'}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
          <Input label="Chemical Name" value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} required />
          <Input
            label="Default Rate"
            type="number"
            step="any"
            value={state.defaultRate}
            onChange={(e) => setState({ ...state, defaultRate: e.target.value })}
            required
            rightElement={<span className="text-[9px] text-slate-500 font-black">oz/ac</span>}
          />
          <Input
            label="Current Inventory"
            type="number"
            step="any"
            value={state.inventory}
            onChange={(e) => setState({ ...state, inventory: e.target.value })}
            rightElement={<span className="text-[9px] text-slate-500 font-black">Gal</span>}
          />
          <div className="md:col-span-2"><TextArea label="Product Description" value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} /></div>
        </div>
      </FormCard>
    );
  }

  return (
    <TableCard title="Chemical Inventory" icon={FlaskConical} actionLabel="Product" onAction={() => setState({ ...defaultProductState, isEditing: true })}>
      <table className="w-full text-left min-w-[600px]">
        <thead className="thead">
          <tr>
            <th className="th">Product Name</th>
            <th className="th">Application Rate</th>
            <th className="th">Inventory Stock</th>
            <th className={`${'th'} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40">
          {items.length === 0 ? (
            <tr>
              <td colSpan="4" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                No products saved.
              </td>
            </tr>
          ) : (
            items.map((product) => (
              <tr key={product.id} className="tr">
                <td className="td min-w-[200px]"><p className="font-black text-slate-200 text-sm uppercase break-words">{String(product.name)}</p></td>
                <td className="td min-w-[150px]"><p className="text-[#9cd33b] font-black bg-slate-950 inline-block px-3 py-1 rounded-lg text-xs break-words">{String(product.defaultRate || '0')} <span className="text-[9px] text-slate-500 ml-1">oz/ac</span></p></td>
                  <td className="td min-w-[150px]">
                    <p className="text-blue-400 font-black bg-slate-950 inline-block px-3 py-1 rounded-lg text-xs break-words">{String(parseFloat(product.inventory || 0).toFixed(2))} <span className="text-[9px] text-slate-500 ml-1">Gal</span></p>
                    {product.lowStockThreshold && parseFloat(product.inventory || 0) <= parseFloat(product.lowStockThreshold) && (
                      <p className="flex items-center gap-1 mt-1 text-[9px] font-black uppercase tracking-widest text-amber-400"><AlertTriangle size={10} /> Low Stock</p>
                    )}
                  </td>
                <td className="td text-right whitespace-nowrap"><ActionButtons onEdit={() => setState({ ...product, isEditing: true })} onDelete={() => onDelete('products', product.id)} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableCard>
  );
};

export default ProductsTab;
