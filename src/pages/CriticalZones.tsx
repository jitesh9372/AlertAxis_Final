import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Loader2, AlertTriangle, Info, Clock } from 'lucide-react';

// Component to dynamically resize/fit bounds if we wanted to, but we'll default to India
function MapFocus() {
  const map = useMap();
  useEffect(() => {
    // Force a resize calculation after map mount to ensure tiles load correctly inside grid/flex
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
}

export default function CriticalZones() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users_detail')
          .select('*')
          .eq('feature_type', 'alert')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Parse string "(lat, lng)" to numbers and compute severity
        const parsedAlerts = (data || []).map((alert: any) => {
          let lat = 0, lng = 0;
          if (alert.location && typeof alert.location === 'string') {
            const locMatch = alert.location.match(/\(([^,]+),\s*([^)]+)\)/);
            if (locMatch) {
              lat = parseFloat(locMatch[1]);
              lng = parseFloat(locMatch[2]);
            }
          }

          const ageInMinutes = (new Date().getTime() - new Date(alert.created_at).getTime()) / 60000;
          let severity = 'low';
          
          if (alert.status === 'resolved') {
            severity = 'low';
          } else if (ageInMinutes > 5) {
            severity = 'critical';
          } else {
            severity = 'high';
          }

          return { ...alert, lat, lng, severity };
        }).filter(a => a.lat !== 0 && a.lng !== 0); // Only keep valid coordinates

        setAlerts(parsedAlerts);
      } catch (err) {
        console.error("Error fetching critical zones:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // Subscribe to live DB changes
    const subscription = supabase
      .channel('critical-zone-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users_detail' }, fetchAlerts)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getMarkerOptions = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { color: '#ef4444', fillColor: '#ef4444', radius: 12, className: 'animate-pulse' };
      case 'high':
        return { color: '#f97316', fillColor: '#f97316', radius: 8 };
      case 'low':
      default:
        return { color: '#10b981', fillColor: '#10b981', radius: 5 };
    }
  };

  return (
    <div className="pt-24 px-4 pb-12 w-full max-w-7xl mx-auto min-h-screen flex flex-col">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col gap-2"
      >
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          <MapIcon className="w-8 h-8 text-primary" />
          Critical Zones Map
        </h1>
        <p className="text-slate-500 font-medium max-w-xl">
          Live geographic hotspots visualizing emergency SOS triggers across India.
        </p>
      </motion.div>

      {/* Legend */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-4 mb-4"
      >
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 text-sm font-bold">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /> Critical Risk (Ongoing &gt; 5m)
        </div>
        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 text-sm font-bold">
          <div className="w-3 h-3 rounded-full bg-orange-500" /> High Risk (Active)
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 text-sm font-bold">
          <div className="w-3 h-3 rounded-full bg-emerald-500" /> Safe Zone (Resolved)
        </div>
      </motion.div>

      {/* Map Wrapping Container */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex-1 min-h-[600px] relative overflow-hidden z-0">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="font-bold text-slate-700">Loading Geodata...</p>
          </div>
        )}
        
        <MapContainer 
          center={[20.5937, 78.9629]} 
          zoom={5} 
          scrollWheelZoom={true}
          className="w-full h-full rounded-xl z-0"
        >
          <MapFocus />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {alerts.map((alert) => (
            <CircleMarker
              key={alert.id}
              center={[alert.lat, alert.lng]}
              pathOptions={{
                ...getMarkerOptions(alert.severity),
                fillOpacity: 0.6,
                weight: 2
              }}
            >
              <Popup className="rounded-xl font-sans">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between mb-1">
                    {alert.name || 'Anonymous User'}
                    {alert.severity === 'critical' && <AlertTriangle className="w-4 h-4 text-red-500 inline" />}
                  </h3>
                  <p className="text-xs text-slate-600 mb-2 leading-relaxed">{alert.message}</p>
                  
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded">
                    <Info className="w-3 h-3" />
                    Status: <span className="uppercase font-bold text-slate-700">{alert.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1 px-2">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
