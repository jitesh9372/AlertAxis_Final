import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'motion/react';
import { Shield, MapPin, Navigation, ArrowLeft, Loader2, Camera, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadFile } from '../lib/storage';

// Component to programmatically change map center
function MapController({ center }: { center: { lat: number, lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center, map]);
  
  // Also handle resize for layout shifts
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

interface LiveMapProps {
  activeAlertId: string | null;
  location: { lat: number; lng: number } | null;
}

export default function LiveMap({ activeAlertId, location }: LiveMapProps) {
  const navigate = useNavigate();
  const [center, setCenter] = useState(location || { lat: 20.5937, lng: 78.9629 }); // Default to India center
  const [userLocation, setUserLocation] = useState<any>(location);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  useEffect(() => {
    // Get initial position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(loc);
          setUserLocation(loc);
        },
        (err) => {
          console.error(`Geolocation error: ${err.message}`);
        }
      );
    }

    // Subscribe to active alerts
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from('users_detail')
        .select('*')
        .eq('feature_type', 'alert')
        .eq('status', 'active');
      
      if (data) {
        const parsedAlerts = data.map(alert => {
          const locMatch = alert.location?.match(/\(([^,]+),\s*([^)]+)\)/);
          if (locMatch) {
            return {
              ...alert,
              lat: parseFloat(locMatch[1]),
              lng: parseFloat(locMatch[2])
            };
          }
          return null;
        }).filter(Boolean);
        setActiveAlerts(parsedAlerts);
      }
    };

    fetchAlerts();

    const subscription = supabase
      .channel('live-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users_detail' }, fetchAlerts)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSaveSnapshot = async () => {
    if (!userLocation) return;
    
    setIsSavingSnapshot(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const snapshotData = {
        timestamp: new Date().toISOString(),
        location: userLocation,
        userAgent: navigator.userAgent,
        accuracy: "high"
      };

      const blob = new Blob([JSON.stringify(snapshotData, null, 2)], { type: 'application/json' });
      
      await uploadFile({
        featureName: 'location-snapshots',
        itemId: 'snapshot-' + Date.now(),
        file: blob,
        userId: user.id
      });

      setSnapshotSuccess(true);
      setTimeout(() => setSnapshotSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save snapshot:", err);
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  return (
    <div className="h-[100dvh] pt-16 pb-16 md:pb-0 bg-slate-950 flex flex-col safe-area-bottom">
      {/* Header */}
      <div className="h-auto min-h-[5rem] py-4 flex-shrink-0 bg-slate-900/50 backdrop-blur-xl border-b border-white/5 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 gap-4 z-10">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">Live Mapping</h1>
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest font-bold">Emergency monitoring</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
          <button 
            onClick={handleSaveSnapshot}
            disabled={isSavingSnapshot || !userLocation}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 transition-all disabled:opacity-50 text-sm"
          >
            {isSavingSnapshot ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : snapshotSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span className="hidden xs:inline">{snapshotSuccess ? "Saved" : "Snapshot"}</span>
            <span className="xs:hidden">{snapshotSuccess ? "Saved" : "Snap"}</span>
          </button>

          <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full flex items-center gap-2 shrink-0">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[10px] sm:text-xs font-bold text-red-500">{activeAlerts.length} Active</span>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1 z-0 w-full">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={13}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', zIndex: 0 }}
        >
          <MapController center={center} />
          
          {/* Bright and highly visible modern map styling */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            className="map-tiles-dark-blue"
          />

          {/* User Location Marker */}
          {userLocation && (
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#3b82f6',
                fillOpacity: 1,
                weight: 2
              }}
            >
              <Popup className="rounded-xl">
                <div className="p-1 font-sans">
                  <h3 className="font-bold text-slate-800 text-sm">Your Location</h3>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* Active Alert Markers */}
          {activeAlerts.map((alert) => (
            <CircleMarker
              key={alert.id}
              center={[alert.lat, alert.lng]}
              radius={10}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.8,
                weight: 2,
                className: 'animate-pulse'
              }}
            >
               <Popup className="rounded-xl font-sans">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-slate-800 text-sm">{alert.name || 'Anonymous User'}</h3>
                  <p className="text-xs text-slate-600 mt-1 mb-2 leading-relaxed">{alert.message}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-black text-red-500 bg-red-50 px-2 py-1 rounded">
                      SOS Active
                    </span>
                    <button 
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                      onClick={() => setCenter({ lat: alert.lat, lng: alert.lng })}
                    >
                      Focus
                    </button>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Floating Controls */}
        <div className="absolute bottom-4 sm:bottom-8 right-4 sm:right-8 flex flex-col gap-3 sm:gap-4 z-10">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (userLocation) setCenter(userLocation);
            }}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-2xl shadow-2xl flex items-center justify-center text-slate-900 hover:bg-slate-50 transition-colors"
          >
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
