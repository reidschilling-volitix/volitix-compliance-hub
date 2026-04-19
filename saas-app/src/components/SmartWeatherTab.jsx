import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Cloud, Navigation, Thermometer, Wind, Droplets, AlertTriangle } from 'lucide-react';
import { Button, Card, Input, tw } from './ui/components';

const getDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const SmartWeatherTab = ({ workOrders, notify }) => {
  const [targetDate, setTargetDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [routeData, setRouteData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const dayJobs = useMemo(() => {
    return workOrders.filter((w) => w.date === targetDate && w.status === 'Scheduled' && w.finalLat);
  }, [workOrders, targetDate]);

  const [orderedJobs, setOrderedJobs] = useState([]);

  useEffect(() => {
    setOrderedJobs(dayJobs);
    setRouteData([]);
  }, [dayJobs]);

  const moveJob = (index, direction) => {
    const next = [...orderedJobs];
    if (direction === 'up' && index > 0) {
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
    } else if (direction === 'down' && index < next.length - 1) {
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
    }
    setOrderedJobs(next);
    setRouteData([]);
  };

  const updateJobHours = (id, field, value) => {
    setOrderedJobs((jobs) => jobs.map((j) => (j.id === id ? { ...j, [field]: value } : j)));
    setRouteData([]);
  };

  const calculateRouteWeather = async () => {
    if (orderedJobs.length === 0) {
      notify('No mapped jobs scheduled for this date.', 'error');
      return;
    }
    setIsLoading(true);
    notify('Pinging weather satellites for route...', 'info');

    try {
      const newRouteData = [];
      const startDt = new Date();
      const [hours, minutes] = startTime.split(':');
      startDt.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

      let currentMinTime = startDt.getTime();
      let currentMaxTime = startDt.getTime();

      for (let i = 0; i < orderedJobs.length; i++) {
        const job = orderedJobs[i];
        const lat = parseFloat(job.finalLat) || 39.82;
        const lon = parseFloat(job.finalLon) || -98.57;

        let transitData = null;
        if (i > 0) {
          const prevJob = orderedJobs[i - 1];
          const pLat = parseFloat(prevJob.finalLat) || 39.82;
          const pLon = parseFloat(prevJob.finalLon) || -98.57;
          const distMiles = getDistanceMiles(pLat, pLon, lat, lon);
          const driveHours = distMiles / 45;
          const transitHours = driveHours + 0.25;

          currentMinTime += transitHours * 60 * 60 * 1000;
          currentMaxTime += transitHours * 60 * 60 * 1000;
          transitData = { miles: distMiles.toFixed(1), driveMins: Math.round(driveHours * 60) };
        }

        const avgEtaTime = (currentMinTime + currentMaxTime) / 2;
        const avgDt = new Date(avgEtaTime);
        const etaHour = avgDt.getHours();

        const minEtaStr = new Date(currentMinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const maxEtaStr = new Date(currentMaxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const etaString = i === 0 ? minEtaStr : `${minEtaStr} - ${maxEtaStr}`;

        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${targetDate}&end_date=${targetDate}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
        );
        const data = await res.json();

        if (data.hourly && data.hourly.temperature_2m[etaHour] !== undefined) {
          const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
          let wd = data.hourly.wind_direction_10m[etaHour];
          const dirIdx = Math.round(((wd %= 360) < 0 ? wd + 360 : wd) / 45) % 8;

          newRouteData.push({
            job,
            eta: etaString,
            temp: data.hourly.temperature_2m[etaHour],
            humidity: data.hourly.relative_humidity_2m[etaHour],
            windSpeed: data.hourly.wind_speed_10m[etaHour],
            windDir: dirs[dirIdx],
            transit: transitData,
          });
        } else {
          newRouteData.push({ job, eta: etaString, transit: transitData, error: 'Forecast unavailable for this hour' });
        }

        const minHrs = parseFloat(job.estHoursMin) || 1;
        const maxHrs = parseFloat(job.estHoursMax) || 1.5;
        currentMinTime += minHrs * 60 * 60 * 1000;
        currentMaxTime += maxHrs * 60 * 60 * 1000;
      }

      setRouteData(newRouteData);
      notify('Smart Route & Weather Generated', 'success');
    } catch (err) {
      notify('Failed to fetch route weather data.', 'error');
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-8 animate-fade-in min-w-0">
      <Card className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 !p-6 border-[#9cd33b]/20">
        <div className="flex items-center gap-5 min-w-0 flex-1">
          <div className="p-4 bg-gradient-to-br from-[#9cd33b]/20 to-[#9cd33b]/5 border border-[#9cd33b]/30 rounded-[1.5rem] text-[#9cd33b] shrink-0 shadow-[0_0_15px_rgba(156,211,59,0.15)]">
            <Cloud size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400 truncate">Smart Weather Routing</h2>
            <p className="text-[10px] text-[#9cd33b] font-black uppercase tracking-widest mt-1 truncate">Predictive Environmental Analysis</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <Input label="Target Date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <Input label="Daily Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Button onClick={calculateRouteWeather} disabled={isLoading || orderedJobs.length === 0} className="w-full h-[54px]">
            {isLoading ? 'Pinging Satellites...' : 'Generate Route Forecast'}
          </Button>
        </div>

        {orderedJobs.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-3xl text-slate-500 font-bold uppercase tracking-widest text-[10px]">
            No scheduled mapped jobs found for {targetDate}.
          </div>
        ) : routeData.length === 0 ? (
          <div className="space-y-4 mt-8">
            <h3 className="text-[#9cd33b] font-black uppercase text-[10px] tracking-widest border-b border-slate-800 pb-2">Set Job Sequence & Estimates</h3>
            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-2 space-y-2">
              {orderedJobs.map((job, i) => (
                <div key={job.id} className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="bg-[#9cd33b]/10 text-[#9cd33b] w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0">{i + 1}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-200 uppercase truncate">{job.title || job.customer}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">{job.acres} AC | {job.chemical}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center shrink-0 border-t border-slate-800 md:border-0 pt-3 md:pt-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Min"
                        className={`${tw.input} w-14 p-2 text-center`}
                        value={job.estHoursMin || ''}
                        onChange={(e) => updateJobHours(job.id, 'estHoursMin', e.target.value)}
                        title="Min Hours"
                      />
                      <span className="text-slate-600">-</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="Max"
                        className={`${tw.input} w-14 p-2 text-center`}
                        value={job.estHoursMax || ''}
                        onChange={(e) => updateJobHours(job.id, 'estHoursMax', e.target.value)}
                        title="Max Hours"
                      />
                      <span className="text-[9px] text-slate-500 font-black mr-4 uppercase">Hrs</span>
                    </div>
                    <div className="flex flex-col gap-1 border-l border-slate-800 pl-4">
                      <button onClick={() => moveJob(i, 'up')} disabled={i === 0} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors" type="button">
                        <ArrowUp size={14} />
                      </button>
                      <button onClick={() => moveJob(i, 'down')} disabled={i === orderedJobs.length - 1} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 transition-colors" type="button">
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2 mt-8 relative">
            <div className="absolute left-[4.5rem] top-8 bottom-8 w-0.5 bg-slate-800/50 hidden md:block"></div>
            <h3 className="text-[#9cd33b] font-black uppercase text-[10px] tracking-widest border-b border-slate-800 pb-2 mb-6">Forecasted Timeline</h3>

            {routeData.map((rd, i) => {
              const isHighWind = rd.windSpeed > 10;
              const isHot = rd.temp > 85;

              return (
                <div key={`${rd.job.id}-${i}`}>
                  {rd.transit && (
                    <div className="flex flex-col md:flex-row gap-6 relative z-10 my-2 md:my-4 opacity-80">
                      <div className="md:w-36 shrink-0 flex justify-center">
                        <div className="h-8 w-0.5 border-l-2 border-dashed border-slate-700 hidden md:block"></div>
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div className="h-px w-8 bg-slate-700 hidden md:block"></div>
                        <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-full text-[9px] font-black uppercase flex items-center gap-2 shadow-sm text-slate-400">
                          <Navigation size={12} className="text-blue-400" />
                          Drive: {rd.transit.miles} mi (~{rd.transit.driveMins} mins)
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-6 relative z-10">
                    <div className="md:w-36 shrink-0 flex flex-row md:flex-col items-center md:items-start gap-3">
                      <div className="bg-slate-900 border border-[#9cd33b]/50 text-[#9cd33b] px-4 py-2 rounded-xl font-black text-xs shadow-lg shadow-[#9cd33b]/10 w-full text-center">
                        {rd.eta}
                      </div>
                    </div>

                    <div className="flex-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-[2rem] p-6 shadow-xl flex flex-col md:flex-row md:items-center gap-6">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-black uppercase text-slate-100 truncate">{rd.job.title || rd.job.customer}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">{rd.job.customer} | {rd.job.acres} AC</p>
                      </div>

                      {rd.error ? (
                        <div className="text-red-500 text-xs font-black uppercase flex items-center gap-2 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20"><AlertTriangle size={14} /> {rd.error}</div>
                      ) : (
                        <div className="flex flex-wrap gap-3 shrink-0">
                          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black border ${isHot ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-slate-950 text-slate-300 border-slate-800'}`}>
                            <Thermometer size={14} className={isHot ? 'text-red-500' : 'text-amber-500'} /> {rd.temp}degF
                          </div>
                          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black border ${isHighWind ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-slate-950 text-slate-300 border-slate-800'}`}>
                            <Wind size={14} className={isHighWind ? 'text-red-500' : 'text-blue-400'} /> {rd.windSpeed} mph {rd.windDir}
                          </div>
                          <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-black bg-slate-950 border border-slate-800 text-slate-300">
                            <Droplets size={14} className="text-blue-400" /> {rd.humidity}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SmartWeatherTab;
