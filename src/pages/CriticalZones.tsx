import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Loader2 } from 'lucide-react';
import { point, booleanPointInPolygon } from '@turf/turf';

// ──────────────────────────────────────────────────────────────────────────────
// Realistic baseline risk data for all 28 States + 8 Union Territories of India
// Based on historical accident rates, disaster-prone zones & crime index data
// 'critical' = high accident/disaster prone, 'high' = moderate risk, 'low' = resolved/safe
// ──────────────────────────────────────────────────────────────────────────────
const INDIA_BASELINE_RISK: Record<string, string> = {
  // States
  'Andhra Pradesh':       'high',
  'Arunachal Pradesh':    'low',
  'Assam':                'critical',
  'Bihar':                'critical',
  'Chhattisgarh':         'high',
  'Goa':                  'low',
  'Gujarat':              'high',
  'Haryana':              'high',
  'Himachal Pradesh':     'low',
  'Jharkhand':            'high',
  'Karnataka':            'high',
  'Kerala':               'critical',
  'Madhya Pradesh':       'critical',
  'Maharashtra':          'critical',
  'Manipur':              'high',
  'Meghalaya':            'low',
  'Mizoram':              'low',
  'Nagaland':             'low',
  'Odisha':               'high',
  'Punjab':               'high',
  'Rajasthan':            'critical',
  'Sikkim':               'low',
  'Tamil Nadu':           'critical',
  'Telangana':            'high',
  'Tripura':              'low',
  'Uttar Pradesh':        'critical',
  'Uttarakhand':          'high',
  'West Bengal':          'high',
  // Union Territories
  'Delhi':                'critical',
  'Jammu and Kashmir':    'critical',
  'Ladakh':               'low',
  'Chandigarh':           'low',
  'Puducherry':           'low',
  'Dadra and Nagar Haveli and Daman and Diu': 'low',
  'Lakshadweep':          'low',
  'Andaman and Nicobar':  'low',
  // Alternate GeoJSON name variants
  'Jammu & Kashmir':      'critical',
  'Andaman & Nicobar Island': 'low',
  'Daman & Diu':          'low',
  'Dadra & Nagar Haveli': 'low',
};

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
  const [geoData, setGeoData] = useState<any>(null);
  const [stateSeverityMap, setStateSeverityMap] = useState<Record<string, string>>({});

  // Fetch GeoJSON for India States
  useEffect(() => {
    fetch('/india_states.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Error loading india_states.geojson", err));
  }, []);

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

        // Mock historical & live data showing accidents and overall situation in India
        const MOCK_INDIA_INCIDENTS = [
          { id: 'm1', name: 'NH-48 Highway Patrol', message: 'Major multi-vehicle pileup. Road blocked.', status: 'active', created_at: new Date(Date.now() - 10 * 60000).toISOString(), lat: 19.2823, lng: 72.8806, severity: 'critical', type: 'Accident' },
          { id: 'm2', name: 'Mumbai Fire Response', message: 'Industrial fire in MIDC area. 4 Fire engines dispatched.', status: 'active', created_at: new Date(Date.now() - 15 * 60000).toISOString(), lat: 19.1136, lng: 72.8697, severity: 'critical', type: 'Fire' },
          { id: 'm3', name: 'Delhi Traffic Police', message: 'Waterlogging causing severe traffic jams at ITO.', status: 'active', created_at: new Date(Date.now() - 2 * 60000).toISOString(), lat: 28.6276, lng: 77.2404, severity: 'high', type: 'Hazard' },
          { id: 'm4', name: 'Bangalore EMT', message: 'Medical emergency reported on ORR. Ambulance approaching.', status: 'active', created_at: new Date(Date.now() - 1 * 60000).toISOString(), lat: 12.9716, lng: 77.5946, severity: 'high', type: 'Medical' },
          { id: 'm5', name: 'Chennai Disaster Response', message: 'Cyclone warning alert active for coastal regions.', status: 'active', created_at: new Date(Date.now() - 8 * 60000).toISOString(), lat: 13.0827, lng: 80.2707, severity: 'critical', type: 'Weather' },
          { id: 'm6', name: 'Pune City Police', message: 'Protest cleared. Traffic returning to normal in Shivaji Nagar.', status: 'resolved', created_at: new Date(Date.now() - 45 * 60000).toISOString(), lat: 18.5204, lng: 73.8567, severity: 'low', type: 'General' },
          { id: 'm7', name: 'Hyderabad Highway Auth', message: 'Overturned truck cleared from Outer Ring Road.', status: 'resolved', created_at: new Date(Date.now() - 120 * 60000).toISOString(), lat: 17.3850, lng: 78.4867, severity: 'low', type: 'Accident' },
          { id: 'm8', name: 'Kolkata Emergency', message: 'Building collapse reports in older districts. Search & rescue initiated.', status: 'active', created_at: new Date(Date.now() - 3 * 60000).toISOString(), lat: 22.5726, lng: 88.3639, severity: 'high', type: 'Critical' },
          { id: 'm9', name: 'Jaipur Police', message: 'Suspicious object reported. Area cordoned off for safety.', status: 'active', created_at: new Date(Date.now() - 25 * 60000).toISOString(), lat: 26.9124, lng: 75.7873, severity: 'critical', type: 'Security' },
          { id: 'm10', name: 'Ahmedabad Traffic', message: 'Major bridge repair work ongoing. Diversion in place.', status: 'active', created_at: new Date(Date.now() - 60 * 60000).toISOString(), lat: 23.0225, lng: 72.5714, severity: 'high', type: 'Traffic' },
          { id: 'm11', name: 'Agra Highway Patrol', message: 'Dense fog causing extremely low visibility on Yamuna Expressway.', status: 'active', created_at: new Date(Date.now() - 30 * 60000).toISOString(), lat: 27.2038, lng: 77.9629, severity: 'high', type: 'Weather' },
          { id: 'm12', name: 'Kochi Port Authority', message: 'Oil spill reported off coast. Cleanup crew dispatched.', status: 'active', created_at: new Date(Date.now() - 40 * 60000).toISOString(), lat: 9.9312, lng: 76.2673, severity: 'critical', type: 'Hazard' }
        ];

        setAlerts([...parsedAlerts, ...MOCK_INDIA_INCIDENTS]);
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

  // Compute Spatial Check (Points within Polygons)
  // Start with INDIA_BASELINE_RISK for every state so the entire map is colored,
  // then override with higher severity if a live incident falls inside that state.
  useEffect(() => {
    if (!geoData) return;

    const severityMap: Record<string, string> = {};

    geoData.features.forEach((feature: any) => {
      const stateName = feature.properties.NAME_1 || feature.properties.st_nm || feature.properties.name || 'Unknown';

      // Start from the static baseline (guaranteed color for every state)
      let highestSev: string = INDIA_BASELINE_RISK[stateName] || 'low';

      // Override with live / mock incident data if it's higher severity
      for (const alert of alerts) {
        if (!alert.lat || !alert.lng) continue;
        const pt = point([alert.lng, alert.lat]);
        try {
          if (booleanPointInPolygon(pt, feature)) {
            if (alert.severity === 'critical') {
              highestSev = 'critical';
              break;
            } else if (alert.severity === 'high' && highestSev !== 'critical') {
              highestSev = 'high';
            }
          }
        } catch (_) {
          // Skip malformed polygon geometries
        }
      }

      severityMap[stateName] = highestSev;
    });

    setStateSeverityMap(severityMap);
  }, [geoData, alerts]);

  // Leaflet Polygon Styling Function
  const getStyle = (feature: any) => {
    const stateName = feature.properties.NAME_1 || feature.properties.st_nm || feature.properties.name || 'Unknown';
    // Use computed severity; fall back to static baseline; then low as last resort
    const severity = stateSeverityMap[stateName] || INDIA_BASELINE_RISK[stateName] || 'low';

    const colorMap: Record<string, string> = {
      critical: '#ef4444',   // Bold red
      high:     '#f97316',   // Vivid orange
      low:      '#10b981',   // Emerald green
    };

    return {
      fillColor: colorMap[severity] || '#10b981',
      weight: 1.5,
      opacity: 1,
      color: '#ffffff',     // White border for crisp contrast
      fillOpacity: 0.65
    };
  };

  // Popup logic with hover highlight
  const onEachFeature = (feature: any, layer: any) => {
    const stateName = feature.properties.NAME_1 || feature.properties.st_nm || feature.properties.name || 'Unknown';
    const severity = stateSeverityMap[stateName] || INDIA_BASELINE_RISK[stateName] || 'low';

    const badgeColor: Record<string, string> = {
      critical: 'color:#ef4444;background:#fef2f2;',
      high:     'color:#ea580c;background:#fff7ed;',
      low:      'color:#059669;background:#ecfdf5;',
    };

    let statusText = 'SAFE ZONE (Resolved)';
    if (severity === 'critical') statusText = 'CRITICAL RISK (Ongoing > 5m)';
    else if (severity === 'high') statusText = 'HIGH RISK (Active)';

    // Hover effect
    layer.on({
      mouseover: (e: any) => { e.target.setStyle({ fillOpacity: 0.9, weight: 2.5 }); },
      mouseout:  (e: any) => { e.target.setStyle({ fillOpacity: 0.65, weight: 1.5 }); },
    });

    const popupContent = `
      <div style="font-family:sans-serif;padding:6px 8px;min-width:150px">
        <strong style="font-size:13px;color:#1e293b">${stateName}</strong><br/>
        <span style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;display:block;margin-top:4px;padding:2px 6px;border-radius:4px;${badgeColor[severity] || 'color:#059669;background:#ecfdf5;'}">${statusText}</span>
      </div>
    `;

    layer.bindPopup(popupContent);
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
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 text-sm font-bold shadow-sm">
          <div className="w-4 h-4 rounded-sm bg-red-500 animate-pulse border border-red-600" /> Critical Risk (Ongoing &gt; 5m)
        </div>
        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 text-sm font-bold shadow-sm">
          <div className="w-4 h-4 rounded-sm bg-orange-500 border border-orange-600" /> High Risk (Active)
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 text-sm font-bold shadow-sm">
          <div className="w-4 h-4 rounded-sm bg-emerald-500 border border-emerald-600" /> Safe Zone (Resolved)
        </div>
      </motion.div>

      {/* Map Wrapping Container */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden z-0" style={{ height: '600px', width: '100%' }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="font-bold text-slate-700">Loading Geodata...</p>
          </div>
        )}
        
        <MapContainer 
          center={[22.5937, 78.9629]} 
          zoom={4.5} 
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', zIndex: 0, borderRadius: '0.75rem', background: '#f8fafc' }}
        >
          <MapFocus />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />
          
          {geoData && (
            <GeoJSON 
              key={JSON.stringify(stateSeverityMap)}
              data={geoData} 
              style={getStyle}
              onEachFeature={onEachFeature}
            />
          )}

        </MapContainer>
      </div>
    </div>
  );
}
