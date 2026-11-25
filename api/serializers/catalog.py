from django.core.validators import MaxValueValidator
from django.db.models import Avg, Count, Q
from rest_framework import serializers

from products.models import (
    Categories,
    Industry,
    Product,
    ProductAditionalInformation,
    ProductImage,
    ProductStarRatingAndReview,
    SubCategories,
)

from Vendors.models import VendorStore

from ..permissions import is_admin, is_vendor
from ..utils import build_media_url


class SubCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SubCategories
        fields = ["id", "name", "slug", "categories"]


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubCategorySerializer(source="subcategories_set", many=True, read_only=True)
    industry_name = serializers.CharField(source="industry.name", read_only=True)
    banner = serializers.SerializerMethodField()
    banner_url = serializers.SerializerMethodField()
    product_count = serializers.SerializerMethodField()

    class Meta:
        model = Categories
        fields = [
            "id",
            "name",
            "slug",
            "industry",
            "industry_name",
            "tagline",
            "banner",
            "banner_url",
            "product_count",
            "subcategories",
        ]

    def get_banner(self, obj):
        return build_media_url(self.context.get("request"), obj.banner)

    def get_banner_url(self, obj):
        return self.get_banner(obj)

    def get_product_count(self, obj):
        annotated = getattr(obj, "visible_product_count", None)
        if annotated is not None:
            return annotated
        if self.context.get("skip_category_counts"):
            return None
        store = self.context.get("vendor_store")
        queryset = Product.objects.filter(
            categories=obj, moderation_status=Product.MODERATION_APPROVED
        )
        if store is not None:
            queryset = queryset.filter(vendor_stores=store)
        else:
            queryset = queryset.filter(
                Q(vendor_stores__isnull=True)
                | Q(vendor_stores__status=VendorStore.STATUS_ACTIVE)
            )
        return queryset.count()


class IndustrySerializer(serializers.ModelSerializer):
    categories = CategorySerializer(source="categories_set", many=True, read_only=True)

    class Meta:
        model = Industry
        fields = ["id", "name", "slug", "categories"]


class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "image", "url", "upload_at"]

    def get_url(self, obj):
        return build_media_url(self.context.get("request"), obj.image)


class ProductImageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image"]


class ProductAdditionalInformationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAditionalInformation
        fields = ["id", "specification", "details"]


class ProductListSerializer(serializers.ModelSerializer):
    """Card representation used on the home page, shop and cart."""

    category = CategorySerializer(source="categories", read_only=True)
    vendor_store = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_percent = serializers.IntegerField(source="discounted_parcent", read_only=True)
    primary_image = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()
    tag_list = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "slug",
            "regular_price",
            "discounted_parcent",
            "discount_percent",
            "discounted_price",
            "primary_image",
            "stoc",
            "out_of_stoc",
            "in_stock",
            "modle",
            "tag",
            "tag_list",
            "categories",
            "category",
            "vendor_stores",
            "vendor_store",
            "average_rating",
            "review_count",
            "created_at",
        ]

    def _images(self, obj):
        images = getattr(obj, "prefetched_images", None)
        if images is None:
            images = list(obj.productimage_set.all())
        return images

    def get_vendor_store(self, obj):
        store = obj.vendor_stores
        if not store:
            return None
        return {
            "id": store.id,
            "name": store.name,
            "slug": store.slug,
            "logo": build_media_url(self.context.get("request"), store.logo),
            "is_official": store.is_official,
            "official_badge": store.official_badge or "Official Store",
            "official_tagline": store.official_tagline,
        }

    def get_discounted_price(self, obj):
        return round(obj.discounted_price, 2)

    def get_primary_image(self, obj):
        images = self._images(obj)
        return build_media_url(self.context.get("request"), images[0].image) if images else None

    def _rating_and_count(self, obj):
        if hasattr(obj, "average_rating_annotated"):
            return obj.average_rating_annotated, obj.review_count_annotated
        data = ProductStarRatingAndReview.objects.filter(product_id=obj.pk).aggregate(
            avg=Avg("stars"), count=Count("id")
        )
        return data["avg"], data["count"]

    def get_average_rating(self, obj):
        avg, _ = self._rating_and_count(obj)
        return round(avg, 2) if avg is not None else None

    def get_review_count(self, obj):
        _, count = self._rating_and_count(obj)
        return count

    def get_in_stock(self, obj):
        return not obj.out_of_stoc and obj.stoc > 0

    def get_tag_list(self, obj):
        return [tag.strip() for tag in (obj.tag or "").split(",") if tag.strip()]


class ProductReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.first_name", read_only=True)
    review_images = serializers.ImageField(required=False, allow_null=True)
    product_title = serializers.CharField(source="product.title", read_only=True)

    class Meta:
        model = ProductStarRatingAndReview
        fields = [
            "id",
            "product",
            "product_title",
            "user",
            "user_name",
            "stars",
            "review_message",
            "review_images",
            "created_at",
        ]
        read_only_fields = ["id", "user", "created_at", "product_title"]


class ProductWriteSerializer(serializers.ModelSerializer):
    """Create/update payload restricted to fields vendors may manage."""

    discounted_parcent = serializers.IntegerField(
        min_value=0, max_value=100, validators=[MaxValueValidator(100)]
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "title",
            "regular_price",
            "stoc",
            "out_of_stoc",
            "discounted_parcent",
            "description",
            "modle",
            "categories",
            "tag",
            "details_description",
            "vendor_stores",
        ]
        read_only_fields = ["id"]

    def validate_vendor_stores(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if value is None:
            return value
        if not is_admin(user) and value.user_id != getattr(user, "id", None):
            raise serializers.ValidationError("You can only assign products to your own store.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if is_vendor(user) and not is_admin(user):
            # Vendors always write into one of their own stores; an existing
            # product cannot be moved to a different vendor's store.
            store = self.instance.vendor_stores if self.instance else attrs.get("vendor_stores")
            if store is None:
                store = user.vendorstore_set.first()
                if store is None:
                    raise serializers.ValidationError(
                        {"vendor_stores": "Create a vendor store before adding products."}
                    )
            if store.user_id != user.id:
                raise serializers.ValidationError(
                    {"vendor_stores": "You can only assign products to your own store."}
                )
            attrs["vendor_stores"] = store
        return attrs


class ProductDetailSerializer(ProductListSerializer):
    images = serializers.SerializerMethodField()
    additional_information = ProductAdditionalInformationSerializer(
        source="productaditionalinformation_set", many=True, read_only=True
    )
    description = serializers.CharField()
    details_description = serializers.CharField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "description",
            "details_description",
            "images",
            "additional_information",
        ]

    def get_images(self, obj):
        request = self.context.get("request")
        return [
            {"id": image.id, "url": build_media_url(request, image.image)}
            for image in self._images(obj)
        ]
