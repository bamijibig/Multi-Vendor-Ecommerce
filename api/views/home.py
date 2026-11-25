from django.db.models import Avg, Count, Prefetch, Q
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from home.models import DisplayHotProductInCategories, PopularCategories, SliderArea
from products.models import Categories, Industry, Product
from Vendors.models import VendorStore

from ..serializers import (
    CategorySerializer,
    DisplayHotProductSerializer,
    IndustrySerializer,
    PopularCategorySerializer,
    ProductListSerializer,
    SliderAreaSerializer,
    VendorStoreSerializer,
)


class HomeView(APIView):
    """Everything the storefront home page needs in one request."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        visible_product = Q(
            moderation_status=Product.MODERATION_APPROVED
        ) & (
            Q(vendor_stores__isnull=True)
            | Q(vendor_stores__status=VendorStore.STATUS_ACTIVE)
        )
        category_visible = Q(
            product__moderation_status=Product.MODERATION_APPROVED
        ) & (
            Q(product__vendor_stores__isnull=True)
            | Q(product__vendor_stores__status=VendorStore.STATUS_ACTIVE)
        )

        category_queryset = (
            Categories.objects.select_related("industry")
            .prefetch_related("subcategories_set")
            .annotate(
                visible_product_count=Count(
                    "product", filter=category_visible, distinct=True
                )
            )
            .order_by("id")
        )
        categories = list(category_queryset)
        industries = (
            Industry.objects.prefetch_related(
                Prefetch("categories_set", queryset=category_queryset)
            )
            .order_by("name")
        )
        official_stores = (
            VendorStore.objects.filter(
                status=VendorStore.STATUS_ACTIVE, is_official=True
            )
            .annotate(
                visible_product_count=Count(
                    "product",
                    filter=Q(
                        product__moderation_status=Product.MODERATION_APPROVED
                    ),
                    distinct=True,
                )
            )
            .order_by("name")[:8]
        )

        products = list(
            Product.objects.select_related(
                "categories__industry", "vendor_stores"
            )
            .prefetch_related("productimage_set", "categories__subcategories_set")
            .annotate(
                average_rating_annotated=Avg("productstarratingandreview__stars"),
                review_count_annotated=Count(
                    "productstarratingandreview", distinct=True
                ),
            )
            .filter(visible_product)
            .order_by("-created_at")
        )

        context = {"request": request}
        category_data = CategorySerializer(
            categories, many=True, context=context
        ).data
        product_context = {**context, "skip_category_counts": True}
        product_data = ProductListSerializer(
            products, many=True, context=product_context
        ).data

        grouped_products = {}
        for product, payload in zip(products, product_data):
            grouped_products.setdefault(product.categories_id, []).append(payload)

        category_by_id = {category["id"]: category for category in category_data}
        category_shelves = []
        for category in categories:
            shelf_products = grouped_products.get(category.id, [])[:6]
            if shelf_products:
                category_shelves.append(
                    {
                        "category": category_by_id[category.id],
                        "products": shelf_products,
                    }
                )

        return Response(
            {
                "success": True,
                "slider": SliderAreaSerializer(
                    SliderArea.objects.all(), many=True, context=context
                ).data,
                "industries": IndustrySerializer(
                    industries, many=True, context=context
                ).data,
                "categories": category_data,
                "category_shelves": category_shelves,
                "official_stores": VendorStoreSerializer(
                    official_stores, many=True, context=context
                ).data,
                "hot_products_in_categories": DisplayHotProductSerializer(
                    DisplayHotProductInCategories.objects.select_related("categories")[:4],
                    many=True,
                    context=context,
                ).data,
                "trending_products": product_data[:8],
                "popular_categories": PopularCategorySerializer(
                    PopularCategories.objects.select_related("categories"),
                    many=True,
                    context=context,
                ).data,
            }
        )
