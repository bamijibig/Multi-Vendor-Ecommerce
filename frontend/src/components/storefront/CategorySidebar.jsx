import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { categoryHref, getCategoryIcon } from './categoryVisuals';

export function MobileCategoryPills({ categories = [] }) {
  if (!categories.length) return null;
  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
      {categories.map((category) => {
        const Icon = getCategoryIcon(category.name);
        return (
          <Link
            key={category.id}
            to={categoryHref(category)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-navy shadow-sm transition hover:border-brand hover:text-brand"
          >
            <Icon className="h-3.5 w-3.5 text-brand" />
            {category.name}
          </Link>
        );
      })}
    </div>
  );
}

export default function CategorySidebar({ categories = [] }) {
  if (!categories.length) return null;

  return (
    <aside className="hidden min-w-0 lg:block">
      <div className="overflow-visible rounded-xl border border-line bg-paper shadow-card">
        <div className="flex items-center gap-2 border-b border-line px-3.5 py-3">
          <LayoutGrid className="h-4 w-4 text-brand" />
          <h2 className="font-display text-sm font-bold text-navy">All Categories</h2>
        </div>
        <ul className="py-1">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.name);
            const subcategories = category.subcategories || [];
            return (
              <li key={category.id} className="group relative">
                <Link
                  to={categoryHref(category)}
                  className="flex items-center gap-2.5 px-3.5 py-1.5 text-[12.5px] font-medium text-slate-600 transition hover:bg-brand-light/60 hover:text-brand"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-brand" />
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  {subcategories.length > 0 && (
                    <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
                  )}
                </Link>

                {subcategories.length > 0 && (
                  <div className="invisible absolute left-[calc(100%-6px)] top-0 z-50 w-64 translate-x-1 rounded-xl border border-line bg-paper p-3 opacity-0 shadow-lift transition duration-150 group-focus-within:visible group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100">
                    <p className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand">
                      {category.name}
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {subcategories.slice(0, 8).map((subcategory) => (
                        <li key={subcategory.id}>
                          <Link
                            to={categoryHref(category)}
                            className="block rounded-md px-2 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 hover:text-brand"
                          >
                            {subcategory.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={categoryHref(category)}
                      className="mt-2 flex items-center justify-between border-t border-line px-2 pt-2 text-xs font-semibold text-brand"
                    >
                      Shop all {category.name}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
