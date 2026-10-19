import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import {
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowDownUp,
  Lock,
  Info,
  LogIn,
  UserCog,
  FileText,
  User,
  Download,
  Activity,
  CalendarDays,
} from 'lucide-react';
import './AdminAuditLogsPage.css';

// All timestamps are rendered in Philippine Standard Time, matching the note
// at the foot of the page.
const ROLE_LABEL = {
  admin: 'Admin',
  officer: 'Officer',
  reporter: 'Resident',
};

const TARGET_LABEL = {
  AccidentReport: 'Report',
  AccidentCategory: 'Category',
  User: 'User',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'login', label: 'Login/Logout' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
];

const USER_TYPE_OPTIONS = [
  { value: '', label: 'All user types' },
  { value: 'admin', label: 'Admin' },
  { value: 'resident', label: 'Resident' },
];

/**
 * Human labels, category and colour for each action slug written by
 * AuditLog::record(). Anything unknown falls back to a humanised slug.
 */
const ACTION_META = {
  user_login: { label: 'User login', category: 'Authentication', tone: 'purple' },
  user_logout: { label: 'User logout', category: 'Authentication', tone: 'purple' },
  user_register: { label: 'Account created', category: 'Account', tone: 'blue' },
  update_profile: { label: 'Profile updated', category: 'Account', tone: 'amber' },
  submit_report: { label: 'Report submitted', category: 'Reports', tone: 'blue' },
  supplement_report: { label: 'Report supplemented', category: 'Reports', tone: 'blue' },
  verify_report: { label: 'Report verified', category: 'Reports', tone: 'green' },
  reject_report: { label: 'Report rejected', category: 'Reports', tone: 'red' },
  assign_officer: { label: 'Case assigned', category: 'Reports', tone: 'blue' },
  officer_update_status: { label: 'Case status updated', category: 'Reports', tone: 'amber' },
  request_additional_info: { label: 'Info requested', category: 'Reports', tone: 'amber' },
  close_report: { label: 'Report closed', category: 'Reports', tone: 'green' },
  archive_report: { label: 'Report archived', category: 'Reports', tone: 'red' },
  create_officer: { label: 'Officer created', category: 'Users', tone: 'blue' },
  update_user_account: { label: 'Account updated', category: 'Users', tone: 'amber' },
  update_user_role: { label: 'Role updated', category: 'Users', tone: 'amber' },
  update_user_status: { label: 'Status changed', category: 'Users', tone: 'amber' },
  create_category: { label: 'Category created', category: 'Categories', tone: 'blue' },
  update_category: { label: 'Category updated', category: 'Categories', tone: 'amber' },
  delete_category: { label: 'Category deleted', category: 'Categories', tone: 'red' },
  export_csv: { label: 'CSV exported', category: 'Export', tone: 'slate' },
  export_pdf: { label: 'PDF exported', category: 'Export', tone: 'slate' },
};

const CATEGORY_ICON = {
  Authentication: LogIn,
  Users: UserCog,
  Reports: FileText,
  Categories: FileText,
  Account: User,
  Export: Download,
  System: Activity,
};

const humanize = (value) =>
  (value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const metaFor = (action) =>
  ACTION_META[action] || { label: humanize(action) || 'Unknown action', category: 'System', tone: 'slate' };

const PH_OFFSET_MINUTES = 8 * 60;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

/**
 * Philippine wall-clock parts for an instant. Built by hand rather than via
 * toLocaleDateString, because ICU output differs per engine (en-CA is not
 * reliably "YYYY-MM-DD") and these values feed the API, not just the screen.
 * The Philippines has no daylight saving, so a fixed +08:00 is exact.
 */
const phParts = (value) => {
  const shifted = new Date(new Date(value).getTime() + PH_OFFSET_MINUTES * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
};

const dateKey = (value) => {
  const p = phParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

const todayYmd = () => dateKey(Date.now());

const addDays = (ymd, days) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

// "2026-10-19" -> "19 Oct 2026"
const formatShort = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${pad(d)} ${MONTHS_SHORT[m - 1]} ${y}`;
};

// 09:42 AM
const formatTime = (value) => {
  const p = phParts(value);
  const hour12 = p.hours % 12 === 0 ? 12 : p.hours % 12;
  return `${pad(hour12)}:${pad(p.minutes)} ${p.hours < 12 ? 'AM' : 'PM'}`;
};

const formatTimestamp = (value) => `${formatShort(dateKey(value))} · ${formatTime(value)}`;

const initials = (name) => {
  const parts = (name || 'System').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AVATAR_TONES = ['indigo', 'emerald', 'amber', 'rose', 'sky'];
const avatarTone = (userId) => AVATAR_TONES[Math.abs(Number(userId) || 0) % AVATAR_TONES.length];

const eventId = (log) =>
  `EVT-${dateKey(log.created_at).replace(/-/g, '')}-${String(log.id).padStart(4, '0')}`;

const groupLabel = (key) => {
  const today = todayYmd();
  if (key === today) return `Today · ${formatShort(key)}`;
  if (key === addDays(today, -1)) return `Yesterday · ${formatShort(key)}`;
  return formatShort(key);
};

const blank = { search: '', from: '', to: '', userType: '', action: '' };

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters are edited as a draft and only committed by "Apply filters",
  // which matches the toolbar's explicit apply button.
  const [draft, setDraft] = useState(() => ({ ...blank, from: todayYmd(), to: todayYmd() }));
  const [applied, setApplied] = useState(() => ({ ...blank, from: todayYmd(), to: todayYmd() }));
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const dateRef = useRef(null);
  const sortRef = useRef(null);

  // Close the popovers on an outside click.
  useEffect(() => {
    if (!dateOpen && !sortOpen) return undefined;

    const onDown = (event) => {
      if (dateOpen && dateRef.current && !dateRef.current.contains(event.target)) setDateOpen(false);
      if (sortOpen && sortRef.current && !sortRef.current.contains(event.target)) setSortOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dateOpen, sortOpen]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError('');

    api.admin
      .getAuditLogs({
        from_date: applied.from || undefined,
        to_date: applied.to || undefined,
        user_type: applied.userType || undefined,
        action: applied.action || undefined,
        search: applied.search || undefined,
        sort,
        page,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.data?.success) {
          const rows = res.data.data.data || [];
          setLogs(rows);
          setPagination(res.data.data);
          setSelectedId(rows.length ? rows[0].id : null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLogs([]);
        setPagination(null);
        setError(err.friendlyMessage || err.message || 'Failed to load audit records.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applied, sort, page]);

  const draftFrom = draft.from;
  const draftTo = draft.to;

  const setDraftField = (name, value) => setDraft((prev) => ({ ...prev, [name]: value }));

  const applyFilters = (event) => {
    event?.preventDefault();

    if (draftFrom && draftTo && draftFrom > draftTo) {
      setError('The end date cannot be earlier than the start date.');
      return;
    }

    setError('');
    setPage(1);
    setApplied({ ...draft });
  };

  const resetFilters = () => {
    setDraft({ ...blank });
    setApplied({ ...blank });
    setPage(1);
    setError('');
  };

  const choosePreset = (from, to) => {
    setDraft((prev) => ({ ...prev, from, to }));
  };

  // The field shows the concrete dates ("19 Oct 2026"); the chip shows the
  // friendly name ("Today"), matching the reference design.
  const rangeLabel = () => {
    const { from, to } = applied;
    if (!from && !to) return 'All time';
    if (from && to) {
      if (from === to) return formatShort(from);
      if (from.slice(0, 4) === to.slice(0, 4)) {
        return `${formatShort(from).slice(0, 6)} – ${formatShort(to)}`;
      }
      return `${formatShort(from)} – ${formatShort(to)}`;
    }
    if (from) return `From ${formatShort(from)}`;
    return `Until ${formatShort(to)}`;
  };

  const chipLabel = () => {
    const { from, to } = applied;
    if (from && to && from === to) {
      if (from === todayYmd()) return 'Today';
      if (from === addDays(todayYmd(), -1)) return 'Yesterday';
    }
    return rangeLabel();
  };

  const clearDates = () => {
    setDraft((prev) => ({ ...prev, from: '', to: '' }));
    setApplied((prev) => ({ ...prev, from: '', to: '' }));
    setPage(1);
  };

  // Group the current page's rows by calendar day for the date separators.
  const grouped = useMemo(() => {
    const rows = [];
    let lastKey = null;

    logs.forEach((log) => {
      const key = dateKey(log.created_at);
      if (key !== lastKey) {
        rows.push({ type: 'group', key });
        lastKey = key;
      }
      rows.push({ type: 'log', log });
    });

    return rows;
  }, [logs]);

  const pageNumbers = useMemo(() => {
    if (!pagination || pagination.last_page <= 1) return [];
    const last = pagination.last_page;
    const current = pagination.current_page;
    const start = Math.max(1, Math.min(current - 2, last - 4));
    const end = Math.min(last, start + 4);

    const numbers = [];
    for (let i = start; i <= end; i += 1) numbers.push(i);
    return numbers;
  }, [pagination]);

  const selected = logs.find((log) => log.id === selectedId) || null;
  const selectedMeta = selected ? metaFor(selected.action) : null;
  const selectedTone = selectedMeta?.tone || 'slate';
  const SelectedIcon = CATEGORY_ICON[selectedMeta?.category] || Activity;

  const datePresets = [
    { label: 'Today', from: todayYmd(), to: todayYmd() },
    { label: 'Yesterday', from: addDays(todayYmd(), -1), to: addDays(todayYmd(), -1) },
    { label: 'Last 7 days', from: addDays(todayYmd(), -6), to: todayYmd() },
    { label: 'Last 30 days', from: addDays(todayYmd(), -29), to: todayYmd() },
    { label: 'All time', from: '', to: '' },
  ];

  const total = pagination?.total ?? 0;

  return (
    <section className="panel active dashboard-container">
      <div className="atl-stack">
      {/* PANEL: HEADER */}
      <div className="phead">
        <div>
          <h2 className="hd">Security Audit Trail</h2>
          <p>Review administrative activity and investigate system changes.</p>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <form className="atl-toolbar" onSubmit={applyFilters}>
        <div className="atl-toolbar__grid">
          <div className="atl-field">
            <label className="atl-label" htmlFor="atl-search">Search activity</label>
            <div className="atl-search">
              <Search size={16} className="atl-search__icon" />
              <input
                id="atl-search"
                type="text"
                className="atl-input"
                placeholder="Search user, action or report…"
                value={draft.search}
                onChange={(e) => setDraftField('search', e.target.value)}
              />
            </div>
          </div>

          <div className="atl-field atl-date-wrap" ref={dateRef}>
            <span className="atl-label">Date range</span>
            <button
              type="button"
              className="atl-date-btn"
              onClick={() => setDateOpen((v) => !v)}
              aria-expanded={dateOpen}
              aria-haspopup="dialog"
            >
              <span>
                <CalendarDays size={15} />
                {rangeLabel()}
              </span>
              <ChevronDown size={15} />
            </button>

            {dateOpen && (
              <div className="atl-pop" role="dialog" aria-label="Choose a date range">
                <div className="atl-pop__presets">
                  {datePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="atl-preset"
                      onClick={() => choosePreset(preset.from, preset.to)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="atl-custom">
                  <div>
                    <span className="atl-label">From</span>
                    <input
                      type="date"
                      className="atl-input"
                      value={draftFrom}
                      max={draftTo || undefined}
                      onChange={(e) => setDraftField('from', e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="atl-label">To</span>
                    <input
                      type="date"
                      className="atl-input"
                      value={draftTo}
                      min={draftFrom || undefined}
                      onChange={(e) => setDraftField('to', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="atl-field">
            <label className="atl-label" htmlFor="atl-user-type">User type</label>
            <select
              id="atl-user-type"
              className="atl-select"
              value={draft.userType}
              onChange={(e) => setDraftField('userType', e.target.value)}
            >
              {USER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="atl-field">
            <label className="atl-label" htmlFor="atl-action">Action</label>
            <select
              id="atl-action"
              className="atl-select"
              value={draft.action}
              onChange={(e) => setDraftField('action', e.target.value)}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="atl-actions">
            <button type="submit" className="atl-btn-apply">Apply filters</button>
            <button type="button" className="atl-btn-reset" onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </form>

      {/* ACTIVE FILTER CHIP + COUNT + SORT */}
      <div className="atl-chipbar">
        <div className="atl-chipbar__left">
          {(applied.from || applied.to) && (
            <span className="atl-chip">
              {chipLabel()}
              <button type="button" onClick={clearDates} aria-label="Clear the date filter">
                <X size={13} />
              </button>
            </span>
          )}
          <span className="atl-count">
            {total} {total === 1 ? 'event' : 'events'}
          </span>
        </div>

        <div className="atl-sort" ref={sortRef}>
          <button
            type="button"
            className="atl-sort__btn"
            onClick={() => setSortOpen((v) => !v)}
            aria-expanded={sortOpen}
            aria-haspopup="menu"
          >
            <ArrowDownUp size={14} />
            {sort === 'newest' ? 'Newest first' : 'Oldest first'}
            <ChevronDown size={14} />
          </button>

          {sortOpen && (
            <div className="atl-menu" role="menu">
              {[
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  className={sort === option.value ? 'on' : ''}
                  onClick={() => {
                    setSort(option.value);
                    setPage(1);
                    setSortOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ACTIVITY LOG + SELECTED EVENT */}
      <div className="atl-grid">
        <div className="atl-card">
          <div className="atl-card__head">
            <h3>Activity log</h3>
            <span className="atl-readonly"><Lock size={13} /> Read-only records</span>
          </div>

          {error ? (
            <div className="atl-error">{error}</div>
          ) : loading ? (
            <div className="atl-state">Loading audit events…</div>
          ) : logs.length === 0 ? (
            <div className="atl-state">
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                No audit records found
              </div>
              No system events matched your current filters.
            </div>
          ) : (
            <div className="atl-tablewrap">
              <table className="atl-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Acting user</th>
                    <th>Action type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped.map((item) => {
                    if (item.type === 'group') {
                      return (
                        <tr className="atl-grouprow" key={`group-${item.key}`}>
                          <td colSpan={4}>{groupLabel(item.key)}</td>
                        </tr>
                      );
                    }

                    const { log } = item;
                    const meta = metaFor(log.action);
                    const isSelected = log.id === selectedId;

                    return (
                      <tr
                        key={log.id}
                        className={`atl-row${isSelected ? ' is-selected' : ''}`}
                        tabIndex={0}
                        onClick={() => setSelectedId(log.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId(log.id);
                          }
                        }}
                      >
                        <td>
                          <div className="atl-time">{formatTime(log.created_at)}</div>
                          <div className="atl-time-sub">PHT · UTC+08:00</div>
                        </td>
                        <td>
                          <div className="atl-user">
                            <span className={`atl-avatar atl-avatar--${log.user ? avatarTone(log.user.id) : 'slate'}`}>
                              {initials(log.user?.name)}
                            </span>
                            <div>
                              <div className="atl-user__name">{log.user?.name || 'System / Guest'}</div>
                              <div className="atl-user__role">
                                {log.user ? (ROLE_LABEL[log.user.role] || log.user.role) : 'Automated'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`atl-pill atl-pill--${meta.tone}`}>{meta.label}</span>
                        </td>
                        <td className="atl-desc">{log.description || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="atl-pagination">
            <span>
              {total
                ? `Showing ${pagination.from}–${pagination.to} of ${total} events`
                : 'Showing 0 events'}
            </span>

            {pageNumbers.length > 0 && (
              <div className="atl-pager">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.current_page <= 1 || loading}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>

                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n === pagination.current_page ? 'is-current' : ''}
                    onClick={() => setPage(n)}
                    disabled={loading}
                  >
                    {n}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
                  disabled={pagination.current_page >= pagination.last_page || loading}
                  aria-label="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SELECTED EVENT PANEL */}
        <aside className="atl-detail">
          {selected ? (
            <>
              <div className="atl-detail__top">
                <span className="atl-detail__eyebrow">Selected event</span>
                <span className={`atl-detail__icon atl-detail__icon--${selectedTone}`}>
                  <SelectedIcon size={17} />
                </span>
              </div>

              <h3 className="atl-detail__title">{selectedMeta.label}</h3>
              <span className={`atl-pill atl-pill--${selectedTone}`}>{selectedMeta.category}</span>

              <div className="atl-detail__rows">
                <div className="atl-detail__row">
                  <label>Event ID</label>
                  <div className="atl-mono">{eventId(selected)}</div>
                </div>
                <div className="atl-detail__row">
                  <label>Timestamp</label>
                  <div>{formatTimestamp(selected.created_at)}</div>
                </div>
                <div className="atl-detail__row">
                  <label>Acting user</label>
                  <div>{selected.user?.name || 'System / Guest'}</div>
                </div>
                <div className="atl-detail__row">
                  <label>Role</label>
                  <div>
                    {selected.user
                      ? (ROLE_LABEL[selected.user.role] || selected.user.role)
                      : 'Automated'}
                  </div>
                </div>
                <div className="atl-detail__row">
                  <label>Reference</label>
                  <div>
                    {selected.target_type
                      ? `${TARGET_LABEL[selected.target_type] || humanize(selected.target_type)} · #${selected.target_id ?? '—'}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="atl-detail__desc-wrap">
                <label>Description</label>
                <div className="atl-detail__desc">
                  {selected.description || 'No description recorded.'}
                </div>
              </div>

              <div className="atl-detail__foot">
                <Lock size={13} /> Audit entries are read-only.
              </div>
            </>
          ) : (
            <div className="atl-detail--empty">
              <Activity size={22} />
              <div>Select an event to inspect its details.</div>
            </div>
          )}
        </aside>
      </div>

      <div className="atl-note">
        <Info size={13} /> All timestamps shown in Philippine Standard Time (UTC+08:00).
      </div>
      </div>
    </section>
  );
}
