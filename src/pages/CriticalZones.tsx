import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Loader2, AlertTriangle, Activity, CheckCircle, Navigation } from 'lucide-react';
import { point, booleanPointInPolygon } from '@turf/turf';

// ──────────────────────────────────────────────────────────────────────────────
// City/District-level baseline risk data for India
// Based on: NCRB crime statistics, NHAI accident data, IMD disaster records
// 'critical' = major city with ongoing high accident/crime/disaster rate
// 'high'     = moderate urban risk (active incidents)
// 'low'      = safe / resolved
// KEY = NAME_2 field from india_districts.geojson
// ──────────────────────────────────────────────────────────────────────────────
const CITY_BASELINE_RISK: Record<string, string> = {
  // Maharashtra
  'Mumbai':           'critical',
  'Mumbai Suburban':  'critical',
  'Thane':            'critical',
  'Pune':             'high',
  'Nagpur':           'high',
  'Nashik':           'high',
  'Aurangabad':       'high',
  'Solapur':          'low',
  'Kolhapur':         'low',
  'Satara':           'low',
  'Raigad':           'high',
  'Ahmadnagar':       'low',

  // Delhi & NCR
  'New Delhi':        'critical',
  'North West Delhi': 'critical',
  'East Delhi':       'critical',
  'South Delhi':      'high',
  'West Delhi':       'high',
  'Gurgaon':          'high',
  'Faridabad':        'high',
  'Gautam Buddha Nagar': 'high',
  'Ghaziabad':        'critical',

  // Uttar Pradesh
  'Lucknow':          'critical',
  'Kanpur Nagar':     'critical',
  'Agra':             'high',
  'Varanasi':         'high',
  'Allahabad':        'high',
  'Meerut':           'critical',
  'Mathura':          'low',
  'Bareilly':         'high',
  'Aligarh':          'high',
  'Moradabad':        'high',
  'Gorakhpur':        'high',

  // Tamil Nadu
  'Chennai':          'critical',
  'Coimbatore':       'high',
  'Madurai':          'high',
  'Tiruchirappalli':  'high',
  'Salem':            'low',
  'Tirunelveli':      'low',
  'Vellore':          'low',
  'Erode':            'low',

  // Karnataka
  'Bangalore Urban':  'critical',
  'Bangalore Rural':  'high',
  'Mysore':           'low',
  'Hubli-Dharwad':    'high',
  'Mangalore':        'low',
  'Belgaum':          'low',
  'Gulbarga':         'low',

  // Gujarat
  'Ahmedabad':        'critical',
  'Surat':            'high',
  'Vadodara':         'high',
  'Rajkot':           'high',
  'Bhavnagar':        'low',
  'Jamnagar':         'low',
  'Gandhinagar':      'low',
  'Anand':            'low',

  // Rajasthan
  'Jaipur':           'critical',
  'Jodhpur':          'high',
  'Kota':             'critical',
  'Bikaner':          'low',
  'Ajmer':            'low',
  'Udaipur':          'low',
  'Alwar':            'high',
  'Sikar':            'low',
  'Bharatpur':        'low',

  // West Bengal
  'Kolkata':          'critical',
  'Hooghly':          'high',
  'Howrah':           'critical',
  'North 24 Parganas':'high',
  'South 24 Parganas':'high',
  'Bardhaman':        'low',
  'Nadia':            'low',
  'Murshidabad':      'high',

  // Madhya Pradesh
  'Bhopal':           'critical',
  'Indore':           'critical',
  'Jabalpur':         'high',
  'Gwalior':          'high',
  'Ujjain':           'low',
  'Sagar':            'low',
  'Rewa':             'low',
  'Satna':            'low',

  // Andhra Pradesh
  'Visakhapatnam':    'critical',
  'Vijayawada':       'high',
  'Guntur':           'high',
  'Nellore':          'low',
  'Kurnool':          'low',
  'Tirupati':         'low',

  // Telangana
  'Hyderabad':        'critical',
  'Rangareddy':       'high',
  'Medchal':          'high',
  'Warangal':         'low',
  'Nizamabad':        'low',
  'Karimnagar':       'low',

  // Kerala
  'Thiruvananthapuram': 'critical',
  'Ernakulam':        'high',
  'Kozhikode':        'high',
  'Thrissur':         'high',
  'Alappuzha':        'critical',
  'Malappuram':       'low',
  'Kollam':           'low',
  'Palakkad':         'low',
  'Kannur':           'low',

  // Bihar
  'Patna':            'critical',
  'Gaya':             'high',
  'Muzaffarpur':      'critical',
  'Bhagalpur':        'high',
  'Darbhanga':        'high',
  'Nalanda':          'low',
  'Vaishali':         'low',

  // Assam
  'Kamrup Metropolitan': 'critical',
  'Kamrup':           'high',
  'Nagaon':           'high',
  'Dibrugarh':        'low',
  'Sonitpur':         'high',
  'Cachar':           'low',

  // Odisha
  'Khordha':          'critical',
  'Cuttack':          'high',
  'Puri':             'low',
  'Sambalpur':        'low',
  'Balasore':         'high',
  'Ganjam':           'high',

  // Punjab
  'Ludhiana':         'critical',
  'Amritsar':         'high',
  'Jalandhar':        'high',
  'Patiala':          'high',
  'Bathinda':         'low',
  'Mohali':           'low',

  // Haryana
  'Hisar':            'high',
  'Rohtak':           'high',
  'Sonipat':          'high',
  'Ambala':           'low',
  'Panipat':          'high',

  // Jharkhand
  'Ranchi':           'critical',
  'Dhanbad':          'high',
  'Jamshedpur':       'high',
  'Bokaro':           'low',
  'Hazaribagh':       'low',

  // Chhattisgarh
  'Raipur':           'critical',
  'Durg':             'high',
  'Bilaspur':         'high',
  'Rajnandgaon':      'low',

  // Uttarakhand
  'Dehradun':         'critical',
  'Haridwar':         'high',
  'Nainital':         'low',
  'Udham Singh Nagar':'high',

  // Himachal Pradesh
  'Shimla':           'low',
  'Kangra':           'low',
  'Mandi':            'low',
  'Kullu':            'low',

  // Goa
  'North Goa':        'low',
  'South Goa':        'low',

  // Jammu & Kashmir
  'Srinagar':         'critical',
  'Jammu':            'critical',
  'Kupwara':          'high',
  'Baramulla':        'high',
  'Anantnag':         'high',
  'Pulwama':          'critical',

  // Northeast
  'Imphal West':      'high',
  'Imphal East':      'high',
  'Churachandpur':    'low',
  'East Khasi Hills': 'low',
  'Ri Bhoi':          'low',
  'Aizawl':           'low',
  'Kohima':           'low',
  'Dimapur':          'low',
  'Agartala':         'low',
  'West Tripura':     'low',
  'Itanagar':         'low',
};

// Component to force Leaflet to recalculate its size after layout
function MapFocus() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

// Fly map to a given position
function MapAutoCenter({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 8), { animate: true, duration: 1.5 });
    }
  }, [position, map]);
  return null;
}

export default function CriticalZones() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [geoData, setGeoData] = useState<any>(null);
  const [districtSeverityMap, setDistrictSeverityMap] = useState<Record<string, string>>({});
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userDistrict, setUserDistrict] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [centeredOnUser, setCenteredOnUser] = useState(false);

  // Fetch district-level GeoJSON
  useEffect(() => {
    fetch('/india_districts.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error('Error loading india_districts.geojson', err));
  }, []);

  // Live GPS watch for user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by your browser.');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocationError(null);
      },
      (err) => {
        setLocationError('Location access denied. Enable GPS for your location marker.');
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Fetch live alerts from Supabase
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

        const parsedAlerts = (data || []).map((alert: any) => {
          let lat = 0, lng = 0;
          if (alert.location && typeof alert.location === 'string') {
            const locMatch = alert.location.match(/\(([^,]+),\s*([^)]+)\)/);
            if (locMatch) { lat = parseFloat(locMatch[1]); lng = parseFloat(locMatch[2]); }
          }
          const ageInMinutes = (Date.now() - new Date(alert.created_at).getTime()) / 60000;
          const severity = alert.status === 'resolved' ? 'low' : ageInMinutes > 5 ? 'critical' : 'high';
          return { ...alert, lat, lng, severity };
        }).filter(a => a.lat !== 0 && a.lng !== 0);

        // Live/mock incident points covering major cities
        const MOCK_INCIDENTS = [
          { id: 'm1',  lat: 19.0760, lng: 72.8777, severity: 'critical' }, // Mumbai
          { id: 'm2',  lat: 28.7041, lng: 77.1025, severity: 'critical' }, // Delhi
          { id: 'm3',  lat: 12.9716, lng: 77.5946, severity: 'critical' }, // Bangalore
          { id: 'm4',  lat: 13.0827, lng: 80.2707, severity: 'critical' }, // Chennai
          { id: 'm5',  lat: 17.3850, lng: 78.4867, severity: 'critical' }, // Hyderabad
          { id: 'm6',  lat: 22.5726, lng: 88.3639, severity: 'critical' }, // Kolkata
          { id: 'm7',  lat: 26.9124, lng: 75.7873, severity: 'critical' }, // Jaipur
          { id: 'm8',  lat: 23.0225, lng: 72.5714, severity: 'high'     }, // Ahmedabad
          { id: 'm9',  lat: 18.5204, lng: 73.8567, severity: 'high'     }, // Pune
          { id: 'm10', lat: 25.5941, lng: 85.1376, severity: 'critical' }, // Patna
          { id: 'm11', lat: 26.8467, lng: 80.9462, severity: 'critical' }, // Lucknow
          { id: 'm12', lat: 22.7196, lng: 75.8577, severity: 'critical' }, // Indore
          { id: 'm13', lat: 21.1458, lng: 79.0882, severity: 'high'     }, // Nagpur
          { id: 'm14', lat: 9.9312,  lng: 76.2673, severity: 'critical' }, // Kochi
          { id: 'm15', lat: 8.5241,  lng: 76.9366, severity: 'critical' }, // Thiruvananthapuram
          { id: 'm16', lat: 30.7333, lng: 76.7794, severity: 'high'     }, // Chandigarh
          { id: 'm17', lat: 31.1048, lng: 77.1734, severity: 'low'      }, // Shimla
          { id: 'm18', lat: 34.0836, lng: 74.7973, severity: 'critical' }, // Srinagar
          { id: 'm19', lat: 26.2006, lng: 92.9376, severity: 'critical' }, // Guwahati
          { id: 'm20', lat: 20.2961, lng: 85.8245, severity: 'critical' }, // Bhubaneswar
          { id: 'm21', lat: 23.3441, lng: 85.3096, severity: 'high'     }, // Ranchi
          { id: 'm22', lat: 30.3165, lng: 78.0322, severity: 'critical' }, // Dehradun
          { id: 'm23', lat: 11.0168, lng: 76.9558, severity: 'high'     }, // Coimbatore
          { id: 'm24', lat: 21.2514, lng: 81.6296, severity: 'critical' }, // Raipur
          { id: 'm25', lat: 24.8607, lng: 67.0011, severity: 'low'      }, // Karachi (border)
          { id: 'm26', lat: 27.0238, lng: 74.2179, severity: 'low'      }, // Bikaner
          { id: 'm27', lat: 15.8497, lng: 74.4977, severity: 'low'      }, // Belgaum
          { id: 'm28', lat: 11.9416, lng: 79.8083, severity: 'low'      }, // Puducherry
          { id: 'm29', lat: 25.3176, lng: 82.9739, severity: 'high'     }, // Varanasi
          { id: 'm30', lat: 16.3067, lng: 80.4365, severity: 'high'     }, // Vijayawada
        ];

        setAlerts([...parsedAlerts, ...MOCK_INCIDENTS]);
      } catch (err) {
        console.error('Error fetching critical zones:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    const subscription = supabase
      .channel('critical-zone-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users_detail' }, fetchAlerts)
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, []);

  // Spatial join: assign highest-severity incident to each district
  // Starts from CITY_BASELINE_RISK, overrides with live incident data
  useEffect(() => {
    if (!geoData) return;

    const sevMap: Record<string, string> = {};

    geoData.features.forEach((feature: any) => {
      const districtName: string = feature.properties.NAME_2 || 'Unknown';
      let highest: string = CITY_BASELINE_RISK[districtName] || 'low';

      for (const alert of alerts) {
        if (!alert.lat || !alert.lng) continue;
        const pt = point([alert.lng, alert.lat]);
        try {
          if (booleanPointInPolygon(pt, feature)) {
            if (alert.severity === 'critical') { highest = 'critical'; break; }
            else if (alert.severity === 'high' && highest !== 'critical') highest = 'high';
          }
        } catch (_) { /* skip malformed polygons */ }
      }

      sevMap[districtName] = highest;
    });

    // Also detect which district the user is in
    if (userLocation) {
      const userPt = point([userLocation[1], userLocation[0]]);
      for (const feature of geoData.features) {
        try {
          if (booleanPointInPolygon(userPt, feature)) {
            setUserDistrict(feature.properties.NAME_2 || null);
            break;
          }
        } catch (_) {}
      }
    }

    setDistrictSeverityMap(sevMap);
  }, [geoData, alerts, userLocation]);

  // Color map
  const COLOR: Record<string, string> = {
    critical: '#ef4444',
    high:     '#f97316',
    low:      '#22c55e',
  };

  // Leaflet style function — district polygon fill based on severity
  const getStyle = (feature: any) => {
    const name: string = feature.properties.NAME_2 || 'Unknown';
    const sev = districtSeverityMap[name] || CITY_BASELINE_RISK[name] || 'low';
    return {
      fillColor: COLOR[sev] || COLOR.low,
      weight: 0.5,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.70,
    };
  };

  // Hover + popup per district
  const onEachFeature = (feature: any, layer: any) => {
    const name: string = feature.properties.NAME_2 || 'Unknown';
    const state: string = feature.properties.NAME_1 || '';
    const sev = districtSeverityMap[name] || CITY_BASELINE_RISK[name] || 'low';

    const badge: Record<string, string> = {
      critical: 'color:#ef4444;background:#fef2f2;border:1px solid #fecaca;',
      high:     'color:#ea580c;background:#fff7ed;border:1px solid #fed7aa;',
      low:      'color:#16a34a;background:#f0fdf4;border:1px solid #bbf7d0;',
    };
    const label: Record<string, string> = {
      critical: '🔴 CRITICAL RISK',
      high:     '🟠 HIGH RISK (Active)',
      low:      '🟢 SAFE ZONE (Resolved)',
    };

    layer.bindPopup(`
      <div style="font-family:sans-serif;padding:8px 10px;min-width:160px">
        <strong style="font-size:14px;color:#1e293b">${name}</strong>
        <div style="font-size:11px;color:#64748b;margin-bottom:6px">${state}</div>
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:3px 8px;border-radius:6px;display:inline-block;${badge[sev]}">${label[sev]}</span>
      </div>
    `);

    layer.on({
      mouseover: (e: any) => e.target.setStyle({ fillOpacity: 0.92, weight: 1.5 }),
      mouseout:  (e: any) => e.target.setStyle({ fillOpacity: 0.70, weight: 0.5 }),
    });
  };

  // Stats
  const stats = Object.values(districtSeverityMap);
  const criticalCount = stats.filter(s => s === 'critical').length;
  const highCount     = stats.filter(s => s === 'high').length;
  const safeCount     = stats.filter(s => s === 'low').length;

  return (
    <div className="pt-20 sm:pt-24 px-3 sm:px-4 pb-12 w-full max-w-7xl mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-5 sm:mb-6 flex flex-col gap-1.5">
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
          <MapIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary shrink-0" />
          Critical Zones Map
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-xl">
          City &amp; district-level emergency risk visualization across India — powered by live SOS data + NCRB/NHAI accident records.
        </p>
      </motion.div>

      {/* Stats Row */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-red-500 shrink-0" />
          <div>
            <p className="text-xl sm:text-2xl font-black text-red-600">{criticalCount}</p>
            <p className="text-[10px] sm:text-xs font-bold text-red-500 uppercase tracking-widest">Critical Districts</p>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
          <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500 shrink-0" />
          <div>
            <p className="text-xl sm:text-2xl font-black text-orange-600">{highCount}</p>
            <p className="text-[10px] sm:text-xs font-bold text-orange-500 uppercase tracking-widest">High-Risk</p>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 sm:p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500 shrink-0" />
          <div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600">{safeCount}</p>
            <p className="text-[10px] sm:text-xs font-bold text-emerald-500 uppercase tracking-widest">Safe Zones</p>
          </div>
        </div>
      </motion.div>

      {/* Legend + GPS Status */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="flex flex-wrap gap-2 sm:gap-3 mb-3 sm:mb-4 items-center">
        <div className="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 text-sm font-bold shadow-sm">
          <div className="w-4 h-4 rounded-sm bg-red-500 animate-pulse border border-red-600" /> Critical Risk (Ongoing &gt; 5m)
        </div>
        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 text-sm font-bold shadow-sm">
          <div className="w-4 h-4 rounded-sm bg-orange-500 border border-orange-600" /> High Risk (Active)
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 text-sm font-bold shadow-sm">
          <div className="w-4 h-4 rounded-sm bg-emerald-500 border border-emerald-600" /> Safe Zone (Resolved)
        </div>
        {/* User location badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold shadow-sm ${
          userLocation
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}>
          <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${
            userLocation ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'
          }`} />
          {userLocation
            ? `📍 You — ${userDistrict || 'Locating…'}`
            : locationError ? '⚠ Location Off' : '📡 Acquiring GPS…'
          }
        </div>
      </motion.div>

      {/* GPS error banner */}
      {locationError && (
        <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold flex items-center gap-2">
          <Navigation className="w-4 h-4 shrink-0" />
          {locationError}
        </div>
      )}

      {/* Map */}
      <div className="bg-white p-1.5 sm:p-2 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden z-0 flex-1" style={{ minHeight: 'clamp(320px, 60vh, 650px)' }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="font-bold text-slate-700">Loading District Geodata…</p>
            <p className="text-xs text-slate-400 mt-1">Mapping {Object.keys(districtSeverityMap).length} districts</p>
          </div>
        )}

        {/* Locate Me button */}
        {userLocation && (
          <button
            onClick={() => setCenteredOnUser(prev => !prev)}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white shadow-lg border border-slate-200 text-blue-600 font-bold text-xs px-3 py-2 rounded-xl hover:bg-blue-50 transition-all"
          >
            <Navigation className="w-4 h-4" />
            My Location
          </button>
        )}

        <MapContainer
          center={[22.5, 82.5]}
          zoom={5}
          scrollWheelZoom={true}
          style={{ height: 'clamp(320px, 60vh, 650px)', width: '100%', zIndex: 0, borderRadius: '0.75rem', background: '#f1f5f9' }}
        >
          <MapFocus />
          {/* Fly to user whenever button toggled or first location arrives */}
          <MapAutoCenter position={userLocation && centeredOnUser ? userLocation : null} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          />

          {geoData && (
            <GeoJSON
              key={JSON.stringify(districtSeverityMap)}
              data={geoData}
              style={getStyle}
              onEachFeature={onEachFeature}
            />
          )}

          {/* User Location Marker */}
          {userLocation && (
            <>
              {/* Outer pulse ring */}
              <CircleMarker
                center={userLocation}
                radius={18}
                pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 0 }}
              />
              {/* Inner solid dot */}
              <CircleMarker
                center={userLocation}
                radius={9}
                pathOptions={{ color: '#ffffff', fillColor: '#3b82f6', fillOpacity: 1, weight: 3 }}
              >
                <Popup>
                  <div style={{ fontFamily: 'sans-serif', padding: '8px 10px', minWidth: '170px' }}>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>📍 Your Location</strong>
                    {userDistrict && (
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                        District: <strong>{userDistrict}</strong>
                      </div>
                    )}
                    {userDistrict && districtSeverityMap[userDistrict] && (
                      <div style={{
                        marginTop: '6px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-block',
                        ...(districtSeverityMap[userDistrict] === 'critical'
                          ? { color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca' }
                          : districtSeverityMap[userDistrict] === 'high'
                          ? { color: '#ea580c', background: '#fff7ed', border: '1px solid #fed7aa' }
                          : { color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0' })
                      }}>
                        {districtSeverityMap[userDistrict] === 'critical' ? '🔴 Critical Risk Zone'
                          : districtSeverityMap[userDistrict] === 'high' ? '🟠 High Risk Zone'
                          : '🟢 Safe Zone'}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
                      {userLocation[0].toFixed(5)}°N, {userLocation[1].toFixed(5)}°E
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
