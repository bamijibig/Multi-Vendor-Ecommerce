from django.db.models import Avg, Count, Prefetch, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from Vendors.models import VendorStore
from products.models import (
    Categories,
    Industry,
    Product,
    ProductAditionalInformation,
    ProductImage,
    ProductStarRatingAndReview,
    SubCategories,
)

from ..filters import ProductFilter
from ..pagination import StandardResultsSetPagination
from ..permissions import CanManageProducts, IsCustomer, IsVendor, is_admin, is_vendor
from ..serializers import (
    CategorySerializer,
    IndustrySerializer,
    ProductAdditionalInformationSerializer,
    ProductDetailSerializer,
    ProductImageCreateSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    ProductReviewSerializer,
    ProductWriteSerializer,
    SubCategorySerializer,
)


def visible_category_queryset():
    visible_product = Q(product__moderation_status=Product.MODERATION_APPROVED) & (
        Q(product__vendor_stores__isnull=True)
        | Q(product__vendor_stores__status=VendorStore.STATUS_ACTIVE)
    )
    return (
        Categories.objects.select_related("industry")
        .prefetch_related("subcategories_set")
        .annotate(
            visible_product_count=Count(
                "product", filter=visible_product, distinct=True
            )
        )
        .order_by("id")
    )


class IndustryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Industry.objects.prefetch_related(
        Prefetch("categories_set", queryset=visible_category_queryset())
    ).order_by("name")
    serializer_class = IndustrySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = visible_category_queryset()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["industry"]


class SubCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SubCategories.objects.select_related("categories").order_by("name")
    serializer_class = SubCategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["categories"]


class ProductViewSet(viewsets.ModelViewSet):
    """Public catalog with vendor/admin-only writes."""

    permission_classes = [CanManageProducts]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ProductFilter
    search_fields = ["title", "description", "tag"]
    ordering_fields = ["created_at", "regular_price", "title", "discounted_parcent"]
    ordering = ["-created_at"]
    lookup_field = "slug"

    def get_queryset(self):
        queryset = (
            Product.objects.select_related("categories__industry", "vendor_stores")
            .prefetch_related(
                "productimage_set",
                "productaditionalinformation_set",
                "categories__subcategories_set",
            )
            .annotate(
                average_rating_annotated=Avg("productstarratingandreview__stars"),
                review_count_annotated=Count(
                    "productstarratingandreview", distinct=True
                ),
            )
        )
        if self.action == "my_products":
            return queryset.filter(vendor_stores__user=self.request.user)

        public_visibility = Q(
            moderation_status=Product.MODERATION_APPROVED
        ) & (
            Q(vendor_stores__isnull=True)
            | Q(vendor_stores__status=VendorStore.STATUS_ACTIVE)
        )
        user = self.request.user
        if is_admin(user):
            return queryset
        if is_vendor(user):
            return queryset.filter(Q(vendor_stores__user=user) | public_visibility)
        return queryset.filter(public_visibility)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Category counts are already provided by category shelves/endpoints;
        # avoid a COUNT query for every product card's nested category.
        context["skip_category_counts"] = True
        return context

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ProductWriteSerializer
        if self.action == "retrieve":
            return ProductDetailSerializer
        return ProductListSerializer

    def get_permissions(self):
        # Reviews are readable by anyone and writable by customers, unlike
        # the vendor/admin-only product write permissions.
        if self.action == "reviews":
            if self.request.method == "POST":
                return [IsCustomer()]
            return [permissions.AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        product = serializer.save()
        return product

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(
            {
                "success": True,
                "product": ProductDetailSerializer(
                    product, context=self.get_serializer_context()
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(
            {
                "success": True,
                "product": ProductDetailSerializer(
                    product, context=self.get_serializer_context()
                ).data,
            }
        )

    @action(detail=False, methods=["get"], permission_classes=[IsVendor], url_path="my-products")
    def my_products(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = ProductListSerializer(
            page if page is not None else queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response({"success": True, "results": serializer.data})

    @action(detail=True, methods=["get", "post"], permission_classes=[CanManageProducts])
    def reviews(self, request, slug=None):
        product = self.get_object()
        if request.method == "GET":
            queryset = product.productstarratingandreview_set.select_related(
                "user"
            ).order_by("-created_at")
            page = self.paginate_queryset(queryset)
            serializer = ProductReviewSerializer(
                page if page is not None else queryset,
                many=True,
                context=self.get_serializer_context(),
            )
            if page is not None:
                return self.get_paginated_response(serializer.data)
            return Response({"success": True, "results": serializer.data})

        # POST: create a review, product is taken from the URL.
        if not (request.user.is_authenticated and request.user.user_role == "1"):
            return Response(
                {"success": False, "error": {"message": "Only customers can add reviews."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ProductReviewSerializer(
            data={**request.data, "product": product.id},
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response({"success": True, "review": serializer.data}, status=201)

    @action(detail=True, methods=["post"], url_path="images")
    def upload_image(self, request, slug=None):
        product = self.get_object()
        serializer = ProductImageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = serializer.save(product=product)
        return Response(
            {
                "success": True,
                "image": ProductImageSerializer(
                    image, context=self.get_serializer_context()
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"images/(?P<image_id>[^/.]+)",
    )
    def delete_image(self, request, slug=None, image_id=None):
        product = self.get_object()
        image = ProductImage.objects.filter(pk=image_id, product=product).first()
        if not image:
            return Response(
                {"success": False, "error": {"message": "Image not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        image.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="additional-information")
    def add_additional_information(self, request, slug=None):
        product = self.get_object()
        serializer = ProductAdditionalInformationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        info = serializer.save(product=product)
        return Response(
            {"success": True, "information": serializer.to_representation(info)},
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"additional-information/(?P<info_id>[^/.]+)",
    )
    def delete_additional_information(self, request, slug=None, info_id=None):
        product = self.get_object()
        info = ProductAditionalInformation.objects.filter(
            pk=info_id, product=product
        ).first()
        if not info:
            return Response(
                {"success": False, "error": {"message": "Record not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        info.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductReviewViewSet(
    viewsets.GenericViewSet,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
):
    """Flat review list, optionally filtered by ``?product=<id>``."""

    serializer_class = ProductReviewSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["product", "stars"]
    ordering_fields = ["created_at", "stars"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return ProductStarRatingAndReview.objects.select_related(
            "user", "product"
        ).order_by("-created_at")

    def get_permissions(self):
        if self.action == "create":
            return [IsCustomer()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
