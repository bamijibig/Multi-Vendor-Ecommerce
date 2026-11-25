import { AlertCircle, CheckCircle2, Loader2, PackageSearch, Star } from 'lucide-react';
import { classNames } from '../../lib/format';

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div className={classNames('flex items-center justify-center gap-2 py-16 text-slate-500', className)}>
      <Loader2 className="h-5 w-5 animate-spin text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Alert({ type = 'error', children, className = '' }) {
  if (!children) return null;
  const isSuccess = type === 'success';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={classNames(
        'flex items-start gap-2 rounded-md border px-3.5 py-3 text-sm',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-700',
        className
      )}
      role={isSuccess ? 'status' : 'alert'}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ title, message, action, icon: Icon = PackageSearch }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-slate-50 px-6 py-16 text-center">
      <Icon className="mb-4 h-10 w-10 text-slate-300" />
      <h3 className="text-lg font-semibold text-navy">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Pagination({ page = 1, numPages = 1, onChange }) {
  if (numPages <= 1) return null;
  const pages = Array.from({ length: numPages }, (_, index) => index + 1).filter(
    (item) => item === 1 || item === numPages || Math.abs(item - page) <= 1
  );

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        className="btn-outline px-3 py-2 text-xs"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      {pages.map((item, index) => (
        <span key={item} className="flex items-center gap-1.5">
          {index > 0 && item - pages[index - 1] > 1 && (
            <span className="px-1 text-slate-400">…</span>
          )}
          <button
            type="button"
            onClick={() => onChange(item)}
            className={classNames(
              'h-9 w-9 rounded-md text-sm font-medium transition',
              item === page
                ? 'bg-brand text-white'
                : 'border border-line bg-white text-navy hover:border-brand hover:text-brand'
            )}
          >
            {item}
          </button>
        </span>
      ))}
      <button
        type="button"
        className="btn-outline px-3 py-2 text-xs"
        disabled={page >= numPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

export function Rating({ value = 0, count, size = 'sm' }) {
  const starClass = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={classNames(
              starClass,
              star <= Math.round(value || 0)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-200 text-slate-200'
            )}
          />
        ))}
      </div>
      {typeof count === 'number' && (
        <span className="text-xs text-slate-400">({count})</span>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  const tone =
    status === 'Completed'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'Oder Shipped'
      ? 'bg-blue-50 text-blue-700'
      : status === 'Oder OnTheWay'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-slate-100 text-slate-600';
  return <span className={classNames('badge', tone)}>{status}</span>;
}
