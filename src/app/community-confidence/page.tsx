'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
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
} from 'lucide-react';

function CommunityConfidenceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { barrierReports, addBarrierReport, upvoteReport, downvoteReport, resolveReport, speakText, activeHazardAlert } = useAccessibility();

  // Relative time formatter
  const timeAgo = (timestampMs: number): string => {
    const diff = Date.now() - timestampMs;
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
  const [filterTag, setFilterTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Report Form States
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Elevator Out of Service / Escalator Down');
  const [location, setLocation] = useState('North Concourse Plaza - Entrance Gate 3');
  const [microLocation, setMicroLocation] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [estimatedResolutionTime, setEstimatedResolutionTime] = useState('Est. 2h 0m');
  const [description, setDescription] = useState('');
  const [attachedPhotoName, setAttachedPhotoName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Focus trap / auto-focus ref for the first input
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === 'reportForm') {
      // Instantly focus the first input when transitioning to report form
      titleInputRef.current?.focus();
    }
  }, [view]);

  // Grouped obstacle categories matching Dynamic Obstacle Avoidance spec
  const categoryGroups = [
    {
      groupLabel: '🔌 Outages',
      items: [
        'Elevator Out of Service / Escalator Down',
        'Door Sensor Malfunction',
      ],
    },
    {
      groupLabel: '🌧️ Surface / Weather',
      items: [
        'Puddles / Waterlogging',
        'Mud / Loose Gravel',
        'Flooding / Waterlogging',
      ],
    },
    {
      groupLabel: '🚧 Construction / Blockade',
      items: [
        'Blockade / Scaffolding on Curb Cut',
        'Blocked Ramp / Flyover',
        'Police Checkpoint / Barricade',
        'Construction Obstruction',
      ],
    },
    {
      groupLabel: '⚠️ Other Hazards',
      items: [
        'Missing Curb Cut',
        'Steep Slope Ramp',
        'Fallen Tree / Pothole',
        'Other Hazard',
      ],
    },
  ];

  // Flat list for backwards compat
  const categories = categoryGroups.flatMap(g => g.items);

  const resolutionOptions = [
    'Est. 30m',
    'Est. 1h 0m',
    'Est. 2h 0m',
    'Est. 3h 0m',
    'Est. 4h 0m',
    'Est. 8h 0m',
    'Est. 24h+',
    'Unknown',
  ];

  const filterOptions = [
    { id: 'all', label: 'All Community Audits' },
    { id: 'elevator', label: 'Elevator Outages' },
    { id: 'verified', label: 'Verified Accessible' },
    { id: 'critical', label: 'Critical Barriers' }
  ];

  const filteredReports = barrierReports.filter(report => {
    if (report.isExpired || report.status === 'Expired') return false;
    if (filterTag === 'elevator' && !report.category.toLowerCase().includes('elevator')) return false;
    if (filterTag === 'critical' && report.severity !== 'critical') return false;
    if (filterTag === 'verified' && report.status !== 'Verified') return false;
    if (searchQuery && !report.title.toLowerCase().includes(searchQuery.toLowerCase()) && !report.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleOpenReportForm = () => {
    setView('reportForm');
    setSubmitted(false);
    speakText("Navigated to Report a Barrier form. Focus placed on Hazard Title input.");
  };

  const handleBackToFeed = () => {
    setView('feed');
    speakText("Returned to Community Audit Feed.");
  };

  const handleGpsPin = () => {
    const pinLocation = 'Current GPS Pin (19.0178° N, 72.8478° E - Dadar Station)';
    setLocation(pinLocation);
    speakText("GPS pin location inserted: Dadar Station coordinates.");
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setAttachedPhotoName(fileName);
      speakText(`Photo attached: ${fileName}`);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    speakText("Submitting accessibility barrier report to community network");

    try {
      const { targetId, rerouteResult } = await addBarrierReport({
        title: title.trim(),
        category,
        severity,
        location: location.trim(),
        microLocation: microLocation.trim() || undefined,
        estimatedResolutionTime: estimatedResolutionTime,
        affectsActiveRoute: true,
        description: description.trim() || 'Reported by community navigator.'
      });

      setIsSubmitting(false);
      setSubmitted(true);

      const extraMin = rerouteResult?.extraMinutes || 3;
      speakText(`Barrier reported. Rerouting. New route adds ${extraMin} minutes and is fully step-free.`);

      // Reset form fields
      setTitle('');
      setMicroLocation('');
      setDescription('');
      setAttachedPhotoName(null);

      // Automatically navigate to Live Alert page with reportId query param
      setTimeout(() => {
        router.push(`/live-adaptation-alert?reportId=${targetId}`);
      }, 700);
    } catch (err) {
      console.error('Failed to submit barrier report:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full px-4 md:px-8 py-8 flex justify-center bg-surface">
      <div className="w-full max-w-[850px] flex flex-col gap-6">

        {/* ========================================================================= */}
        {/* VIEW 1: LIVE COMMUNITY AUDIT FEED (DEFAULT STATE)                         */}
        {/* ========================================================================= */}
        {view === 'feed' && (
          <>
            {/* ── Dynamic Obstacle Avoidance: Live Alert Banner ─────────────── */}
            {activeHazardAlert?.active && (
              <div className="p-4 rounded-2xl bg-tertiary-container/20 border-2 border-tertiary/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-pulse" role="alert" aria-live="assertive">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-tertiary/20 text-tertiary flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-tertiary tracking-wider">
                        🔴 Instant Rerouting Triggered
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-tertiary text-white">
                        {activeHazardAlert.detourTime}
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-on-surface mt-0.5">
                      {activeHazardAlert.title}
                    </p>
                    <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                      📍 {activeHazardAlert.location} · {activeHazardAlert.impact}
                    </p>
                  </div>
                </div>
                <Link
                  href="/live-adaptation-alert"
                  className="px-3 py-2 rounded-xl bg-tertiary text-on-tertiary font-extrabold text-xs flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap self-start sm:self-center"
                >
                  <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>View Reroute</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}

            {/* Header with Top-Right Deep Blue Action Button */}
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
                    Verified crowd-audited places & community trust scores.
                  </p>
                </div>
              </div>

              {/* Prominent Deep Blue Action Button */}
              <button
                type="button"
                onClick={handleOpenReportForm}
                className="h-12 px-5 rounded-xl bg-primary text-on-primary font-extrabold text-sm flex items-center gap-2 shadow-md hover:bg-primary-container transition-all self-start sm:self-center whitespace-nowrap active:scale-[0.98]"
                aria-label="Report a new barrier"
              >
                <PlusCircle className="w-4 h-4" />
                <span>⊕ Report Barrier</span>
              </button>
            </div>

            {/* Overall Trust Metric Dashboard Card */}
            <div className="p-6 bg-gradient-to-r from-primary-container/20 to-secondary-container/20 rounded-3xl border border-primary/20 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-secondary text-on-secondary flex items-center justify-center shadow-md flex-shrink-0">
                  <Award className="w-10 h-10" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-secondary uppercase tracking-wider">
                    Community Network Health
                  </div>
                  <div className="text-3xl font-black text-on-surface">98.4% Trust Score</div>
                  <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                    Based on 1,420 real-time crowd audits across 350 urban sectors.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-3 rounded-2xl border border-outline-variant/30 w-full sm:w-auto justify-around">
                <div className="text-center">
                  <div className="text-xs font-bold text-on-surface-variant">Active Audits</div>
                  <div className="text-xl font-extrabold text-primary">1,420</div>
                </div>
                <div className="h-8 w-px bg-outline-variant/30" />
                <div className="text-center">
                  <div className="text-xs font-bold text-on-surface-variant">Resolved</div>
                  <div className="text-xl font-extrabold text-secondary">94%</div>
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
                  placeholder="Search reports or locations..."
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
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
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
                  Live Community Audit Feed ({filteredReports.length})
                </h2>
                <button
                  type="button"
                  onClick={handleOpenReportForm}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Submit New Hazard</span>
                </button>
              </div>

              {filteredReports.map((report) => {
                const isCritical = report.severity === 'critical';
                return (
                  <article
                    key={report.id}
                    className={`p-6 rounded-3xl bg-surface-container-lowest border transition-all shadow-xs flex flex-col gap-4 ${
                      isCritical ? 'border-tertiary/60 shadow-md' : 'border-outline-variant/40'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                            isCritical
                              ? 'bg-tertiary/20 text-tertiary'
                              : 'bg-secondary-container text-on-secondary-container'
                          }`}
                        >
                          {report.category}
                        </span>
                        <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {report.reportedAt ? timeAgo(report.reportedAt) : report.date}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-on-surface-variant flex items-center gap-1">
                          <svg className="w-3 h-3 text-secondary" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                          {report.reportedBy || 'Community Navigator'}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-secondary">
                          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                          <span>{report.status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <h3 className="text-lg font-extrabold text-on-surface">
                        {report.title}
                      </h3>
                      <div className="text-xs font-bold text-primary mt-0.5">
                        📍 {report.location}
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
                            <Timer className="w-3 h-3 text-secondary" aria-hidden="true" />
                            {report.estimatedResolutionTime}
                          </span>
                        )}
                        {report.microLocation && report.microLocation !== report.location && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/20">
                            <MapPin className="w-3 h-3" aria-hidden="true" />
                            {report.microLocation}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer Upvote & Downvote */}
                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            upvoteReport(report.id);
                            speakText(`Helpful upvote registered for ${report.title}`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors"
                        >
                          <ThumbsUp className="w-4 h-4" aria-hidden="true" />
                          <span>✅ Confirm Still There (+30m) ({report.votes})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            resolveReport(report.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-error-container/20 hover:bg-error-container/40 text-error font-bold text-xs transition-colors"
                        >
                          <span>🟢 Resolved / Not There (-45m)</span>
                        </button>
                      </div>

                      <span className="text-xs font-semibold text-on-surface-variant flex items-center gap-1">
                        ⏱️ TTL: {Math.max(0, Math.floor((report.ttlSeconds || 0) / 60))}m remaining
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: MERGED REPORT BARRIER VIEW                                        */}
        {/* ========================================================================= */}
        {view === 'reportForm' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            
            {/* Header with "Back to Feed" Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center shadow-md flex-shrink-0">
                  <PlusCircle className="w-7 h-7 text-tertiary" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-on-surface tracking-tight">
                    Report a Barrier
                  </h1>
                  <p className="text-on-surface-variant text-base font-medium">
                    Crowdsource physical accessibility hazards to safeguard community navigators.
                  </p>
                </div>
              </div>

              {/* Back to Feed Button */}
              <button
                type="button"
                onClick={handleBackToFeed}
                className="h-11 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-xs text-on-surface flex items-center gap-2 transition-colors self-start sm:self-center"
              >
                <ArrowLeft className="w-4 h-4 text-primary" aria-hidden="true" />
                <span>← Back to Feed</span>
              </button>
            </div>

            {/* Success Toast Banner */}
            {submitted && (
              <div className="p-4 rounded-2xl bg-secondary-container/30 border-2 border-secondary flex items-center gap-3 shadow-md animate-bounce" role="status" aria-live="polite">
                <CheckCircle2 className="w-6 h-6 text-secondary flex-shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-extrabold text-on-surface text-sm">
                    Barrier Report Submitted Successfully!
                  </h2>
                  <p className="text-xs text-on-surface-variant font-medium">
                    Returning to Community Confidence Feed...
                  </p>
                </div>
              </div>
            )}

            {/* Form Card (Lavender background, rounded white card) */}
            <form onSubmit={handleSubmitReport} className="p-6 md:p-8 bg-surface-container-lowest rounded-3xl border border-outline-variant/40 shadow-lg flex flex-col gap-6">
              
              {/* 1. Barrier Title / Hazard Summary Input (with focus ref) */}
              <div className="flex flex-col gap-2">
                <label htmlFor="barrier-title-input" className="text-sm font-bold text-on-surface flex items-center gap-2">
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
                  placeholder="e.g., North Elevator Outage or Broken Curb Cut Ramp"
                  className="w-full h-14 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 2. Hazard Category Selector (Grouped by type) */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Hazard Category</span>
                </label>
                <div className="flex flex-col gap-3" role="radiogroup" aria-label="Hazard Category">
                  {categoryGroups.map((group) => (
                    <div key={group.groupLabel} className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wider pl-1">
                        {group.groupLabel}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.items.map((cat) => {
                          const isSelected = category === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => {
                                setCategory(cat);
                                speakText(`Category selected: ${cat}`);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                                isSelected
                                  ? 'bg-primary text-on-primary shadow-xs'
                                  : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface border border-outline-variant/30'
                              }`}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Location Field with GPS Pin Button */}
              <div className="flex flex-col gap-2">
                <label htmlFor="barrier-location-input" className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-secondary" aria-hidden="true" />
                  <span>Exact Location</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="barrier-location-input"
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Building, entrance, floor, or cross street..."
                    className="w-full h-14 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-base text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleGpsPin}
                    className="h-14 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs flex items-center gap-1.5 border border-outline-variant/30 whitespace-nowrap active:scale-95 transition-transform"
                    title="Insert Current GPS Coordinates"
                  >
                    <MapPin className="w-4 h-4" aria-hidden="true" />
                    <span>◎ GPS Pin</span>
                  </button>
                </div>
              </div>

              {/* 3b. Micro-Location Field */}
              <div className="flex flex-col gap-2">
                <label htmlFor="barrier-micro-location-input" className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Micro-Location <span className="text-on-surface-variant font-normal">(optional)</span></span>
                </label>
                <input
                  id="barrier-micro-location-input"
                  type="text"
                  value={microLocation}
                  onChange={(e) => setMicroLocation(e.target.value)}
                  placeholder="e.g. 'Elevator B Shaft, Level 1' or 'NE corner curb cut'"
                  className="w-full h-12 px-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 3c. Estimated Resolution Time */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Timer className="w-4 h-4 text-secondary" aria-hidden="true" />
                  <span>Estimated Resolution Time</span>
                </label>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Estimated Resolution Time">
                  {resolutionOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={estimatedResolutionTime === opt}
                      onClick={() => setEstimatedResolutionTime(opt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
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

              {/* 4. Severity Level Segmented Control */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-tertiary" aria-hidden="true" />
                  <span>Severity Level</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Severity Level">
                  {[
                    { id: 'low', label: 'Low', activeStyle: 'bg-surface-container text-on-surface border-outline' },
                    { id: 'medium', label: 'Medium', activeStyle: 'bg-secondary/20 text-secondary border-secondary' },
                    { id: 'high', label: 'High', activeStyle: 'bg-tertiary/20 text-tertiary border-tertiary' },
                    { id: 'critical', label: 'Critical', activeStyle: 'bg-error-container text-on-error-container border-error' }
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
                        className={`h-12 rounded-xl text-xs font-extrabold transition-all border ${
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
                <label htmlFor="barrier-description-input" className="text-sm font-bold text-on-surface">
                  Detailed Description & Guidance Notes
                </label>
                <textarea
                  id="barrier-description-input"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the barrier, clearance dimensions, or workaround options..."
                  className="w-full p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 font-medium text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* 6. Photo Evidence (Optional) */}
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
                        'JPG, PNG up to 10MB'
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
                  className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold text-xs transition-colors"
                >
                  {attachedPhotoName ? 'Change Photo' : 'Attach Photo'}
                </button>
              </div>

              {/* Submit & Cancel Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 h-14 rounded-xl bg-primary text-on-primary font-extrabold text-base flex items-center justify-center gap-2 shadow-md hover:bg-primary-container transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                  <span>{isSubmitting ? 'Publishing Report...' : 'Publish Barrier Report'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleBackToFeed}
                  className="w-full sm:w-auto h-14 px-6 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/40 font-bold text-sm text-on-surface transition-colors"
                >
                  Cancel
                </button>
              </div>

            </form>

          </div>
        )}

      </div>
    </div>
  );
}

export default function CommunityConfidencePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-bold text-on-surface-variant">Loading Community Confidence...</div>}>
      <CommunityConfidenceContent />
    </Suspense>
  );
}
