import { Link } from 'react-router-dom';
import { categoryHref, getCategoryIcon } from './categoryVisuals';

export default function CategoryCircleGrid({ categories = [] }) {
  const safeCategories = Array.isArray(categories) ? categories.filter(Boolean) : [];
  if (safeCategories.length === 0) return null;

  return (
    <div className="rounded-card bg-paper p-6">
      <div className="rail gap-5">
        {safeCategories.map((category) => {
          const Icon = getCategoryIcon(category?.name || '');
          return (
            <Link
              key={category.id}
              to={categoryHref(category)}
              className="group flex w-[92px] shrink-0 snap-start flex-col items-center text-center"
            >
              <span className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-line transition group-hover:ring-brand">
                {category.banner_url || category.banner ? (
                  <img
                    src={category.banner_url || category.banner}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <Icon className="h-7 w-7 text-accent" />
                )}
              </span>
              <span className="mt-2 line-clamp-2 text-xs font-medium leading-snug text-ink group-hover:text-accent">
                {category.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
