import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { ShieldAlert, AlertTriangle, CheckCircle, Activity, Globe, Loader2 } from 'lucide-react';

export default function RiskAnalytics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    resolved: 0,
    criticalRisk: 0,
    highRisk: 0,
    lowRisk: 0
  });

  const [trendData, setTrendData] = useState<any[]>([]);
  const [riskData, setRiskData] = useState<any[]>([]);

  useEffect(() => {
    fetchEmergencyData();
  }, []);

  const fetchEmergencyData = async () => {
    setLoading(true);
    try {
      // Fetch all core alerts
      const { data: alerts, error } = await supabase
        .from('users_detail')
        .select('*')
        .eq('feature_type', 'alert')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Grouping and calculations
      let activeCount = 0;
      let resolvedCount = 0;
      let criticalCount = 0;
      let highCount = 0;
      let lowCount = 0;

      const dateMap: { [key: string]: number } = {};

      (alerts || []).forEach(alert => {
        const isResolved = alert.status === 'resolved';
        
        if (isResolved) {
          resolvedCount++;
          lowCount++; // Resolved is low risk
        } else {
          activeCount++;
          // Basic heuristic for demo: if it has been active for more than 5 minutes, it's critical
          const ageInMinutes = (new Date().getTime() - new Date(alert.created_at).getTime()) / 60000;
          if (ageInMinutes > 5) {
            criticalCount++;
          } else {
            highCount++;
          }
        }

        // Group by Date for trend
        const dateStr = new Date(alert.created_at).toLocaleDateString();
        dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
      });

      setMetrics({
        total: (alerts || []).length,
        active: activeCount,
        resolved: resolvedCount,
        criticalRisk: criticalCount,
        highRisk: highCount,
        lowRisk: lowCount
      });

      // Prepare trend data (last 7 days usually)
      const formattedTrend = Object.keys(dateMap).map(date => ({
        date,
        incidents: dateMap[date]
      })).slice(0, 10).reverse(); // Last 10 distinct dates

      setTrendData(formattedTrend);

      setRiskData([
        { name: 'Critical Risk', value: criticalCount, color: '#ef4444' },
        { name: 'High Risk', value: highCount, color: '#f97316' },
        { name: 'Low Risk / Resolved', value: lowCount, color: '#10b981' },
      ]);

    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#ef4444', '#f97316', '#10b981'];

  return (
    <div className="pt-24 px-4 pb-12 w-full max-w-7xl mx-auto min-h-screen">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col gap-2"
      >
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          Risk Analytics
        </h1>
        <p className="text-slate-500 font-medium max-w-xl">
          Global, real-time telemetry monitoring for pending and resolved SOS emergency cases.
        </p>
      </motion.div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
              title="Total Incidents" 
              value={metrics.total} 
              icon={<Globe className="w-5 h-5" />} 
              color="bg-slate-100 text-slate-800" 
            />
            <MetricCard 
              title="Active Pending Cases" 
              value={metrics.active} 
              icon={<AlertTriangle className="w-5 h-5" />} 
              color="bg-orange-50 text-orange-600 border border-orange-200" 
            />
            <MetricCard 
              title="Resolved Cases" 
              value={metrics.resolved} 
              icon={<CheckCircle className="w-5 h-5" />} 
              color="bg-emerald-50 text-emerald-600 border border-emerald-200" 
            />
            <MetricCard 
              title="Critical Risk Alerts" 
              value={metrics.criticalRisk} 
              icon={<ShieldAlert className="w-5 h-5" />} 
              color="bg-red-50 text-red-600 border border-red-200" 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Trend Line Chart */}
            <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-6 font-display">Incident Frequency Trend</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      axisLine={false} 
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      axisLine={false} 
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="incidents" 
                      stroke="#ef4444" 
                      strokeWidth={4}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 8, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk Distribution Donut Chart */}
            <div className="col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative flex flex-col">
              <h3 className="text-lg font-bold text-slate-800 mb-2 font-display">Risk Levels Matrix</h3>
              <p className="text-xs text-slate-500 mb-6">Proportion of incidents by determined risk</p>
              
              <div className="flex-1 min-h-[250px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          {/* Active Emergencies Table Snippet */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mt-6">
             <h3 className="text-lg font-bold text-slate-800 mb-4 font-display flex items-center justify-between">
                Live Pending Alerts
                <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse">LIVE</span>
             </h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                   <thead className="bg-slate-50 text-slate-800 text-xs uppercase font-bold">
                     <tr>
                       <th className="px-4 py-3 rounded-tl-xl">Target User</th>
                       <th className="px-4 py-3">Location</th>
                       <th className="px-4 py-3">Duration Active</th>
                       <th className="px-4 py-3 rounded-tr-xl">Risk Level</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {metrics.active === 0 ? (
                        <tr>
                           <td colSpan={4} className="px-4 py-8 text-center text-slate-400 font-medium">No pending alerts currently active.</td>
                        </tr>
                     ) : (
                        <tr className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-3 font-semibold text-slate-800">Available live in Prod Database</td>
                           <td className="px-4 py-3 font-mono text-xs">Lat/Lng Data</td>
                           <td className="px-4 py-3">Current</td>
                           <td className="px-4 py-3"><span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-bold">CRITICAL</span></td>
                        </tr>
                     )}
                   </tbody>
                </table>
             </div>
          </div>

        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      className={`rounded-2xl p-6 ${color} shadow-sm border border-transparent flex flex-col justify-between`}
    >
      <div className="flex justify-between items-start mb-4">
        <h4 className="font-semibold text-sm opacity-80">{title}</h4>
        <div className="p-2 bg-white/40 rounded-lg">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-4xl font-black tracking-tight">{value}</div>
      </div>
    </motion.div>
  );
}
