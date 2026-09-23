import React, { useState, useEffect } from 'react';
import {
  StoredInspectionRecord,
  getInspectionsByAssetId,
  getAllInspectionRecords,
} from '../services/dbService';
import {
  getAllPhotoBlobs,
  StoredInspectionPhoto,
  createBlobImageUrl,
} from '../services/photoDbService';
import {
  Search,
  History,
  Activity,
  Thermometer,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Lock,
  X,
  Database,
  Camera,
} from 'lucide-react';

interface AssetLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAssetId?: string;
}

export const AssetLookupModal: React.FC<AssetLookupModalProps> = ({
  isOpen,
  onClose,
  initialAssetId,
}) => {
  const [searchTag, setSearchTag] = useState(initialAssetId || 'PUMP-104');
  const [historyRecords, setHistoryRecords] = useState<StoredInspectionRecord[]>([]);
  const [assetPhotos, setAssetPhotos] = useState<StoredInspectionPhoto[]>([]);
  const [blobUrlMap, setBlobUrlMap] = useState<Record<string, string>>({});
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<StoredInspectionPhoto | null>(null);

  // Load available asset tags from IndexedDB
  useEffect(() => {
    if (!isOpen) return;

    const loadTagsAndSearch = async () => {
      try {
        const all = await getAllInspectionRecords();
        const tagSet = new Set<string>();
        all.forEach((r) => {
          if (r.payload.unit_id && r.payload.unit_id !== 'Review') {
            tagSet.add(r.payload.unit_id);
          }
        });

        // Add default tags if empty
        ['PUMP-104', 'GEN-12', 'COMP-01', 'TURB-05', 'HEAT-22'].forEach((t) => tagSet.add(t));
        setAvailableTags(Array.from(tagSet));

        if (searchTag) {
          executeSearch(searchTag);
        }
      } catch (err) {
        console.warn('Error loading asset tags:', err);
      }
    };

    loadTagsAndSearch();

    return () => {
      Object.values(blobUrlMap).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    };
  }, [isOpen, initialAssetId]);

  const executeSearch = async (tag: string) => {
    if (!tag || !tag.trim()) return;
    setIsSearching(true);
    try {
      const results = await getInspectionsByAssetId(tag);
      setHistoryRecords(results);

      // Load photos for this asset tag
      const photos = await getAllPhotoBlobs();
      const matchingPhotos = photos.filter(
        (p) => !p.inspectionId || p.inspectionId === 'UNASSIGNED' || p.inspectionId.toLowerCase() === tag.toLowerCase()
      );
      setAssetPhotos(matchingPhotos);

      const newMap: Record<string, string> = {};
      matchingPhotos.forEach((p) => {
        newMap[p.id] = createBlobImageUrl(p.blob);
      });

      setBlobUrlMap((prev) => {
        Object.values(prev).forEach((url) => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {}
        });
        return newMap;
      });
    } catch (err) {
      console.error('Error querying asset history:', err);
    } finally {
      setIsSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0F172A] border-2 border-cyan-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Bar */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/40 rounded-xl text-cyan-400 shadow-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 tracking-wide font-mono">
                ASSET TELEMETRY HISTORY LOOKUP
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Query past machine inspection records & photo attachments from Central DB
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Controls */}
        <div className="p-6 bg-slate-900/60 border-b border-slate-800 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTag}
                onChange={(e) => setSearchTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeSearch(searchTag);
                }}
                placeholder="Enter Asset ID / Machine Tag (e.g. PUMP-104 or GEN-12)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={() => executeSearch(searchTag)}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all font-mono"
            >
              <Search className="w-4 h-4" />
              Search Asset
            </button>
          </div>

          {/* Quick Filter Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Quick Select Machine Tag:</span>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSearchTag(tag);
                  executeSearch(tag);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border ${
                  searchTag.toLowerCase() === tag.toLowerCase()
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Results Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-grow">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <Database className="w-4 h-4 text-cyan-400" />
              Historical Records for Asset [{searchTag.toUpperCase() || 'ALL'}]
            </span>
            <span>{historyRecords.length} Historical Log(s) &bull; {assetPhotos.length} Attached Photo(s)</span>
          </div>

          {isSearching ? (
            <div className="py-12 text-center text-xs font-mono text-cyan-400 animate-pulse">
              Querying historical telemetry logs & photo Blobs from Central DB...
            </div>
          ) : historyRecords.length === 0 ? (
            <div className="py-12 text-center space-y-2 bg-slate-950/60 rounded-xl border border-slate-800 p-6">
              <Activity className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-mono text-slate-300 font-semibold">
                No past inspection logs found in database for Asset Tag "{searchTag}".
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Submit an inspection payload for {searchTag} to record historical telemetry.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyRecords.map((rec, index) => (
                <div
                  key={rec.id}
                  className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-cyan-300 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                        Log #{historyRecords.length - index}
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded text-xs font-bold font-mono flex items-center gap-1.5 ${
                          rec.payload.status === 'PASS'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : rec.payload.status === 'CRITICAL_FAIL'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {rec.payload.status === 'PASS' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : rec.payload.status === 'CRITICAL_FAIL' ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        {rec.payload.status}
                      </span>
                    </div>

                    <div className="text-right text-xs font-mono text-slate-400">
                      <span>{new Date(rec.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Telemetry Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 block">Surface Temp</span>
                      <span className="text-xs font-bold font-mono text-slate-100 flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-amber-400" />
                        {rec.payload.temperature_c ?? '-'} °C
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 block">Vibration</span>
                      <span className="text-xs font-bold font-mono text-slate-100 flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-cyan-400" />
                        {rec.payload.vibration_ips ?? '-'} ips
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 block">E-Stop Switch</span>
                      <span className={`text-xs font-bold font-mono ${rec.payload.emergency_stop_tested ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {rec.payload.emergency_stop_tested ? 'TESTED' : 'UNTESTED'}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 block">Sync Status</span>
                      <span className={`text-xs font-bold font-mono ${rec.synced ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {rec.synced ? 'SYNCED' : 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Historical Attached Photo Thumbnails Grid */}
                  {assetPhotos.length > 0 && (
                    <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/80 space-y-2">
                      <span className="text-[10px] text-slate-300 font-mono uppercase font-bold flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-cyan-400" />
                        Historical Photo Attachments ({assetPhotos.length})
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {assetPhotos.map((photo) => {
                          const url = blobUrlMap[photo.id] || createBlobImageUrl(photo.blob);
                          const sizeMb = (photo.sizeBytes / (1024 * 1024)).toFixed(2);

                          return (
                            <div
                              key={photo.id}
                              onClick={() => setLightboxPhoto(photo)}
                              className="group relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-video cursor-pointer hover:border-cyan-500 transition-all shadow-md"
                            >
                              <img
                                src={url}
                                alt={photo.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 flex flex-col justify-end">
                                <span className="text-[8px] font-mono text-slate-100 font-bold truncate">{photo.name}</span>
                                <span className="text-[7px] font-mono text-cyan-300">{sizeMb} MB Blob</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Raw Transcript Audit Trail */}
                  {rec.payload.inspector_notes && rec.payload.inspector_notes !== 'Review' && (
                    <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs font-mono text-slate-200">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3 text-cyan-400" /> Raw Transcript Audit Trail:
                      </span>
                      "{rec.payload.inspector_notes}"
                    </div>
                  )}

                  {/* Cryptographic Seal */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Lock className="w-3 h-3" /> Seal: {rec.signature}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg border border-slate-700 transition-all font-mono"
          >
            Close Lookup
          </button>
        </div>

      </div>

      {/* Lightbox Modal for Historical Photos */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100 font-mono">{lightboxPhoto.name}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-950">
              <img
                src={blobUrlMap[lightboxPhoto.id] || createBlobImageUrl(lightboxPhoto.blob)}
                alt={lightboxPhoto.name}
                className="max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
