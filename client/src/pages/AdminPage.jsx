import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const PROVIDER_META = {
    cloudinary: { label: 'Cloudinary', dot: 'bg-primary' },
    supabase: { label: 'Supabase', dot: 'bg-accent-green' },
    local: { label: 'Local', dot: 'bg-hairline' },
};

const PROVIDER_ORDER = ['cloudinary', 'supabase', 'local'];
const OPERATION_OPTIONS = ['All', 'upload', 'download', 'delete', 'healthCheck'];

const formatLastFailure = (lastFailure) => {
    if (!lastFailure) return 'Never';
    const diffMs = Date.now() - new Date(lastFailure).getTime();
    if (diffMs < 0) return 'Just now';

    const minutes = Math.floor(diffMs / (60 * 1000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
};

const formatTimestamp = (ts) => {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString();
};

const getProviderBadgeColor = (p) => {
    if (p === 'cloudinary') return 'blue';
    if (p === 'supabase') return 'green';
    return 'gray';
};

const getOperationBadgeColor = (op) => {
    if (op === 'upload') return 'blue';
    if (op === 'download') return 'green';
    if (op === 'delete') return 'orange';
    if (op === 'healthCheck') return 'gray';
    return 'gray';
};

export const AdminPage = () => {
    const { showToast } = useToast();

    // Health + queue state
    const [providers, setProviders] = useState([]);
    const [queueStats, setQueueStats] = useState({ waiting: 0, active: 0, failed: 0 });
    const [healthError, setHealthError] = useState('');

    // Failure log state
    const [failuresLoading, setFailuresLoading] = useState(true);
    const [failures, setFailures] = useState([]);
    const [failurePage, setFailurePage] = useState(1);
    const [failurePages, setFailurePages] = useState(1);
    const [failureTotal, setFailureTotal] = useState(0);
    const [providerFilter, setProviderFilter] = useState('All');
    const [operationFilter, setOperationFilter] = useState('All');

    const [activeTab, setActiveTab] = useState('health');

    // Fetch health + queue (auto-refresh every 30s)
    const fetchHealth = useCallback(async () => {
        try {
            const data = await apiFetch('/api/health/storage');
            setProviders(data.providers || []);
            setQueueStats(data.queue || { waiting: 0, active: 0, failed: 0 });
            setHealthError('');
        } catch (err) {
            setHealthError(err.message || 'Failed to load storage health');
            showToast(err.message || 'Failed to load storage health', 'error');
        }
    }, [showToast]);

    // Fetch failure logs with filters + pagination
    const fetchFailures = useCallback(async () => {
        try {
            setFailuresLoading(true);
            const params = new URLSearchParams({ limit: '20', page: String(failurePage) });
            if (providerFilter && providerFilter !== 'All') params.set('provider', providerFilter);
            if (operationFilter && operationFilter !== 'All') params.set('operation', operationFilter);

            const data = await apiFetch(`/api/admin/failures?${params.toString()}`);
            setFailures(data.failures || []);
            setFailurePages(data.pagination?.pages || 1);
            setFailureTotal(data.pagination?.total || 0);
        } catch (err) {
            showToast(err.message || 'Failed to fetch failure logs', 'error');
            setFailures([]);
            setFailurePages(1);
            setFailureTotal(0);
        } finally {
            setFailuresLoading(false);
        }
    }, [failurePage, providerFilter, operationFilter, showToast]);

    // Initial load + 30s auto-refresh for health (and queue stats)
    useEffect(() => {
        fetchHealth();
        const healthInterval = setInterval(fetchHealth, 30000);
        return () => clearInterval(healthInterval);
    }, [fetchHealth]);

    // Fetch failure logs on mount and whenever page or filters change
    useEffect(() => {
        fetchFailures();
    }, [fetchFailures]);

    // Filter change handlers — reset to page 1 (fetch re-runs via dependency above)
    const handleProviderFilterChange = (e) => {
        setProviderFilter(e.target.value);
        setFailurePage(1);
    };

    const handleOperationFilterChange = (e) => {
        setOperationFilter(e.target.value);
        setFailurePage(1);
    };

    const handleFilterApply = () => {
        setFailurePage(1);
        fetchFailures();
    };

    // Map provider records to display order
    const providerRecords = PROVIDER_ORDER
        .map((key) => {
            const meta = PROVIDER_META[key];
            const record = providers.find((p) => p.provider === key) || {};
            return { key, meta, record };
        })
        .filter(({ meta }) => !!meta);

    return (
        <AppShell>
            <div className="space-y-6 text-left select-none">
                {/* Top bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-ink">Admin Panel</h1>
                        <p className="text-xs text-ink-muted mt-0.5">Storage health, failure logs, and queue monitoring.</p>
                    </div>
                    <Badge color="gray">Auto-refresh: 30s</Badge>
                </div>

                {/* Tab switcher */}
                <div className="flex gap-1 bg-canvas-soft rounded-lg p-1 w-fit">
                    <button
                        onClick={() => setActiveTab('health')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${activeTab === 'health' ? 'bg-surface text-ink shadow-level-1' : 'text-ink-muted hover:text-ink-secondary'
                            }`}
                    >
                        Health & Queue
                    </button>
                    <button
                        onClick={() => setActiveTab('failures')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${activeTab === 'failures' ? 'bg-surface text-ink shadow-level-1' : 'text-ink-muted hover:text-ink-secondary'
                            }`}
                    >
                        Failure Log
                    </button>
                </div>

                {/* ─── PROVIDER HEALTH + QUEUE STATS ─── */}
                {activeTab === 'health' && (
                    <div className="space-y-6">
                        {/* Provider health cards */}
                        <div>
                            <h2 className="text-sm font-bold text-ink mb-3">Provider Health</h2>
                            {healthError && !providers.length ? (
                                <EmptyState
                                    icon="⚠️"
                                    title="Failed to load provider health"
                                    description={healthError}
                                />
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {providerRecords.map(({ key, meta, record }) => (
                                        <Card key={key} className="bg-surface border border-hairline !p-5">
                                            <div className="flex items-center gap-2.5 mb-3">
                                                <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                                                <span className="text-sm font-bold text-ink">{meta.label}</span>
                                            </div>

                                            <div className="flex items-center gap-2 mb-4">
                                                <span
                                                    className={`w-2 h-2 rounded-full ${record.healthy ? 'bg-accent-green' : 'bg-accent-orange'}`}
                                                    aria-hidden="true"
                                                />
                                                <span className={`text-xs font-semibold ${record.healthy ? 'text-accent-green' : 'text-accent-orange'}`}>
                                                    {record.healthy ? 'Healthy' : 'Unhealthy'}
                                                </span>
                                            </div>

                                            <div className="space-y-2 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-ink-muted">Latency</span>
                                                    <span className="font-semibold text-ink-secondary">
                                                        {record.latency != null ? `${record.latency}ms` : '—'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-ink-muted">Failures (24h)</span>
                                                    <span className="font-semibold text-ink-secondary">
                                                        {record.failures24h != null ? record.failures24h : '0'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-ink-muted">Last failure</span>
                                                    <span className="font-semibold text-ink-secondary">
                                                        {formatLastFailure(record.lastFailure)}
                                                    </span>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Queue stats */}
                        <div>
                            <h2 className="text-sm font-bold text-ink mb-3">Queue Stats</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Card className="bg-surface border border-hairline !p-5">
                                    <p className="text-xs text-ink-muted mb-1">Waiting jobs</p>
                                    <p className="text-2xl font-bold text-ink">{queueStats.waiting || 0}</p>
                                </Card>
                                <Card className="bg-surface border border-hairline !p-5">
                                    <p className="text-xs text-ink-muted mb-1">Active jobs</p>
                                    <p className="text-2xl font-bold text-ink">{queueStats.active || 0}</p>
                                </Card>
                                <Card className="bg-surface border border-hairline !p-5">
                                    <p className="text-xs text-ink-muted mb-1">Failed jobs</p>
                                    <p className="text-2xl font-bold text-ink">{queueStats.failed || 0}</p>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── FAILURE LOG ─── */}
                {activeTab === 'failures' && (
                    <div className="space-y-4">
                        {/* Filter bar */}
                        <Card className="bg-surface border border-hairline !p-4 flex flex-col sm:flex-row sm:items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Provider</label>
                                <select
                                    value={providerFilter}
                                    onChange={handleProviderFilterChange}
                                    className="w-full sm:w-auto px-3 py-2 text-sm bg-surface border border-hairline rounded-xs focus:outline-none focus:border-primary text-ink cursor-pointer"
                                >
                                    {['All', 'cloudinary', 'supabase', 'local'].map((p) => (
                                        <option key={p} value={p}>
                                            {p === 'All' ? 'All' : PROVIDER_META[p]?.label || p}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-ink-secondary mb-1.5">Operation</label>
                                <select
                                    value={operationFilter}
                                    onChange={handleOperationFilterChange}
                                    className="w-full sm:w-auto px-3 py-2 text-sm bg-surface border border-hairline rounded-xs focus:outline-none focus:border-primary text-ink cursor-pointer"
                                >
                                    {OPERATION_OPTIONS.map((op) => (
                                        <option key={op} value={op}>
                                            {op}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button onClick={handleFilterApply} variant="secondary" size="sm" className="shrink-0">
                                Apply Filters
                            </Button>
                            <div className="sm:ml-auto text-right">
                                <Badge color="gray">{failureTotal} total</Badge>
                            </div>
                        </Card>

                        {/* Failure table */}
                        <Card className="bg-surface border border-hairline !p-0 overflow-hidden">
                            {failuresLoading ? (
                                <div className="flex justify-center py-12">
                                    <Spinner size="md" />
                                </div>
                            ) : failures.length === 0 ? (
                                <div className="p-6">
                                    <EmptyState
                                        icon="✅"
                                        title="No failures logged"
                                        description="Your storage system is running perfectly."
                                    />
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-hairline text-ink-muted text-xs bg-canvas-soft/50">
                                                <th className="py-3 font-medium pl-4">Timestamp</th>
                                                <th className="py-3 font-medium">Provider</th>
                                                <th className="py-3 font-medium">Operation</th>
                                                <th className="py-3 font-medium">Error Message</th>
                                                <th className="py-3 font-medium pr-4">Resolved Provider</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-hairline">
                                            {failures.map((failure, idx) => (
                                                <tr key={failure._id || idx} className="text-ink-secondary hover:bg-canvas-soft/50">
                                                    <td className="py-3 pl-4 text-xs text-ink-muted whitespace-nowrap">
                                                        {formatTimestamp(failure.timestamp)}
                                                    </td>
                                                    <td className="py-3 text-xs">
                                                        <Badge color={getProviderBadgeColor(failure.provider)}>
                                                            {PROVIDER_META[failure.provider]?.label || failure.provider}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 text-xs">
                                                        <Badge color={getOperationBadgeColor(failure.operation)}>
                                                            {failure.operation}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 text-xs text-ink-muted max-w-[280px] truncate" title={failure.errorMessage}>
                                                        {failure.errorMessage}
                                                    </td>
                                                    <td className="py-3 pr-4 text-xs">
                                                        {failure.resolvedProvider ? (
                                                            <Badge color={getProviderBadgeColor(failure.resolvedProvider)}>
                                                                {PROVIDER_META[failure.resolvedProvider]?.label || failure.resolvedProvider}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-ink-faint">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {!failuresLoading && failures.length > 0 && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-hairline">
                                    <span className="text-xs text-ink-muted">
                                        Page {failurePage} of {failurePages}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => setFailurePage((prev) => Math.max(prev - 1, 1))}
                                            disabled={failurePage === 1}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            onClick={() => setFailurePage((prev) => Math.min(prev + 1, failurePages))}
                                            disabled={failurePage === failurePages}
                                            variant="secondary"
                                            size="sm"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </AppShell>
    );
};

export default AdminPage;

