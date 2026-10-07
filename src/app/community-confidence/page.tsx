'use client';

import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAccessibility } from '@/context/AccessibilityContext';
import {
  Users,
  ShieldCheck,
  ThumbsUp,
  Search,
  Clock,
  PlusCircle,
  Award,
  ArrowLeft,
  ShieldAlert,
  Tag,
  MapPin,
  Sliders,
  Camera,
  Send,
  CheckCircle2,
  Check,
  AlertTriangle,
  Timer,
  Navigation,
  ChevronRight,
  ChevronDown,
  Crosshair,
  Map as MapIcon,
  ThumbsDown,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import TrustBadge from '@/components/TrustBadge';
import MapLocationPickerModal from '@/components/MapLocationPickerModal';
import { BarrierRecord, BarrierCategory, CATEGORY_LABELS } from '@/lib/db/barrierService';

const EXTENDED_CATEGORIES: Array<{
  id: BarrierCategory;
  label: string;
  icon: string;
  desc: string;
}> = [
  { id: 'blocked_ramp', label: 'Blocked / Missing Ramp', icon: '♿', desc: 'Ramp obstructed, barricaded, or absent' },
  { id: 'stairs', label: 'Stairs / Steep Flight of Steps', icon: '🪜', desc: 'Step flights without ramp alternative' },
  { id: 'broken_footpath', label: 'Broken Footpath / Uneven Pavers', icon: '🚧', desc: 'Cracked, unpaved, or potholed sidewalk' },
  { id: 'steep_road', label: 'Steep Road / High Gradient', icon: '⛰️', desc: 'Incline exceeds safe manual grade (>8%)' },
  { id: 'inaccessible_entrance', label: 'Inaccessible Entrance', icon: '🚪', desc: 'Heavy turnstile, step barrier, or narrow door' },
  { id: 'poor_lighting', label: 'Poor Street Lighting', icon: '💡', desc: 'Inadequate streetlamps, dark underpass' },
  { id: 'temporary_obstacle', label: 'Temporary Obstacle (With Expiry)', icon: '⚠️', desc: 'Roadwork scaffolding, puddle, or waterlogging' },
  { id: 'elevator_outage', label: 'Elevator / Escalator Out of Service', icon: '🔌', desc: 'Mechanical outage preventing concourse transit' },
];

function CommunityConfidenceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    barrierReports,
    addBarrierReport,
    upvoteReport,
    downvoteReport,
    resolveReport,
    speakText,
    activeHazardAlert,
  } = useAccessibility();

  // Relative time formatter
  const timeAgo = (timestampMs: number): string => {
    const diff = Math.max(0, Date.now() - timestampMs);
    const mins = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // View state: 'feed' (default) or 'reportForm'
  const [view, setView] = useState<'feed' | 'reportForm'>('feed');

  // Check URL param if action=report was passed
  useEffect(() => {
    if (searchParams.get('action') === 'report') {
      setView('reportForm');
    }
  }, [searchParams]);

  // Feed Filter States
  const [filterTag, setFilterTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Persisted barriers from API
  const [apiBarriers, setApiBarriers] = useState<BarrierRecord[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);
  const [voteToastMessage, setVoteToastMessage] = useState<string | null>(null);

  // Report Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BarrierCategory>('blocked_ramp');

  // Location state: GPS Coordinates + Label
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({
    lat: 19.0178,
    lng: 72.8478,
  });
  const [location, setLocation] = useState('Dadar Station West Concourse');
  const [microLocation, setMicroLocation] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [estimatedResolutionTime, setEstimatedResolutionTime] = useState('Est. 2h 0m');
  const [description, setDescription] = useState('');
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [attachedPhotoName, setAttachedPhotoName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Map Picker & GPS States
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Focus trap / auto-focus ref
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === 'reportForm') {
      titleInputRef.current?.focus();
    }
  }, [view]);

  // Auto-fetch GPS on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          setCoordinates({ lat, lng });
          setLocation(`Current Location (${lat}° N, ${lng}° E)`);
        },
        () => {
          // Default fallback coordinates already set
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, []);

  // Fetch barriers from persistence API
  const fetchBarriersFromApi = useCallback(async () => {
    setIsLoadingApi(true);
    try {
      const res = await fetch('/api/barriers');
      if (res.ok) {
        const data = await res.json();
        if (data.barriers) {
          setApiBarriers(data.barriers);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch barriers from API:', err);
    } finally {
      setIsLoadingApi(false);
    }
  }, []);

  useEffect(() => {
    fetchBarriersFromApi();
  }, [fetchBarriersFromApi]);

  // Combined reports (merging API records with active context records)
  const combinedReports = React.useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    // 1. API barriers (primary source of truth)
    for (const b of apiBarriers) {
      seenIds.add(b.id);
      list.push({
        id: b.id,
        title: b.title,
        category: CATEGORY_LABELS[b.category] || b.category,
        rawCategory: b.category,
        location: b.location_name,
        microLocation: b.micro_location,
        description: b.description || 'Reported by community navigator.',
        severity: b.severity,
        status: b.status,
        votes: b.confirmations,
        disputes: b.disputes,
        reportedAt: new Date(b.created_at).getTime(),
        reportedBy: b.timeline?.[0]?.actor || 'Navigator #412',
        estimatedResolutionTime: b.estimated_resolution_time,
        ttlSeconds: Math.max(0, Math.floor((new Date(b.expires_at).getTime() - Date.now()) / 1000)),
        timeline: b.timeline,
        confidence: b.confidence_score,
      });
    }

    // 2. Add any context-only barriers not yet in API list
    for (const cr of barrierReports) {
      if (!seenIds.has(cr.id)) {
        list.push({
          id: cr.id,
          title: cr.title,
          category: cr.category,
          location: cr.location,
          microLocation: cr.microLocation,
          description: cr.description,
          severity: cr.severity,
          status: cr.status === 'Verified' ? 'COMMUNITY_VERIFIED' : 'UNVERIFIED',
          votes: cr.votes,
          disputes: cr.downvotes || 0,
          reportedAt: cr.createdAt || Date.now() - 3600000,
          reportedBy: 'Local Navigator',
          estimatedResolutionTime: 'Est. 2h 0m',
          ttlSeconds: cr.ttlSeconds || 3600,
          timeline: [
            {
              id: `evt-${cr.id}`,
              action: 'REPORTED',
              actor: 'Local Navigator',
              timestamp: new Date(cr.createdAt || Date.now()).toISOString(),
              details: 'Reported during active session.',
            },
          ],
          confidence: cr.votes / (cr.votes + (cr.downvotes || 0) + 1),
        });
      }
    }

    return list;
  }, [apiBarriers, barrierReports]);

  // Filtered reports
  const filteredReports = React.useMemo(() => {
    return combinedReports.filter((report) => {
      if (report.status === 'EXPIRED') return false;

      if (filterTag === 'elevator' && !report.category.toLowerCase().includes('elevator')) {
        return false;
      }
      if (filterTag === 'critical' && report.severity !== 'critical') {
        return false;
      }
      if (
        filterTag === 'verified' &&
        report.status !== 'COMMUNITY_VERIFIED' &&
        report.status !== 'Verified'
      ) {
        return false;
      }
      if (filterTag === 'unverified' && report.status !== 'UNVERIFIED') {
        return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = report.title?.toLowerCase().includes(q);
        const matchesLoc = report.location?.toLowerCase().includes(q);
        const matchesCat = report.category?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLoc && !matchesCat) return false;
      }

      return true;
    });
  }, [combinedReports, filterTag, searchQuery]);

  // GPS Acquisition Handler
  const handleAcquireGps = () => {
    if (!navigator.geolocation) {
      speakText('Geolocation not supported on this device.');
      return;
    }
    setIsLocatingGps(true);
    speakText('Acquiring high accuracy GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setCoordinates({ lat, lng });
        const label = `GPS Position (${lat}° N, ${lng}° E)`;
        setLocation(label);
        setIsLocatingGps(false);
        speakText(`GPS coordinates locked: ${lat} north, ${lng} east.`);
      },
      (err) => {
        setIsLocatingGps(false);
        console.warn('GPS lock failed:', err);
        speakText('Unable to acquire live GPS. Please pick a location on the map.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Map Picker Callback
  const handleLocationPickedOnMap = (lat: number, lng: number, label: string) => {
    setCoordinates({ lat, lng });
    setLocation(label);
    speakText(`Location set from map: ${label}`);
  };

  const handleOpenReportForm = () => {
    setView('reportForm');
    setSubmitted(false);
    speakText('Navigated to Report a Barrier form. Focus placed on Hazard Title input.');
  };

  const handleBackToFeed = () => {
    setView('feed');
    speakText('Returned to Community Audit Feed.');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedPhotoFile(file);
      setAttachedPhotoName(file.name);
      speakText(`Photo attached: ${file.name}`);
    }
  };

  // Submit Report with API Persistence
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    speakText('Submitting accessibility barrier report to community network.');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('severity', severity);
      formData.append('location_name', location.trim());
      formData.append('lat', String(coordinates.lat));
      formData.append('lng', String(coordinates.lng));
      if (microLocation.trim()) formData.append('micro_location', microLocation.trim());
      formData.append('estimated_resolution_time', estimatedResolutionTime);
      formData.append('description', description.trim() || 'Reported by community navigator.');
      if (selectedPhotoFile) {
        formData.append('photo', selectedPhotoFile);
      }

      // POST to persistent API route
      const res = await fetch('/api/barriers', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit barrier report');
      }

      // Also register in local accessibility context for instant dynamic avoidance
      const { rerouteResult } = await addBarrierReport({
        title: title.trim(),
        category: CATEGORY_LABELS[category] || category,
        severity,
        location: location.trim(),
        microLocation: microLocation.trim() || undefined,
        estimatedResolutionTime,
        affectsActiveRoute: true,
        description: description.trim() || 'Reported by community navigator.',
        coordinates,
      });

      // Refresh persisted list
      await fetchBarriersFromApi();

      setIsSubmitting(false);
      setSubmitted(true);

      const extraMin = rerouteResult?.extraMinutes || 3;
      speakText(
        `Barrier recorded. Rerouting active. Alternative step-free path calculated (+${extraMin} min).`
      );

      // Reset fields
      setTitle('');
      setMicroLocation('');
      setDescription('');
      setSelectedPhotoFile(null);
      setAttachedPhotoName(null);

      // Switch back to feed after short delay
      setTimeout(() => {
        setView('feed');
      }, 1200);
    } catch (err: any) {
      console.error('Failed to submit barrier report:', err);
      setIsSubmitting(false);
      alert(err.message || 'Failed to submit report. Please check your connection.');
    }
  };

  // Vote Handler: confirm | dispute | fixed
  const handleVote = async (reportId: string, action: 'confirm' | 'dispute' | 'fixed') => {
    try {
      const res = await fetch(`/api/barriers/${reportId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setVoteToastMessage('You have already voted on this barrier report.');
        speakText('You have already voted on this barrier report.');
        setTimeout(() => setVoteToastMessage(null), 3500);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Vote submission failed');
      }

      // Also sync local accessibility context
      if (action === 'confirm') upvoteReport(reportId);
      else if (action === 'dispute') downvoteReport(reportId);
      else if (action === 'fixed') resolveReport(reportId);

      const toastMsg = data.message || `Vote recorded (${action}).`;
      setVoteToastMessage(toastMsg);
      speakText(toastMsg);
      setTimeout(() => setVoteToastMessage(null), 3500);

      // Refresh list
      await fetchBarriersFromApi();
    } catch (err: any) {
      console.warn('API vote failed, falling back to local context:', err);
      if (action === 'confirm') upvoteReport(reportId);
      else if (action === 'dispute') downvoteReport(reportId);
      else if (action === 'fixed') resolveReport(reportId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMMUNITY_VERIFIED':
      case 'Verified':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Community Verified (3+)</span>
          </span>
        );
      case 'DISPUTED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Disputed</span>
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5 text-slate-600" />
            <span>Resolved / Cleared</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/30 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Expired Hazard</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Unverified Report</span>
          </span>
        );
    }
  };

  const filterOptions = [
    { id: 'all', label: 'All Audits' },
    { id: 'verified', label: '🛡️ Community Verified' },
    { id: 'unverified', label: '⚠️ Unverified' },
    { id: 'elevator', label: 'Elevators' },
    { id: 'critical', label: 'Critical' },
  ];

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center bg-surface">
      <div className="w-full max-w-[850px] flex flex-col gap-6">

        {/* Global Vote Toast Banner */}
        {voteToastMessage && (
          <div
            role="status"
            aria-live="polite"
            className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-xl flex items-center justify-between gap-3 animate-in fade-in duration-200 border border-slate-700 sticky top-4 z-50"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{voteToastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setVoteToastMessage(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: LIVE COMMUNITY AUDIT FEED (DEFAULT STATE)                         */}
        {/* ========================================================================= */}
        {view === 'feed' && (
          <>
            {/* Dynamic Obstacle Avoidance: Live Alert Banner */}
            {activeHazardAlert?.active && (
              <div
                className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-600/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm"
                role="alert"
                aria-live="assertive"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-200 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-amber-950 dark:text-amber-200 tracking-wider">
                        🔴 Instant Rerouting Triggered
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-900 text-white">
                        {activeHazardAlert.detourTime}
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-on-surface mt-0.5">
                      {activeHazardAlert.title}
                    </div>
                    <div className="text-xs text-on-surface font-semibold mt-0.5">
                      {activeHazardAlert.impact}
                    </div>
                  </div>
                </div>
                <Link
                  href="/live-adaptation-alert"
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap self-start sm:self-center"
                >
                  <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>View Reroute</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}

            {/* Header with Top-Right Action Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shadow-md">
                  <Users className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
                    Community Confidence
                  </h1>
                  <p className="text-on-surface-variant text-base font-medium">
                    Verified crowd-audited barriers & live consensus tracking.
                  </p>
                </div>
              </div>

              {/* Action Button: Report Barrier */}
              <button
                type="button"
                onClick={handleOpenReportForm}
                className="h-12 px-5 rounded-xl bg-primary text-on-primary font-extrabold text-sm flex items-center gap-2 shadow-md hover:bg-primary-container transition-all self-start sm:self-center whitespace-nowrap active:scale-[0.98] cursor-pointer"
                aria-label="Report a new barrier"
              >
                <PlusCircle className="w-4 h-4" />
                <span>⊕ Report Barrier</span>
              </button>
            </div>

            {/* Overall Network Metrics Card */}
            <div className="p-6 bg-gradient-to-r from-primary-container/20 to-secondary-container/20 rounded-3xl border border-primary/20 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-md shrink-0">
                  <Award className="w-10 h-10" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-secondary uppercase tracking-wider">
                    Community Consensus Health
                  </div>
                  <div className="text-3xl font-black text-on-surface">98.4% Trust Index</div>
                  <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                    Continuous decay & Bayesian verification active across all municipal sectors.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-3 rounded-2xl border border-outline-variant/30 w-full sm:w-auto justify-around">
                <div className="text-center">
                  <div className="text-xs font-bold text-on-surface-variant">Active Hazards</div>
                  <div className="text-xl font-extrabold text-primary">{filteredReports.length}</div>
                </div>
                <div className="h-8 w-px bg-outline-variant/30" />
                <div className="text-center">
                  <div className="text-xs font-bold text-on-surface-variant">Verified (3+)</div>
                  <div className="text-xl font-extrabold text-secondary">
                    {combinedReports.filter((r) => r.status === 'COMMUNITY_VERIFIED').length}
                  </div>
                </div>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 absolute left-4 top-4 text-on-surface-variant" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search barriers, streets, or categories..."
                  aria-label="Search community reports or locations"
                  className="w-full h-13 pl-12 pr-4 rounded-xl bg-surface-container-lowest border border-outline-variant/40 font-medium text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none py-1">
                {filterOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilterTag(opt.id)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      filterTag === opt.id
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-lowest hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports Feed */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-on-surface uppercase tracking-wide">
                  Live Barrier Network ({filteredReports.length})
                </h2>
                <button
                  type="button"
                  onClick={fetchBarriersFromApi}
                  disabled={isLoadingApi}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingApi ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {filteredReports.map((report) => {
                const isCritical = report.severity === 'critical';
                const isTimelineOpen = expandedTimelineId === report.id;

                return (
                  <article
                    key={report.id}
                    className={`p-6 rounded-3xl bg-surface-container-lowest border transition-all shadow-xs flex flex-col gap-4 ${
                      isCritical ? 'border-tertiary/60 shadow-md' : 'border-outline-variant/40'
                    }`}
                  >
                    {/* Card Header: Category + Status + Time Ago */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            isCritical
                              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 border border-amber-600/40'
                              : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-950 dark:text-emerald-100 border border-emerald-600/40'
                          }`}
                        >
                          {report.category}
                        </span>
                        {getStatusBadge(report.status)}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1">
                          👤 {report.reportedBy || 'Navigator'}
                        </span>
                        <span suppressHydrationWarning className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {timeAgo(report.reportedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Trust Rating & Continuous Decay Badge */}
                    <div className="flex items-center justify-between flex-wrap gap-2 py-0.5">
                      <TrustBadge
                        item={{
                          id: report.id,
                          title: report.title,
                          category: report.rawCategory || report.category,
                          source: report.reportedBy || 'community',
                          lastVerified: new Date(report.reportedAt),
                          confirmations: report.votes,
                          disputes: report.disputes || 0,
                        }}
                        size="sm"
                        showFreshness={true}
                        showWhyButton={true}
                      />

                      {report.ttlSeconds > 0 && (
                        <span className="text-[11px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-lg border border-outline-variant/20">
                          ⏱️ TTL: {Math.max(0, Math.floor(report.ttlSeconds / 60))}m remaining
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div>
                      <h3 className="text-lg font-extrabold text-on-surface">
                        {report.title}
                      </h3>
                      <div className="text-xs font-bold text-primary mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{report.location}</span>
                      </div>
                      <p className="text-sm text-on-surface-variant font-medium mt-2 leading-relaxed">
                        {report.description}
                      </p>
                    </div>

                    {/* Metadata Row: Resolution Time + Micro-Location */}
                    {(report.estimatedResolutionTime || report.microLocation) && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {report.estimatedResolutionTime && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-lg border border-outline-variant/20">
                            <Timer className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
                            {report.estimatedResolutionTime}
                          </span>
                        )}
                        {report.microLocation && report.microLocation !== report.location && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/20">
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            {report.microLocation}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Voting Actions: Confirm | Dispute | Fixed */}
                    <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 1. Confirm Still There */}
                        <button
                          type="button"
                          onClick={() => handleVote(report.id, 'confirm')}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors cursor-pointer"
                          title="Confirm barrier is still present (+30 min TTL)"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Confirm ({report.votes})</span>
                        </button>

                        {/* 2. Dispute Accuracy */}
                        <button
                          type="button"
                          onClick={() => handleVote(report.id, 'dispute')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-rose-700 dark:text-rose-400 font-bold text-xs transition-colors cursor-pointer"
                          title="Report as inaccurate or nonexistent (-45 min TTL)"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Dispute ({report.disputes || 0})</span>
                        </button>

                        {/* 3. Mark Fixed / Resolved */}
                        <button
                          type="button"
                          onClick={() => handleVote(report.id, 'fixed')}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-xs transition-colors cursor-pointer"
                          title="Mark barrier as repaired or cleared"
                        >
                          <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Mark Fixed</span>
                        </button>
                      </div>

                      {/* Expand Timeline Button */}
                      <button
                        type="button"
                        onClick={() => setExpandedTimelineId(isTimelineOpen ? null : report.id)}
                        className="text-xs font-bold text-on-surface-variant hover:text-primary flex items-center gap-1 cursor-pointer transition-colors"
                        aria-expanded={isTimelineOpen}
                      >
                        <Clock className="w-3.5 h-3.5 text-secondary" />
                        <span>Timeline ({report.timeline?.length || 1})</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isTimelineOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expandable Report Timeline (Requirement 5) */}
                    {isTimelineOpen && (
                      <div className="mt-2 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 flex flex-col gap-3 animate-in fade-in duration-200">
                        <div className="text-[11px] font-black uppercase text-on-surface-variant tracking-wider flex items-center gap-1.5">
                          <span>Audit & Consensus History</span>
                        </div>

                        <div className="relative pl-5 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-outline-variant/40">
                          {(report.timeline || [
                            {
                              id: '1',
                              action: 'REPORTED',
                              actor: report.reportedBy || 'Navigator #412',
                              timestamp: new Date(report.reportedAt).toISOString(),
                              details: 'Initial report submitted via Community Navigation interface.',
                            },
                          ]).map((evt: any, i: number) => (
                            <div key={evt.id || i} className="relative flex items-start gap-3 text-xs">
                              <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-surface-container-low shrink-0" />
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface uppercase">
                                    {evt.action}
                                  </span>
                                  <span className="font-bold text-on-surface">
                                    {evt.actor}
                                  </span>
                                  <time
                                    suppressHydrationWarning
                                    dateTime={evt.timestamp}
                                    title={new Date(evt.timestamp).toLocaleString('en-IN')}
                                    className="text-[11px] text-on-surface-variant font-medium"
                                  >
                                    • {timeAgo(new Date(evt.timestamp).getTime())}
                                  </time>
                                </div>
                                {evt.details && (
                                  <p className="text-[11px] text-on-surface-variant leading-relaxed mt-0.5">
                                    {evt.details}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: REPORT BARRIER VIEW (PERSISTENT FORM & GPS PICKER)                */}
        {/* ========================================================================= */}
        {view === 'reportForm' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Header with "Back to Feed" Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center shadow-md shrink-0">
                  <PlusCircle className="w-7 h-7 text-tertiary" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
                    Report an Accessibility Barrier
                  </h1>
                  <p className="text-on-surface-variant text-base font-medium">
                    Crowdsource obstacles into real-time routing with instant rerouting recalculation.
                  </p>
                </div>
              </div>

              {/* Back to Feed Button */}
              <button
                type="button"
                onClick={handleBackToFeed}
                className="h-11 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-xs text-on-surface flex items-center gap-2 transition-colors self-start sm:self-center cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>← Back to Feed</span>
              </button>
            </div>

            {/* Success Toast Banner */}
            {submitted && (
              <div
                className="p-4 rounded-2xl bg-secondary-container/30 border-2 border-secondary flex items-center gap-3 shadow-md animate-bounce"
                role="status"
                aria-live="polite"
              >
                <CheckCircle2 className="w-6 h-6 text-secondary shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-extrabold text-on-surface text-sm">
                    Barrier Report Submitted & Persisted Successfully!
                  </h2>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Rerouting recalculation broadcast to active sessions...
                  </p>
                </div>
              </div>
            )}

            {/* Form Card */}
            <form
              onSubmit={handleSubmitReport}
              className="p-6 md:p-8 bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-lg flex flex-col gap-6"
            >
              {/* 1. Barrier Title Input */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="barrier-title-input"
                  className="text-sm font-bold text-on-surface flex items-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4 text-tertiary" aria-hidden="true" />
                  <span>Barrier Title / Hazard Summary *</span>
                </label>
                <input
                  ref={titleInputRef}
                  id="barrier-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Flight of stairs without ramp, Broken curb cut, Broken elevator..."
                  className="w-full h-14 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 2. Hazard Category Selector (Extended 8 Categories) */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Hazard Category (Problem Statement Spec) *</span>
                </label>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                  role="radiogroup"
                  aria-label="Hazard Category"
                >
                  {EXTENDED_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setCategory(cat.id);
                          speakText(`Category selected: ${cat.label}`);
                        }}
                        className={`p-3 rounded-2xl text-left flex items-start gap-2.5 transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary ring-2 ring-primary/30 shadow-xs'
                            : 'bg-surface-container-low hover:bg-surface-container-high border-outline-variant/30 text-on-surface'
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{cat.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-on-surface leading-tight">
                            {cat.label}
                          </span>
                          <span className="text-[11px] text-on-surface-variant font-medium mt-0.5 leading-snug">
                            {cat.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Location Field with Live GPS & Map Picker (Requirement 6) */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="barrier-location-input"
                  className="text-sm font-bold text-on-surface flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-secondary" aria-hidden="true" />
                    <span>Exact Location & Coordinates *</span>
                  </span>
                  <span className="text-xs font-mono text-primary font-bold">
                    [{coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}]
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    id="barrier-location-input"
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter location description or use GPS / Map pin..."
                    className="flex-1 h-14 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  {/* Use Current GPS Button */}
                  <button
                    type="button"
                    onClick={handleAcquireGps}
                    disabled={isLocatingGps}
                    className="h-14 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs flex items-center justify-center gap-1.5 border border-outline-variant/30 whitespace-nowrap transition-colors cursor-pointer"
                    title="Acquire live GPS coordinates from your device"
                  >
                    <Crosshair className={`w-4 h-4 ${isLocatingGps ? 'animate-spin' : ''}`} />
                    <span>{isLocatingGps ? 'Locating...' : '◎ Use GPS'}</span>
                  </button>

                  {/* Pick on Map Button */}
                  <button
                    type="button"
                    onClick={() => setIsMapPickerOpen(true)}
                    className="h-14 px-4 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary font-bold text-xs flex items-center justify-center gap-1.5 border border-secondary/30 whitespace-nowrap transition-colors cursor-pointer"
                    title="Open interactive map to place a pin"
                  >
                    <MapIcon className="w-4 h-4" />
                    <span>🗺️ Pick on Map</span>
                  </button>
                </div>
              </div>

              {/* 3b. Micro-Location Field */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="barrier-micro-location-input"
                  className="text-sm font-bold text-on-surface flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>
                    Micro-Location{' '}
                    <span className="text-on-surface-variant font-normal">(optional)</span>
                  </span>
                </label>
                <input
                  id="barrier-micro-location-input"
                  type="text"
                  value={microLocation}
                  onChange={(e) => setMicroLocation(e.target.value)}
                  placeholder="e.g. 'NE corner dropped curb' or 'Skywalk Elevator Level 1'"
                  className="w-full h-12 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 3c. Estimated Resolution Time */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Timer className="w-4 h-4 text-secondary" aria-hidden="true" />
                  <span>Estimated Resolution / Clearance Time</span>
                </label>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="radiogroup"
                  aria-label="Estimated Resolution Time"
                >
                  {[
                    'Est. 30m',
                    'Est. 1h 0m',
                    'Est. 2h 0m',
                    'Est. 4h 0m',
                    'Est. 8h 0m',
                    'Est. 24h+',
                    'Permanent / Indefinite',
                  ].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={estimatedResolutionTime === opt}
                      onClick={() => setEstimatedResolutionTime(opt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        estimatedResolutionTime === opt
                          ? 'bg-secondary text-on-secondary border-secondary shadow-xs'
                          : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface border-outline-variant/30'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Severity Level */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-tertiary" aria-hidden="true" />
                  <span>Severity Level</span>
                </label>
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                  role="radiogroup"
                  aria-label="Severity Level"
                >
                  {[
                    { id: 'low', label: 'Low', activeStyle: 'bg-surface-container text-on-surface border-outline' },
                    { id: 'medium', label: 'Medium', activeStyle: 'bg-secondary/20 text-secondary border-secondary' },
                    { id: 'high', label: 'High', activeStyle: 'bg-tertiary/20 text-tertiary border-tertiary' },
                    { id: 'critical', label: 'Critical', activeStyle: 'bg-error-container text-on-error-container border-error' },
                  ].map((s) => {
                    const isSelected = severity === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => {
                          setSeverity(s.id as 'low' | 'medium' | 'high' | 'critical');
                          speakText(`Severity level set to ${s.label}`);
                        }}
                        className={`h-12 rounded-xl text-xs font-extrabold transition-all border cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-primary/30 shadow-xs ' + s.activeStyle
                            : 'border-outline-variant/30 bg-surface-container-low text-on-surface-variant'
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Detailed Description & Guidance Notes */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="barrier-description-input"
                  className="text-sm font-bold text-on-surface"
                >
                  Detailed Description & Workaround Notes
                </label>
                <textarea
                  id="barrier-description-input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe dimensions, workaround paths, surface hazards, or contractor presence..."
                  className="w-full p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 6. Photo Evidence Upload (Optional) */}
              <div className="p-4 rounded-2xl bg-surface-container-low border border-dashed border-outline-variant/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Camera className="w-6 h-6 text-primary" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-bold text-on-surface">Photo Evidence (Optional)</div>
                    <div className="text-xs text-on-surface-variant">
                      {attachedPhotoName ? (
                        <span className="text-secondary font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          {attachedPhotoName}
                        </span>
                      ) : (
                        'PNG, JPG up to 10MB (Uploaded to persistence store)'
                      )}
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  aria-label="Upload photo evidence"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs transition-colors cursor-pointer"
                >
                  {attachedPhotoName ? 'Change Photo' : 'Attach Photo'}
                </button>
              </div>

              {/* Submit & Cancel Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 h-14 rounded-xl bg-primary text-on-primary font-extrabold text-base flex items-center justify-center gap-2 shadow-md hover:bg-primary-container transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                  <span>
                    {isSubmitting ? 'Saving to Persistence Network...' : 'Publish Barrier Report'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleBackToFeed}
                  className="w-full sm:w-auto h-14 px-6 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-sm text-on-surface transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Map Location Picker Modal (Requirement 6) */}
        <MapLocationPickerModal
          isOpen={isMapPickerOpen}
          onClose={() => setIsMapPickerOpen(false)}
          initialLat={coordinates.lat}
          initialLng={coordinates.lng}
          onSelectLocation={handleLocationPickedOnMap}
        />
      </div>
    </div>
  );
}

export default function CommunityConfidencePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm font-bold text-on-surface-variant">
          Loading Community Confidence...
        </div>
      }
    >
      <CommunityConfidenceContent />
    </Suspense>
  );
}
