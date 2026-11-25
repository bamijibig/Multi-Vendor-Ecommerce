"""Product/catalog filtering used by the product list endpoint."""

import django_filters
from django.db.models import Q

from products.models import Product


class ProductFilter(django_filters.FilterSet):
    """Supports the filters exposed in the React shop sidebar."""

    search = django_filters.CharFilter(method="filter_search")
    category = django_filters.CharFilter(method="filter_category")
    category_slug = django_filters.CharFilter(field_name="categories__slug", lookup_expr="iexact")
    industry = django_filters.NumberFilter(field_name="categories__industry_id")
    industry_slug = django_filters.CharFilter(
        field_name="categories__industry__slug", lookup_expr="iexact"
    )
    subcategory = django_filters.NumberFilter(method="filter_subcategory")
    vendor_store = django_filters.NumberFilter(field_name="vendor_stores_id")
    vendor_slug = django_filters.CharFilter(field_name="vendor_stores__slug", lookup_expr="iexact")
    min_price = django_filters.NumberFilter(method="filter_min_price")
    max_price = django_filters.NumberFilter(method="filter_max_price")
    in_stock = django_filters.BooleanFilter(field_name="out_of_stoc", exclude=True)
    tag = django_filters.CharFilter(method="filter_tag")

    class Meta:
        model = Product
        fields = ["categories", "vendor_stores", "modle", "out_of_stoc"]

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(title__icontains=value)
            | Q(description__icontains=value)
            | Q(tag__icontains=value)
        )

    def filter_category(self, queryset, name, value):
        """Accept either a category id or slug in the friendly `category` param."""
        value = str(value or "").strip()
        if not value:
            return queryset
        if value.isdigit():
            return queryset.filter(categories_id=value)
        return queryset.filter(categories__slug__iexact=value)

    def filter_subcategory(self, queryset, name, value):
        # Products do not have a direct subcategory FK; match by category slug
        # derived from the subcategory, keeping the existing schema untouched.
        from products.models import SubCategories

        subcategory = SubCategories.objects.filter(pk=value).select_related("categories").first()
        if not subcategory:
            return queryset.none()
        return queryset.filter(categories=subcategory.categories)

    def filter_min_price(self, queryset, name, value):
        # discounted_price is a Python property, so filter with the same formula
        # at the database level.
        return queryset.extra(
            where=["(regular_price - (regular_price * discounted_parcent / 100.0)) >= %s"],
            params=[value],
        )

    def filter_max_price(self, queryset, name, value):
        return queryset.extra(
            where=["(regular_price - (regular_price * discounted_parcent / 100.0)) <= %s"],
            params=[value],
        )

    def filter_tag(self, queryset, name, value):
        return queryset.filter(tag__icontains=value)
