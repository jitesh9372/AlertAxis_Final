import React, { useState, useEffect, useRef } from 'react';

import { Instagram, Upload, ExternalLink, AlertCircle, CheckCircle2, Loader2, Play, Camera, Video, Mic, StopCircle, Trash2, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { cn } from '../lib/utils';

interface InstagramReport {
  id: string;
  instagram_username: string;
  reel_url: string;
  caption: string;
  created_at: string;
  is_direct_upload?: boolean;
  video_storage_path?: string;
}

const InstagramReportPage = ({ user }: { user: any }) => {
  const [reports, setReports] = useState<InstagramReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Create Reel States
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [username, setUsername] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchReports();
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('alertaxis')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error("Supabase Error:", err);
    }
  };



  // Create Reel Functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null); // Clear any previous camera errors
    } catch (err: any) {
      console.error("Camera Error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Camera/Microphone permission denied. Please enable access in your browser settings to record a reel.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No camera or microphone found on this device.");
      } else {
        setError("Failed to access camera/microphone: " + (err.message || "Unknown error"));
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    
    const chunks: Blob[] = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    };
    
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRecordedBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmitDirectReel = async () => {
    if (!recordedBlob) return;
    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const fileName = `instagram_alert_video_${Date.now()}.webm`;
      const filePath = `instagram alert/${fileName}`;
      
      // Upload to Supabase Storage in 'app-files' bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('app-files')
        .upload(filePath, recordedBlob);

      if (uploadError) {
        throw new Error(`Storage error: ${uploadError.message}. Ensure 'app-files' bucket exists.`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('app-files')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('alertaxis')
        .insert([
          {
            user_id: user?.id || null,
            instagram_username: username || "Anonymous",
            reel_url: publicUrl,
            caption: caption,
            is_direct_upload: true,
            video_storage_path: uploadData?.path || filePath,
            hashtag: '#alertaxis'
          }
        ]);

      if (dbError) throw dbError;

      setSuccess("Reel uploaded and reported successfully!");
      setRecordedBlob(null);
      setPreviewUrl(null);
      setCaption('');
      setUsername('');
      fetchReports();
    } catch (err: any) {
      console.error("Upload Error:", err);
      setError(err.message || "Failed to upload reel.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Instagram Reports
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Monitoring and creating Reels with <span className="text-primary font-bold">#alertaxis_</span>.
            </p>
          </div>
          

        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-8 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Camera/Preview Section */}
                    <div className="space-y-4">
                      <div className="aspect-[9/16] bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden relative border-2 border-dashed border-slate-200 dark:border-slate-700">
                        {previewUrl ? (
                          <video src={previewUrl} className="w-full h-full object-cover" controls />
                        ) : (
                          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        )}
                        
                        {!previewUrl && !isRecording && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                            <Camera className="w-12 h-12 text-white opacity-50" />
                          </div>
                        )}
                        
                        {isRecording && (
                          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                            <div className="w-2 h-2 bg-white rounded-full" />
                            RECORDING
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-center gap-4">
                        {!previewUrl ? (
                          <>
                            {!isRecording ? (
                              <button 
                                onClick={startRecording}
                                className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-all"
                              >
                                <Video className="w-8 h-8" />
                              </button>
                            ) : (
                              <button 
                                onClick={stopRecording}
                                className="w-16 h-16 bg-slate-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-slate-900 shadow-lg hover:scale-105 transition-all"
                              >
                                <StopCircle className="w-8 h-8" />
                              </button>
                            )}
                            <label className="w-16 h-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer">
                              <Upload className="w-6 h-6" />
                              <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                            </label>
                          </>
                        ) : (
                          <button 
                            onClick={() => {
                              setPreviewUrl(null);
                              setRecordedBlob(null);
                              startCamera();
                            }}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                            Discard
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Form Section */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Create Direct Reel</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Record or upload a video to report directly to AlertAxis.</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                            Instagram Username (Optional)
                          </label>
                          <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="@yourusername"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                            Caption / Emergency Details
                          </label>
                          <textarea 
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            placeholder="Describe the situation..."
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
                          />
                        </div>

                        <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10">
                          <p className="text-xs text-primary font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            This reel will be tagged with #alertaxis_ automatically.
                          </p>
                        </div>

                        <button 
                          onClick={handleSubmitDirectReel}
                          disabled={uploading || !recordedBlob}
                          className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-red-200 dark:shadow-none hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Send className="w-5 h-5" />
                              Submit Report
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
            </div>
          </div>

          {/* Reported History */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Reported History
            </h2>
            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
              {reports.length === 0 ? (
                <div className="p-8 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No reports yet.</p>
                </div>
              ) : (
                reports.map((report) => (
                  <div 
                    key={report.id}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-primary uppercase tracking-widest">#alertaxis_</span>
                        {report.is_direct_upload && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full">
                            DIRECT
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(report.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-1 mb-2">
                      {report.caption || "No caption"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        By: {report.instagram_username}
                      </span>
                      <a 
                        href={report.reel_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 hover:text-primary flex items-center gap-1"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstagramReportPage;
