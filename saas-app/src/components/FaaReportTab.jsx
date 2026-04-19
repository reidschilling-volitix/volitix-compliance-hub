import { useMemo, useState } from 'react';
import { FileText, Printer, Navigation, Mail, ShieldCheck, History, Eye, Trash2 } from 'lucide-react';
import { Button, Card, Input } from './ui/components';

const FaaReportTab = ({ company, fleet, certifications, reportMonth, setReportMonth, showFormalReport, setShowFormalReport, notify, logs, workOrders, faaReports = [], setFaaReports, onDelete }) => {
  const [reportSent, setReportSent] = useState(false);

  const monthlyLogs = useMemo(() => {
    if (!reportMonth) return [];
    return logs.filter((log) => String(log.date || '').startsWith(reportMonth));
  }, [logs, reportMonth]);

  const reportData = useMemo(() => {
    const activeJobs = workOrders.filter((job) => job.isScheduled && job.status === 'Scheduled');
    return {
      totalFlights: monthlyLogs.length || activeJobs.length,
      totalHours: monthlyLogs.length
        ? monthlyLogs.reduce((sum, log) => {
            const mins = parseFloat(log.flightTimeMinutes || 0);
            if (!isNaN(mins) && mins > 0) return sum + mins / 60;
            const v = parseFloat(log.flightTimeValue || 0);
            if (isNaN(v)) return sum;
            return sum + (log.flightTimeUnit === 'Minutes' ? v / 60 : v);
          }, 0)
        : activeJobs.reduce((sum, job) => sum + Number(job.estHoursMax || 1), 0),
      logEntries: monthlyLogs.length,
      fleetCount: fleet.length
    };
  }, [workOrders, fleet, monthlyLogs]);

  const getDaysInMonth = (yyyyMonth) => {
    if (!yyyyMonth) return '';
    const [y, m] = yyyyMonth.split('-');
    const lastDay = new Date(y, m, 0).getDate();
    return `${m}/01/${y} - ${m}/${lastDay}/${y}`;
  };

  const stateCert = certifications?.find((c) => c.name === 'State Pesticide');
  const stateCertNo = stateCert ? stateCert.licenseNumber : (company.certNo || 'N/A');
  const exemptionCert = certifications?.find((c) => c.name === 'FAA 44807');
  const exemptionNo = exemptionCert ? exemptionCert.licenseNumber : (company.exemption || 'N/A');
  const part137Cert = certifications?.find((c) => c.name === 'FAA Part 137' || c.name === 'FAA Part 107');
  const part137No = part137Cert ? part137Cert.licenseNumber : (company.certNo || 'N/A');

  const emailAddress = '9-AVS-FS-AFS-700-Correspondence@faa.gov';
  const emailSubject = `FAA Monthly Report: ${company.name} - ${reportMonth}`;
  const emailBody = `To whom it may concern,\n\nPlease find attached the monthly flight operations report for ${company.name} (Exemption #${exemptionNo}) for the period of ${reportMonth}.\n\nOfficial Company Email: ${company.email || 'N/A'}\n\nThank you,\n${company.supervisor}`;
  const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${emailAddress}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  const handlePrint = async () => {
    const element = document.getElementById('faa-report-content');
    if (!element) return;

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;
      const opt = {
        margin: 0.5,
        filename: `FAA_Report_${company.name}_${reportMonth}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      };
      await html2pdf().set(opt).from(element).save();
      notify('FAA report PDF saved.', 'success');
    } catch (err) {
      window.print();
      notify('Falling back to browser print.', 'info');
    }
  };

  const sendFaaReport = () => {
    setReportSent(true);
    setShowFormalReport(true);
    notify('FAA report queued for submission.', 'success');
  };

  const archiveReportToVault = () => {
    if (!reportMonth) {
      notify('Select a report month first.', 'error');
      return;
    }

    const archived = {
      id: `faa-${Date.now()}`,
      month: reportMonth,
      companyName: company.name,
      filedAt: new Date().toISOString()
    };

    if (typeof setFaaReports === 'function') {
      setFaaReports((prev) => [archived, ...prev.filter((r) => r.month !== reportMonth)]);
    }
    notify('Report Saved to Vault.', 'success');
  };

  return (
    <div className="space-y-8 animate-fade-in min-w-0">
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 !p-6 border-[#9cd33b]/20">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <ShieldCheck size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">FAA Reporting</h2>
            <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">Generate monthly compliance summaries</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <Input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="sm:w-auto" />
          <Button onClick={() => setShowFormalReport(!showFormalReport)} className="w-full md:w-auto">
            <FileText size={16} /> {showFormalReport ? 'Close Preview' : 'Generate Report'}
          </Button>
          <Button onClick={sendFaaReport} className="w-full md:w-auto">
            <Navigation size={16} /> Submit Monthly Report
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="space-y-4">
          <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Report Summary</h3>
          <div className="grid gap-4">
            <div className="rounded-3xl p-4 bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Report Month</p>
              <p className="text-2xl font-black text-slate-100 mt-3">{reportMonth || 'N/A'}</p>
            </div>
            <div className="rounded-3xl p-4 bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Active Fleet</p>
              <p className="text-3xl font-black text-slate-100">{reportData.fleetCount}</p>
            </div>
            <div className="rounded-3xl p-4 bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Total Flights</p>
              <p className="text-3xl font-black text-[#9cd33b]">{reportData.totalFlights}</p>
            </div>
            <div className="rounded-3xl p-4 bg-slate-950 border border-slate-800">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Total Logged Events</p>
              <p className="text-3xl font-black text-blue-400">{reportData.logEntries}</p>
            </div>
          </div>
        </Card>

        <Card className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm uppercase tracking-[0.21em] text-[#9cd33b] font-black">Command Compliance</h3>
              <p className="text-[10px] text-slate-500 mt-2">FAA regulatory overview and monthly output.</p>
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-[0.24em] font-black">{company.name}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-3xl p-4 bg-slate-950 border border-slate-800">
              <p className="text-[9px] uppercase tracking-widest text-slate-500">Supervisor</p>
              <p className="mt-3 text-sm font-black text-slate-100">{company.supervisor}</p>
            </div>
            <div className="rounded-3xl p-4 bg-slate-950 border border-slate-800">
              <p className="text-[9px] uppercase tracking-widest text-slate-500">Cert Number</p>
              <p className="mt-3 text-sm font-black text-slate-100">{company.certNo}</p>
            </div>
            <div className="rounded-3xl p-4 bg-slate-950 border border-slate-800">
              <p className="text-[9px] uppercase tracking-widest text-slate-500">FAA Exemption</p>
              <p className="mt-3 text-sm font-black text-slate-100">{company.exemption}</p>
            </div>
          </div>

          {showFormalReport && (
            <div id="faa-report-content" className="bg-white text-black p-8 md:p-12 rounded-[2rem] shadow-2xl space-y-8 font-sans overflow-x-auto print:p-0 print:shadow-none print:border-none print:w-full print:m-0">
              <div data-html2canvas-ignore="true" className="flex flex-col sm:flex-row justify-end items-center gap-3 print:hidden mb-8 border-b border-slate-200 pb-8">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-auto hidden sm:block mt-2">Step 1: Save as PDF. Step 2: Send & Attach.</span>
                <Button onClick={handlePrint} className="bg-slate-800 text-white hover:bg-slate-700 py-3">
                  <Printer size={16} /> Save as PDF
                </Button>
                <a href={mailtoLink} className="px-5 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] no-underline">
                  <Mail size={16} /> Send via Mailto
                </a>
                <a href={gmailLink} target="_blank" rel="noopener noreferrer" className="px-5 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] no-underline">
                  <Navigation size={16} /> Send via Gmail
                </a>
              </div>

              <div className="text-center md:text-left border-b-2 border-black pb-6">
                <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-tight text-black">FAA Monthly Report</h1>
                <p className="text-lg font-medium text-black mt-1">Period: {reportMonth} ({getDaysInMonth(reportMonth)})</p>
              </div>

              <section className="space-y-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-300 pb-1">Certificate Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Company Name</span><span>{company.name || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Chief Supervisor</span><span>{company.supervisor || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Chief Supervisor Email</span><span className="break-all">{company.email || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Pilot in Command</span><span>{company.supervisor || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Pilot in Command Email</span><span className="break-all">{company.email || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Operator's Cert (Part 137/107)</span><span>{part137No}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Operator's State Certificate Number</span><span>{stateCertNo}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">44807 Exemption Number</span><span>{exemptionNo}</span></div>
                </div>
              </section>

              <section className="space-y-4 pt-4">
                <h2 className="text-xl font-bold text-black border-b border-gray-300 pb-1">Pilot Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Pilot Name</span><span>{company.supervisor || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Pilot Email</span><span className="break-all">{company.email || 'N/A'}</span></div>
                  <div className="grid grid-cols-2 border-b border-gray-100 py-2"><span className="font-bold">Applicator's State Certificate Number</span><span>{stateCertNo}</span></div>
                </div>
              </section>

              {fleet.length > 0 ? fleet.map((d, i) => {
                const fLogs = monthlyLogs.filter((l) => (l.selectedAircraft || []).includes(d.id));
                const mins = fLogs.reduce((acc, l) => acc + (parseFloat(l.flightTimeMinutes) || 0), 0);
                return (
                  <section key={i} className="space-y-4 pt-6 break-inside-avoid">
                    <h2 className="text-xl font-bold text-black border-b border-gray-300 pb-1">Information For: {d.model || 'Aircraft'}</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left border-collapse border border-black min-w-[500px]">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-3 border border-black font-bold">Manufacturer/Model</th>
                            <th className="p-3 border border-black font-bold">N Number</th>
                            <th className="p-3 border border-black font-bold">Number of Flights</th>
                            <th className="p-3 border border-black font-bold">Total Aircraft Operational Hours</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="p-3 border border-black">{d.model || 'N/A'}</td>
                            <td className="p-3 border border-black">{d.id || 'N/A'}</td>
                            <td className="p-3 border border-black">{fLogs.length}</td>
                            <td className="p-3 border border-black">{(mins / 60).toFixed(2)} Hours</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              }) : (
                <section className="space-y-4 pt-6">
                  <h2 className="text-xl font-bold text-black border-b border-gray-300 pb-1">Information For: Aircraft</h2>
                  <p className="text-sm italic text-gray-600">No aircraft recorded in fleet.</p>
                </section>
              )}

              <section className="space-y-4 pt-6">
                <h2 className="text-xl font-bold text-black border-b border-gray-300 pb-1">Flight Information</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse border border-black min-w-[1400px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-3 border border-black font-bold">Date</th>
                        <th className="p-3 border border-black font-bold">Aircraft</th>
                        <th className="p-3 border border-black font-bold">PIC</th>
                        <th className="p-3 border border-black font-bold">Type of Application</th>
                        <th className="p-3 border border-black font-bold">Chemical / Product</th>
                        <th className="p-3 border border-black font-bold">App Rate (GPA)</th>
                        <th className="p-3 border border-black font-bold">Treated Acreage</th>
                        <th className="p-3 border border-black font-bold">Flight Duration</th>
                        <th className="p-3 border border-black font-bold">City, State</th>
                        <th className="p-3 border border-black font-bold">Lat, Lon</th>
                        <th className="p-3 border border-black font-bold">Weather (Wind / Temp / Humidity)</th>
                        <th className="p-3 border border-black font-bold">Drift Mitigation</th>
                        <th className="p-3 border border-black font-bold">NOTAM</th>
                        <th className="p-3 border border-black font-bold">Damage / Malfunctions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyLogs.length === 0 ? (
                        <tr><td colSpan="14" className="p-6 text-center italic text-gray-500 border border-black">No flights recorded for this period.</td></tr>
                      ) : (
                        <>
                          {monthlyLogs.map((l) => {
                            const durationMins = parseFloat(l.flightTimeMinutes || 0);
                            const durationDisplay = durationMins > 0
                              ? `${(durationMins / 60).toFixed(2)} hrs`
                              : l.flightTimeValue ? `${l.flightTimeValue} ${l.flightTimeUnit || ''}`.trim() : 'N/A';
                            const weather = [
                              l.windSpeed ? `${l.windSpeed} mph ${l.windDirection || ''}`.trim() : null,
                              l.temp ? `${l.temp}°${l.tempUnit || 'F'}` : null,
                              l.humidity ? `${l.humidity}% RH` : null,
                            ].filter(Boolean).join(' / ') || 'N/A';
                            return (
                              <tr key={l.id}>
                                <td className="p-3 border border-black whitespace-nowrap font-bold">{l.date}</td>
                                <td className="p-3 border border-black">{Array.isArray(l.selectedAircraft) ? l.selectedAircraft.join(', ') : l.selectedAircraft || 'N/A'}</td>
                                <td className="p-3 border border-black">{l.picUsername || company.supervisor || 'N/A'}</td>
                                <td className="p-3 border border-black">Pesticide / Agricultural</td>
                                <td className="p-3 border border-black">{l.chemical || 'N/A'}</td>
                                <td className="p-3 border border-black">{l.appRate || 'N/A'}</td>
                                <td className="p-3 border border-black">{l.treatedAcreage || l.totalAcreage || 'N/A'}</td>
                                <td className="p-3 border border-black">{durationDisplay}</td>
                                <td className="p-3 border border-black">{l.locationName || 'N/A'}</td>
                                <td className="p-3 border border-black font-mono text-xs">{l.coordinates || `${l.finalLat || ''}, ${l.finalLon || ''}` || 'N/A'}</td>
                                <td className="p-3 border border-black text-xs">{weather}</td>
                                <td className="p-3 border border-black text-xs">{l.driftPractices || l.nozzleDesc || 'N/A'}</td>
                                <td className="p-3 border border-black">{l.attachedNotam || 'None'}</td>
                                <td className="p-3 border border-black">{l.incidents && l.incidents !== 'None' ? `${l.incidents}${l.damageDescription ? ': ' + l.damageDescription : ''}` : 'None'}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-gray-100 font-bold">
                            <td className="p-3 border border-black" colSpan="5">Monthly Totals</td>
                            <td className="p-3 border border-black">—</td>
                            <td className="p-3 border border-black">{monthlyLogs.reduce((s, l) => s + (parseFloat(l.treatedAcreage) || parseFloat(l.totalAcreage) || 0), 0).toLocaleString()} ac</td>
                            <td className="p-3 border border-black">{(monthlyLogs.reduce((s, l) => { const m = parseFloat(l.flightTimeMinutes || 0); if (m > 0) return s + m; const v = parseFloat(l.flightTimeValue || 0); return s + (l.flightTimeUnit === 'Minutes' ? v : v * 60); }, 0) / 60).toFixed(2)} hrs</td>
                            <td className="p-3 border border-black" colSpan="6">{monthlyLogs.length} flights</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </Card>
      </div>

      {!showFormalReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="flex flex-col items-center justify-center text-center space-y-6 min-w-0">
            <ShieldCheck size={56} className="text-[#9cd33b] opacity-50 shrink-0" />
            <Button className="w-full py-5 text-sm" onClick={archiveReportToVault}>
              Archive Report to Vault
            </Button>
          </Card>

          <Card>
            <div className="flex items-center gap-3 text-[#9cd33b] font-black uppercase text-xs tracking-widest border-b border-slate-800 pb-6 mb-6">
              <History size={18} className="shrink-0" />
              <span className="truncate">Archived FAA Reports</span>
            </div>
            <div className="bg-slate-950 rounded-[2rem] border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-[11px] min-w-[600px]">
                <thead className="bg-slate-900/50 text-slate-400 uppercase text-[9px] font-black tracking-widest border-b border-slate-800">
                  <tr>
                    <th className="p-5">Report Period</th>
                    <th className="p-5">Archived On</th>
                    <th className="p-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {(!faaReports || faaReports.length === 0) && (
                    <tr>
                      <td colSpan="3" className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                        No reports archived yet.
                      </td>
                    </tr>
                  )}
                  {(faaReports || []).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/20">
                      <td className="p-5 font-black text-slate-200 text-sm">{r.month}</td>
                      <td className="p-5 text-slate-400 font-mono text-[10px]">
                        {new Date(r.filedAt).toLocaleDateString()} at {new Date(r.filedAt).toLocaleTimeString()}
                      </td>
                      <td className="p-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-6">
                          <button
                            onClick={() => { setReportMonth(r.month); setShowFormalReport(true); }}
                            className="text-blue-500 hover:text-blue-400 flex items-center gap-2 font-black uppercase tracking-widest text-[10px]"
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            onClick={() => {
                              if (typeof onDelete === 'function') onDelete('faa_reports', r.id);
                              else if (typeof setFaaReports === 'function') setFaaReports((prev) => prev.filter((item) => item.id !== r.id));
                            }}
                            className="text-red-500 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FaaReportTab;
