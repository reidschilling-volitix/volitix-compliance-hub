import { AlertTriangle, ArrowRight, Building2, Eye, EyeOff, Lock, ShieldCheck, UserPlus } from 'lucide-react';

const AuthPortal = ({
  toast,
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  showPassword,
  setShowPassword,
  resetUserDoc,
  handleLogin,
  handleRegister,
  handleRegisterManager,
  handleForgotPassword,
  handleResetPassword,
  setResetUserDoc,
}) => {
  return (
    <div className="flex flex-col min-h-full w-full p-4 py-12 bg-[#020617] relative overflow-y-auto">
      <div className="bg-lightning-container" style={{ backgroundColor: '#01040f' }}><div className="lightning-veins"></div></div>
      <div className="absolute top-[-10%] left-[-10%] w-[40rem] h-[40rem] bg-[#9cd33b]/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40rem] h-[40rem] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      {toast && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[250] px-6 py-3.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] font-black uppercase tracking-widest text-[11px] flex items-center gap-3 animate-fade-in border ${
            toast.type === 'error'
              ? 'bg-red-950/90 border-red-500/50 text-red-400 backdrop-blur-md'
              : toast.type === 'success'
                ? 'bg-[#9cd33b]/10 border-[#9cd33b]/50 text-[#9cd33b] backdrop-blur-md'
                : 'bg-blue-950/90 border-blue-500/50 text-blue-400 backdrop-blur-md'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          {toast.message}
        </div>
      )}

      <div className="m-auto w-full max-w-md relative z-10 py-10">
        <div className="glass-card border border-slate-800/50 w-full space-y-8 animate-fade-in shadow-[0_0_50px_rgba(156,211,59,0.1)] p-8 rounded-3xl" style={{ background: 'rgba(15, 23, 42, 0.7)', borderColor: 'rgba(255, 255, 255, 0.05)' }}>
          <div className="text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-gradient-to-br from-[#9cd33b]/20 to-transparent rounded-full flex items-center justify-center mb-6 border border-[#9cd33b]/40 shadow-[0_0_40px_rgba(156,211,59,0.2)]"><Lock className="text-[#9cd33b]" size={36} strokeWidth={2.5} /></div>
            <h1 className="text-5xl font-['Orbitron'] font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-white to-[#9cd33b] drop-shadow-[0_0_15px_rgba(156,211,59,0.4)] mb-1">Spray Ops</h1>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.4em] mt-2 mb-2">Flight Command Center</p>
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-[#9cd33b]/50 to-transparent my-4"></div>
            <p className="text-[#9cd33b] text-[10px] font-black uppercase tracking-widest mt-2">
              {authMode === 'login' ? 'Secure Login' : authMode === 'register' ? 'Join Company' : authMode === 'create-company' ? 'Create Company' : authMode === 'forgot' ? 'Account Recovery' : 'Reset Password'}
            </p>
          </div>

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" placeholder="Company Code" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.companyName} onChange={(e) => setAuthForm({ ...authForm, companyName: e.target.value })} required />
              <input type="email" placeholder="Email Address" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required />
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" className="w-full bg-slate-950 border border-slate-800 p-4 pr-12 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#9cd33b] transition-colors focus:outline-none">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <button type="submit" className="w-full py-4 mt-8 px-6 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] font-black uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(156,211,59,0.3)] transition-all flex justify-center items-center gap-3">Login <ArrowRight size={16} /></button>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Pilots and Dispatchers join using a manager-issued Company Code and Join Code.
              </p>
              <input type="text" placeholder="Company Code" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.companyName} onChange={(e) => setAuthForm({ ...authForm, companyName: e.target.value })} required />
              <input type="email" placeholder="Email Address" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required />
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" className="w-full bg-slate-950 border border-slate-800 p-4 pr-12 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#9cd33b] transition-colors focus:outline-none">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">8+ chars, uppercase, lowercase, number</p>
              <input type="text" placeholder="Join Code" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.inviteCode || ''} onChange={(e) => setAuthForm({ ...authForm, inviteCode: e.target.value })} required />
              <select className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.role} onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}>
                <option value="Pilot">Pilot</option>
                <option value="Dispatcher">Dispatcher</option>
              </select>
              <button type="submit" className="w-full py-4 mt-8 px-6 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] font-black uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(156,211,59,0.3)] transition-all flex justify-center items-center gap-3"><UserPlus size={16} /> Join Team <ArrowRight size={16} /></button>
            </form>
          )}

          {authMode === 'create-company' && (
            <form onSubmit={handleRegisterManager} className="space-y-4">
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Create a new company account. You will be the Manager with full billing control.
              </p>
              <input type="text" placeholder="Company Name" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.companyName} onChange={(e) => setAuthForm({ ...authForm, companyName: e.target.value })} required />
              <input type="email" placeholder="Email Address" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required />
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" className="w-full bg-slate-950 border border-slate-800 p-4 pr-12 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#9cd33b] transition-colors focus:outline-none">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">8+ chars, uppercase, lowercase, number</p>
              <div className="bg-blue-950/50 border border-blue-500/20 p-3 rounded-2xl">
                <p className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">14-day free trial • $50/mo base • 2 drones included</p>
              </div>
              <button type="submit" className="w-full py-4 mt-8 px-6 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] font-black uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(156,211,59,0.3)] transition-all flex justify-center items-center gap-3"><Building2 size={16} /> Create Company <ArrowRight size={16} /></button>
            </form>
          )}

          {authMode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-xs text-slate-400 text-center mb-6 leading-relaxed">Enter your account email to receive a password reset link.</p>
              <input type="email" placeholder="Email Address" className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required />
              <button type="submit" className="w-full py-4 mt-8 px-6 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] font-black uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(156,211,59,0.3)] transition-all flex justify-center items-center gap-3">Send Reset Email <ArrowRight size={16} /></button>
            </form>
          )}

          {authMode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="bg-[#9cd33b]/10 border border-[#9cd33b]/30 p-4 rounded-2xl mb-6">
                <p className="text-xs text-[#9cd33b] font-bold text-center">Account verified for <span className="font-black">{resetUserDoc?.username}</span>.</p>
              </div>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="New Password" className="w-full bg-slate-950 border border-slate-800 p-4 pr-12 rounded-2xl text-sm text-slate-200 outline-none focus:border-[#9cd33b] transition-colors" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#9cd33b] transition-colors focus:outline-none">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <button type="submit" className="w-full py-4 mt-8 px-6 rounded-2xl bg-gradient-to-r from-[#9cd33b] to-[#8ac22a] text-[#020617] font-black uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(156,211,59,0.3)] transition-all flex justify-center items-center gap-3">Update Password <ArrowRight size={16} /></button>
            </form>
          )}

          {authMode === 'login' && (
            <div className="flex flex-col gap-4 text-center pt-8 border-t border-slate-800 mt-8">
              <button type="button" onClick={() => setAuthMode('forgot')} className="text-[10px] text-blue-400 hover:text-blue-300 uppercase font-black tracking-widest transition-colors">Forgot Password?</button>
              <button type="button" onClick={() => setAuthMode('create-company')} className="text-[10px] text-[#9cd33b] hover:text-[#b5e86a] uppercase font-black tracking-widest transition-colors">Start Free Trial — Create Company</button>
              <button type="button" onClick={() => setAuthMode('register')} className="text-[10px] text-slate-400 hover:text-slate-200 uppercase font-black tracking-widest transition-colors">Pilot or Dispatcher? Join a Team</button>
            </div>
          )}
          {(authMode === 'register' || authMode === 'create-company' || authMode === 'forgot' || authMode === 'reset') && (
            <div className="flex flex-col gap-3 text-center pt-8 border-t border-slate-800 mt-8">
              <button type="button" onClick={() => { setAuthMode('login'); setResetUserDoc(null); }} className="text-[10px] text-slate-400 hover:text-slate-200 uppercase font-black tracking-widest transition-colors">
                {authMode === 'reset' ? 'Cancel' : 'Already have access? Login Here'}
              </button>
              {authMode === 'register' && (
                <button type="button" onClick={() => setAuthMode('create-company')} className="text-[10px] text-[#9cd33b] hover:text-[#b5e86a] uppercase font-black tracking-widest transition-colors">Manager? Create a Company Instead</button>
              )}
              {authMode === 'create-company' && (
                <button type="button" onClick={() => setAuthMode('register')} className="text-[10px] text-slate-400 hover:text-slate-200 uppercase font-black tracking-widest transition-colors">Pilot / Dispatcher? Join a Team</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPortal;
