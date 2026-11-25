import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[55vh] flex-col items-center justify-center py-16 text-center">
      <Compass className="h-14 w-14 text-brand" />
      <h1 className="mt-4 text-3xl font-semibold text-navy">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The page you requested does not exist, or the product or store may have
        been removed.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/" className="btn-primary">Back home</Link>
        <Link to="/shop" className="btn-outline">Browse the shop</Link>
      </div>
    </div>
  );
}
