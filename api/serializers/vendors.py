from django.db.models import Avg, Count, Q
from rest_framework import serializers

from Vendors.models import VendorStore
from products.models import Categories, Product

from ..utils import build_media_url
from .catalog import CategorySerializer, ProductListSerializer


class MediaURLField(serializers.ImageField):
    """Writable image field that returns a client-ready absolute URL."""

    def to_representation(self, value):
        return build_media_url(self.context.get("request"), value)


class VendorStoreSummarySerializer(serializers.ModelSerializer):
    logo = serializers.ImageField(read_only=True)

    class Meta:
        model = VendorStore
        fields = ["id", "name", "slug", "logo"]


class VendorStoreSerializer(serializers.ModelSerializer):
    logo = MediaURLField(required=False, allow_null=True)
    cover_photo = MediaURLField(required=False, allow_null=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    product_count = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    category_shelves = serializers.SerializerMethodField()

    class Meta:
        model = VendorStore
        fields = [
            "id",
            "user",
            "user_email",
            "name",
            "slug",
            "logo",
            "cover_photo",
            "is_official",
            "official_badge",
            "official_tagline",
            "created_at",
            "product_count",
            "categories",
            "category_shelves",
        ]
        read_only_fields = [
            "id",
            "user",
            "slug",
            "created_at",
            "is_official",
            "official_badge",
            "official_tagline",
        ]

    def get_product_count(self, obj):
        annotated = getattr(obj, "visible_product_count", None)
        if annotated is not None:
            return annotated
        return obj.product_set.count()

    def _storefront_data(self, obj):
        cache = getattr(self, "_storefront_cache", None)
        if cache is None:
            cache = {}
            self._storefront_cache = cache
        if obj.pk in cache:
            return cache[obj.pk]

        empty = {"categories": [], "shelves": []}
        if not self.context.get("include_storefront"):
            cache[obj.pk] = empty
            return empty

        visible = Q(
            product__vendor_stores=obj,
            product__moderation_status=Product.MODERATION_APPROVED,
        )
        categories = list(
            Categories.objects.filter(
                product__vendor_stores=obj,
                product__moderation_status=Product.MODERATION_APPROVED,
            )
            .prefetch_related("subcategories_set")
            .annotate(
                visible_product_count=Count("product", filter=visible, distinct=True)
            )
            .distinct()
            .order_by("id")
        )
        products = list(
            Product.objects.select_related("categories__industry", "vendor_stores")
            .prefetch_related("productimage_set", "categories__subcategories_set")
            .annotate(
                average_rating_annotated=Avg("productstarratingandreview__stars"),
                review_count_annotated=Count(
                    "productstarratingandreview", distinct=True
                ),
            )
            .filter(
                vendor_stores=obj,
                moderation_status=Product.MODERATION_APPROVED,
            )
            .order_by("-created_at")
        )

        category_context = {**self.context, "vendor_store": obj}
        category_data = CategorySerializer(
            categories, many=True, context=category_context
        ).data
        product_data = ProductListSerializer(
            products,
            many=True,
            context={**self.context, "skip_category_counts": True},
        ).data

        grouped_products = {}
        for product, payload in zip(products, product_data):
            grouped_products.setdefault(product.categories_id, []).append(payload)

        shelf_data = []
        for category in categories:
            shelf_products = grouped_products.get(category.id, [])[:6]
            if shelf_products:
                shelf_data.append(
                    {
                        "category": next(
                            item for item in category_data if item["id"] == category.id
                        ),
                        "products": shelf_products,
                    }
                )

        result = {"categories": category_data, "shelves": shelf_data}
        cache[obj.pk] = result
        return result

    def get_categories(self, obj):
        return self._storefront_data(obj)["categories"]

    def get_category_shelves(self, obj):
        return self._storefront_data(obj)["shelves"]
