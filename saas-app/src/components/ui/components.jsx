import { Edit3, Trash2, Plus, X } from 'lucide-react';

export const tw = {
  input: "w-full bg-slate-950/50 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b]/60 focus:ring-4 focus:ring-[#9cd33b]/10 focus:bg-slate-900 transition-all duration-300 min-w-0 shadow-inner",
  label: "text-[10px] text-slate-400 font-black uppercase tracking-widest pl-1 truncate block group-focus-within:text-[#9cd33b] transition-colors",
  btnBase: "px-5 py-3.5 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.96] relative overflow-hidden group",
  btnPrimary: "bg-gradient-to-r from-[#9cd33b] to-[#7ab02b] text-[#020617] shadow-[0_0_15px_rgba(156,211,59,0.2)] hover:shadow-[0_0_25px_rgba(156,211,59,0.4)] border border-[#bce455]/50",
  btnSecondary: "bg-slate-800/80 backdrop-blur-md text-slate-200 hover:bg-slate-700 hover:shadow-lg border border-slate-700/50 hover:border-slate-600",
  btnDanger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  thead: "bg-slate-800/60 text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-800",
  th: "p-6 text-left",
  tr: "hover:bg-slate-800/40 border-b border-slate-800/50 transition-colors",
  td: "p-6",
  actionBtnEdit: "text-blue-500 hover:text-blue-400 mr-4 p-2 transition-colors",
  actionBtnDel: "text-red-500 hover:text-red-400 p-2 transition-colors"
};

export const Card = ({ children, className = '' }) => (
  <div className={`glass-card p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.25)] backdrop-blur-md relative overflow-hidden ${className}`}>
    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-600/30 to-transparent"></div>
    {children}
  </div>
);

export const Button = ({ children, onClick, variant = 'primary', className = '', type = 'button', disabled = false, ...props }) => {
  const variantClass = variant === 'primary' ? tw.btnPrimary : variant === 'secondary' ? tw.btnSecondary : tw.btnDanger;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${tw.btnBase} ${variantClass} ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-500 ease-in-out"></div>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  );
};

export const Input = ({ label, value, onChange, type = 'text', required, rightElement, className = '' }) => (
  <div className={`space-y-2 min-w-0 group ${className}`}>
    {label && <label className={tw.label}>{label}</label>}
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className={`${tw.input} ${rightElement ? 'pr-12' : ''}`}
      />
      {rightElement && <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">{rightElement}</div>}
    </div>
  </div>
);

export const Select = ({ label, value, onChange, required, children, className = '' }) => (
  <div className={`space-y-2 min-w-0 group ${className}`}>
    {label && <label className={tw.label}>{label}</label>}
    <select
      value={value}
      onChange={onChange}
      required={required}
      className={`${tw.input} font-bold`}
    >
      {children}
    </select>
  </div>
);

export const TextArea = ({ label, value, onChange, required, className = '' }) => (
  <div className={`space-y-2 min-w-0 group ${className}`}>
    {label && <label className={tw.label}>{label}</label>}
    <textarea
      value={value}
      onChange={onChange}
      required={required}
      rows={4}
      className={`${tw.input} h-32 resize-none`}
    />
  </div>
);

export const FormCard = ({ title, icon: Icon, children, onSubmit, onCancel, submitLabel = 'Save Record' }) => (
  <div className="space-y-6 animate-fade-in">
    {onCancel && (
      <div className="flex">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl transition-colors hover:bg-slate-800"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    )}
    <Card className="border-[#9cd33b]/20">
      <div className="flex items-center gap-5 font-black uppercase tracking-widest border-b border-slate-800 pb-6 mb-8 flex-wrap">
        {Icon && (
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <Icon size={28} className="shrink-0" />
          </div>
        )}
        <span className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">{title}</span>
      </div>
      <div className="space-y-8">
        {children}
        {onSubmit && (
          <div className="pt-8 border-t border-slate-800">
            <Button type="button" onClick={onSubmit} className="w-full py-5 text-sm">
              {submitLabel}
            </Button>
          </div>
        )}
      </div>
    </Card>
  </div>
);

export const TableCard = ({ title, icon: Icon, children, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }) => (
  <div className="space-y-8 animate-fade-in">
    <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 !p-6 border-[#9cd33b]/20">
      <div className="flex items-center gap-5 min-w-0 flex-1">
        <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
          {Icon && <Icon size={28} />}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">{title}</h2>
          <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">Manage Database Records</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 w-full md:w-auto shrink-0">
        {onSecondaryAction && (
          <Button variant="secondary" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </Button>
        )}
        {onAction && (
          <Button type="button" onClick={onAction} className="flex-1 md:flex-none">
            <Plus size={16} /> {actionLabel}
          </Button>
        )}
      </div>
    </Card>
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-[3rem] overflow-hidden shadow-2xl">
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  </div>
);

export const ActionButtons = ({ onEdit, onDelete }) => (
  <div className="flex gap-2">
    {onEdit && (
      <button onClick={onEdit} className={tw.actionBtnEdit}>
        <Edit3 size={16} />
      </button>
    )}
    {onDelete && (
      <button onClick={onDelete} className={tw.actionBtnDel}>
        <Trash2 size={16} />
      </button>
    )}
  </div>
);
