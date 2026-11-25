from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from django.db import transaction
from django.http import HttpResponse
import io
try:
    from openpyxl import Workbook
    from openpyxl.styles import Font
except Exception:  # pragma: no cover
    Workbook = None
    Font = None
from rest_framework.views import APIView
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from api.permissions import IsVendor
from api.serializers import (
    CartItemSerializer,
    CouponSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)
from products.models import Cart

from .models import BulkUploadBatch, ProductDraft
from .serializers import (
    BulkUploadBatchSerializer,
    BuyerSourcingSerializer,
    PrepareCheckoutSerializer,
    ProductDraftSerializer,
    SellerListingSerializer,
)
from .services.content_generator import generate_listing_content
from .services.image_service import generate_listing_image
from .services.listing_service import publish_draft
from .services.pricing_analyzer import analyze_category_pricing
from .services.bulk_upload_service import start_bulk_processing


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}
from .services.sourcing_engine import prepare_checkout, source_and_build_cart


def _cart_summary(user, request):
    queryset = (
        Cart.objects.filter(user=user)
        .select_related(
            "product__categories__industry",
            "product__vendor_stores",
            "shipping_address",
            "cupon_code",
        )
        .prefetch_related("product__productimage_set")
        .order_by("id")
    )
    serializer = CartItemSerializer(
        queryset, many=True, context={"request": request}
    )
    first = queryset.first()
    subtotal = (
        Cart.subtotal_product_price(user) if queryset.exists() else 0
    )
    coupon = (
        CouponSerializer(first.cupon_code).data
        if first and first.cupon_code
        else None
    )
    return {
        "success": True,
        "count": queryset.count(),
        "total_quantity": sum(item.quantity for item in queryset),
        "subtotal": round(subtotal, 2),
        "coupon_applied": bool(first and first.cupon_applaied),
        "coupon": coupon,
        "items": serializer.data,
    }


def _selection_payload(selection, context):
    product = selection["product"]
    alternatives = [
        {
            **alternative,
            "product": ProductListSerializer(
                alternative["product"], context=context
            ).data,
        }
        for alternative in selection.get("alternatives", [])
    ]
    return {
        "cart_item_id": selection["cart_item"].id,
        "product": ProductListSerializer(product, context=context).data,
        "quantity": selection["quantity"],
        "unit_price": round(selection["price"], 2),
        "line_total": selection["line_total"],
        "score": selection["score"],
        "score_breakdown": selection["score_breakdown"],
        "reasons": selection["reasons"],
        "selection_reason": "; ".join(selection["reasons"][:3]),
        "alternatives": alternatives,
    }


class BuyerSourceAndBuildCartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=BuyerSourcingSerializer, responses=OpenApiTypes.OBJECT
    )
    def post(self, request):
        payload = BuyerSourcingSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = source_and_build_cart(
            user=request.user,
            prompt=payload.validated_data["prompt"],
            budget=payload.validated_data.get("budget"),
            max_items=payload.validated_data.get("max_items", 4),
            quantity=payload.validated_data.get("quantity", 1),
            currency=payload.validated_data.get("currency", "NGN"),
        )
        context = {"request": request}
        selections = [_selection_payload(item, context) for item in data["selections"]]
        return Response(
            {
                "success": True,
                "prompt": data["prompt"],
                "keywords": data["keywords"],
                "currency": data["currency"],
                "budget": data["budget"],
                "remaining_budget": data["remaining_budget"],
                "fallback_used": data["fallback_used"],
                "candidate_count": data["candidate_count"],
                "selections": selections,
                "selected_total": data["selected_total"],
                "cart": _cart_summary(request.user, request),
            }
        )


class BuyerPrepareCheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=PrepareCheckoutSerializer, responses=OpenApiTypes.OBJECT
    )
    def post(self, request):
        payload = PrepareCheckoutSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = prepare_checkout(
            request.user, address_id=payload.validated_data.get("address_id")
        )
        data["cart"] = _cart_summary(request.user, request)
        return Response(data)


class SellerGenerateListingView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @extend_schema(
        request=SellerListingSerializer, responses=OpenApiTypes.OBJECT
    )
    def post(self, request):
        payload = SellerListingSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        stores = request.user.vendorstore_set.all()
        store_id = payload.validated_data.get("store_id")
        store = stores.filter(pk=store_id).first() if store_id else stores.first()
        if store is None:
            return Response(
                {
                    "success": False,
                    "error": {
                        "message": "Create a vendor store before generating a listing."
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        category = payload.validated_data.get("category")
        condition = payload.validated_data.get(
            "condition", ProductDraft.CONDITION_NEW
        )
        currency = payload.validated_data.get("currency", "NGN")
        market = analyze_category_pricing(
            category, condition=condition, currency=currency
        )
        content = generate_listing_content(
            prompt=payload.validated_data["prompt"],
            category_name=category.name if category else "",
            condition=condition,
            market=market,
        )

        draft = ProductDraft.objects.create(
            vendor=request.user,
            store=store,
            title=content["title"],
            description=content["description"],
            details_description=content["details_description"],
            category=category,
            condition=condition,
            tag=content["tag"],
            modle=content["modle"],
            price=market["suggested_price"],
            suggested_price=market["suggested_price"],
            market_min=market["market_min"],
            market_max=market["market_max"],
            market_median=market["market_median"],
            market_sample_size=market["sample_size"],
            currency=currency,
            prompt=payload.validated_data["prompt"],
            provider_used=content["provider_used"],
            ai_note=content["note"],
            ai_payload=content.get("ai_payload") or {},
        )
        note = content["note"]
        try:
            generate_listing_image(draft)
        except Exception:  # noqa: BLE001 - draft remains usable without an image
            note = f"{note} The preview image could not be generated; upload one manually."
            draft.ai_note = note
            draft.save(update_fields=["ai_note", "updated_at"])

        return Response(
            {
                "success": True,
                "draft": ProductDraftSerializer(
                    draft, context={"request": request}
                ).data,
                "market": market,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerDraftViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ProductDraftSerializer
    permission_classes = [permissions.IsAuthenticated, IsVendor]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None

    def get_queryset(self):
        return (
            ProductDraft.objects.filter(vendor=self.request.user)
            .select_related("store", "category", "published_product")
            .order_by("-created_at")
        )

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response({"success": True, "results": serializer.data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        draft = serializer.save()
        return Response(
            {
                "success": True,
                "draft": self.get_serializer(draft).data,
            }
        )

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        draft = self.get_object()
        if draft.status == ProductDraft.STATUS_PUBLISHED:
            return Response(
                {
                    "success": False,
                    "error": {"message": "Published drafts cannot be rejected."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        draft.status = ProductDraft.STATUS_REJECTED
        draft.rejection_reason = (request.data.get("reason") or "").strip()[:2000]
        draft.save(
            update_fields=["status", "rejection_reason", "updated_at"]
        )
        return Response(
            {
                "success": True,
                "draft": self.get_serializer(draft).data,
            }
        )


class SellerApproveListingView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request, draft_id):
        try:
            draft, product, created = publish_draft(
                draft_id=draft_id, vendor=request.user
            )
        except LookupError:
            return Response(
                {
                    "success": False,
                    "error": {"message": "Draft not found."},
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        context = {"request": request}
        return Response(
            {
                "success": True,
                "draft": ProductDraftSerializer(draft, context=context).data,
                "product": ProductDetailSerializer(product, context=context).data,
                "created": created,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SellerBulkTemplateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(responses=OpenApiTypes.BINARY)
    def get(self, request):
        if Workbook is None:
            return Response(
                {"success": False, "error": {"message": "openpyxl is not installed."}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Bulk Products"
        headers = [
            "title",
            "category",
            "stock_quantity",
            "sku",
            "condition",
            "price",
            "description",
            "image_url",
        ]
        worksheet.append(headers)
        for cell in worksheet[1]:
            cell.font = Font(bold=True)
        worksheet.append(
            [
                "Example Wireless Mouse",
                "Accessories",
                25,
                "MOUSE-001",
                "new",
                15000,
                "Ergonomic wireless mouse with USB receiver.",
                "https://example.com/mouse.jpg",
            ]
        )
        worksheet.append(
            [
                "Bulk Uploaded Keyboard",
                "Accessories",
                10,
                "KEYBOARD-002",
                "used",
                "",
                "",
                "",
            ]
        )
        for column, width in zip("ABCDEFGH", [28, 18, 16, 16, 14, 12, 48, 40]):
            worksheet.column_dimensions[column].width = width

        buffer = io.BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = (
            'attachment; filename="ai-bulk-product-template.xlsx"'
        )
        return response


class SellerBulkUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        excel_file = request.FILES.get("excel_file")
        if not excel_file:
            return Response(
                {"success": False, "error": {"message": "excel_file is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stores = request.user.vendorstore_set.all()
        store_id = request.data.get("store_id")
        store = stores.filter(pk=store_id).first() if store_id else stores.first()
        if store is None:
            return Response(
                {
                    "success": False,
                    "error": {"message": "Create a vendor store before bulk uploading."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch = BulkUploadBatch.objects.create(
            vendor=request.user,
            store=store,
            excel_file=excel_file,
            images_zip=request.FILES.get("images_zip"),
            auto_generate_description=_as_bool(
                request.data.get("auto_generate_description")
            ),
            auto_suggest_price=_as_bool(request.data.get("auto_suggest_price")),
            auto_generate_image=_as_bool(request.data.get("auto_generate_image")),
        )
        start_bulk_processing(batch)
        batch.refresh_from_db()
        return Response(
            {
                "success": True,
                "batch": BulkUploadBatchSerializer(
                    batch, context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerBulkBatchDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, batch_id):
        batch = BulkUploadBatch.objects.filter(
            pk=batch_id, vendor=request.user
        ).first()
        if batch is None:
            return Response(
                {"success": False, "error": {"message": "Batch not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        drafts = batch.drafts.select_related("category", "store").order_by("id")
        return Response(
            {
                "success": True,
                "batch": BulkUploadBatchSerializer(
                    batch, context={"request": request}
                ).data,
                "drafts": ProductDraftSerializer(
                    drafts, many=True, context={"request": request}
                ).data,
            }
        )


class SellerBulkApproveAllView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVendor]

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    @transaction.atomic
    def post(self, request, batch_id):
        batch = BulkUploadBatch.objects.filter(
            pk=batch_id, vendor=request.user
        ).first()
        if batch is None:
            return Response(
                {"success": False, "error": {"message": "Batch not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        requested_ids = request.data.get("draft_ids")
        queryset = batch.drafts.filter(status=ProductDraft.STATUS_DRAFT)
        if isinstance(requested_ids, list) and requested_ids:
            queryset = queryset.filter(pk__in=requested_ids)

        published = []
        skipped = []
        for draft in queryset.order_by("id"):
            try:
                _, product, created = publish_draft(
                    draft_id=draft.id, vendor=request.user
                )
            except Exception as exc:  # noqa: BLE001 - collect per-draft failures
                skipped.append(
                    {"draft_id": draft.id, "reason": str(exc)}
                )
                continue
            published.append(
                {
                    "draft_id": draft.id,
                    "product_id": product.id,
                    "created": created,
                }
            )

        if published and not skipped:
            batch.status = BulkUploadBatch.STATUS_COMPLETED
            batch.save(update_fields=["status", "updated_at"])

        return Response(
            {
                "success": True,
                "published": published,
                "skipped": skipped,
                "published_count": len(published),
                "skipped_count": len(skipped),
            }
        )
