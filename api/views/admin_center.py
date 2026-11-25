"""Platform administration endpoints for the general admin center."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import CustomUser
from api.pagination import StandardResultsSetPagination
from api.permissions import IsAdminUser
from api.serializers.admin_center import (
    AdminPayoutCreateSerializer,
    AdminPayoutSerializer,
    AdminProductSerializer,
    AdminReturnItemSerializer,
    AdminVendorSerializer,
)
from finance.models import (
    CategoryCommissionRule,
    TaxConfiguration,
    VendorLedgerEntry,
    VendorPayout,
)
from finance.serializers import (
    CategoryCommissionRuleSerializer,
    TaxConfigurationSerializer,
)
from finance.services import (
    get_active_tax_config,
    money,
    reverse_completed_order,
    vendor_balances,
)
from products.models import (
    Categories,
    CompletedOder,
    CompletedOderItems,
    PlacedOder,
    Product,
)
from Vendors.models import VendorStore

def _ledger_totals():
    totals = VendorLedgerEntry.objects.aggregate(
        gmv=Sum("gross_item_amount"),
        commission=Sum("commission_amount"),
        vat_commission=Sum("vat_on_commission"),
        vat_shipping=Sum("vat_on_shipping"),
    )
    return {
        "gmv": money(totals["gmv"]),
        "commission": money(totals["commission"]),
        "vat": money(
            (totals["vat_commission"] or Decimal("0.00"))
            + (totals["vat_shipping"] or Decimal("0.00"))
        ),
    }


class AdminOverviewView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        ledger = _ledger_totals()
        available_balance = (
            VendorLedgerEntry.objects.filter(
                payout_status=VendorLedgerEntry.AVAILABLE_FOR_PAYOUT
            ).aggregate(total=Sum("net_vendor_earning"))["total"]
            or Decimal("0.00")
        )
        pending_payouts = VendorPayout.objects.filter(status=VendorPayout.PENDING)
        pending_payout_amount = (
            pending_payouts.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        )
        orders_by_status = list(
            PlacedOder.objects.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        orders_by_status.append(
            {
                "status": "Completed",
                "count": CompletedOder.objects.count(),
            }
        )
        open_disputes = CompletedOderItems.objects.filter(
            return_status=CompletedOderItems.RETURN_REQUESTED
        ).count()
        pending_vendors = VendorStore.objects.filter(
            status=VendorStore.STATUS_PENDING
        ).count()

        return Response(
            {
                "success": True,
                "kpis": {
                    "total_gmv": ledger["gmv"],
                    "platform_commission": ledger["commission"],
                    "total_vat_collected": ledger["vat"],
                    "pending_vendor_payouts": money(pending_payout_amount),
                    "pending_payout_requests": money(pending_payout_amount),
                    "available_vendor_balance": money(available_balance),
                    "active_vendors": VendorStore.objects.filter(
                        status=VendorStore.STATUS_ACTIVE
                    ).count(),
                    "pending_vendors": pending_vendors,
                    "suspended_vendors": VendorStore.objects.filter(
                        status=VendorStore.STATUS_SUSPENDED
                    ).count(),
                    "open_return_disputes": open_disputes,
                    "orders_by_status": orders_by_status,
                },
                "alerts": {
                    "pending_vendors": pending_vendors,
                    "open_return_disputes": open_disputes,
                    "pending_payout_requests": pending_payouts.count(),
                },
            }
        )


class AdminVendorListView(APIView):
    permission_classes = [IsAdminUser]
    pagination_class = StandardResultsSetPagination

    @extend_schema(responses=AdminVendorSerializer(many=True))
    def get(self, request):
        queryset = VendorStore.objects.select_related("user").order_by("-created_at")
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
            )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AdminVendorSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        response.data["counts"] = {
            "active": VendorStore.objects.filter(
                status=VendorStore.STATUS_ACTIVE
            ).count(),
            "pending": VendorStore.objects.filter(
                status=VendorStore.STATUS_PENDING
            ).count(),
            "suspended": VendorStore.objects.filter(
                status=VendorStore.STATUS_SUSPENDED
            ).count(),
        }
        return response


class AdminVendorStatusView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(request=dict, responses=AdminVendorSerializer)
    def patch(self, request, vendor_id):
        store = get_object_or_404(VendorStore, pk=vendor_id)
        raw = str(request.data.get("status") or request.data.get("action") or "").lower()
        mapping = {
            "active": VendorStore.STATUS_ACTIVE,
            "approve": VendorStore.STATUS_ACTIVE,
            "approved": VendorStore.STATUS_ACTIVE,
            "activate": VendorStore.STATUS_ACTIVE,
            "reactivate": VendorStore.STATUS_ACTIVE,
            "pending": VendorStore.STATUS_PENDING,
            "suspend": VendorStore.STATUS_SUSPENDED,
            "suspended": VendorStore.STATUS_SUSPENDED,
        }
        if raw not in mapping:
            return Response(
                {
                    "success": False,
                    "error": {
                        "message": "Status must be active, pending, suspended, approve, or suspend."
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        store.status = mapping[raw]
        store.status_note = request.data.get("note", "") or ""
        store.save(update_fields=["status", "status_note", "status_updated_at"])
        return Response(
            {
                "success": True,
                "vendor": AdminVendorSerializer(store).data,
            }
        )


class AdminReturnResolveView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(request=dict, responses=dict)
    def post(self, request, order_item_id):
        action = str(request.data.get("action", "")).lower()
        if action not in {"approve", "reject"}:
            return Response(
                {
                    "success": False,
                    "error": {"message": "Action must be 'approve' or 'reject'."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            item = (
                CompletedOderItems.objects.select_for_update()
                .select_related(
                    "completed_oder__user",
                    "product__vendor_stores__user",
                )
                .filter(pk=order_item_id)
                .first()
            )
            if item is None:
                return Response(
                    {
                        "success": False,
                        "error": {"message": "Order item not found."},
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            if item.return_status == CompletedOderItems.RETURN_NONE:
                return Response(
                    {
                        "success": False,
                        "error": {"message": "This item has no return request."},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if action == "approve" and item.return_status == CompletedOderItems.RETURN_APPROVED:
                return Response(
                    {
                        "success": True,
                        "order_item": AdminReturnItemSerializer(item).data,
                        "reversed_entries": 0,
                    }
                )
            if action == "reject" and item.return_status == CompletedOderItems.RETURN_REJECTED:
                return Response(
                    {
                        "success": True,
                        "order_item": AdminReturnItemSerializer(item).data,
                        "reversed_entries": 0,
                    }
                )
            if item.return_status == CompletedOderItems.RETURN_APPROVED:
                return Response(
                    {
                        "success": False,
                        "error": {
                            "message": "An approved return cannot be rejected."
                        },
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            note = request.data.get("note", "") or ""
            item.return_resolved_at = timezone.now()
            item.return_resolution_note = note
            reversed_count = 0

            if action == "approve":
                item.return_status = CompletedOderItems.RETURN_APPROVED
                item.refund_status = CompletedOderItems.REFUND_REFUNDED
                item.save(
                    update_fields=[
                        "return_status",
                        "refund_status",
                        "return_resolved_at",
                        "return_resolution_note",
                    ]
                )
                completed = item.completed_oder
                reversals = reverse_completed_order(
                    completed,
                    note or item.return_reason or "Buyer return approved",
                    item=item,
                )
                reversed_count = len(reversals)
                return_states = set(
                    completed.delivered_items.values_list("return_status", flat=True)
                )
                completed.status = (
                    "Returned"
                    if return_states == {CompletedOderItems.RETURN_APPROVED}
                    else "Partially returned"
                )
                completed.save(update_fields=["status"])
            else:
                item.return_status = CompletedOderItems.RETURN_REJECTED
                item.refund_status = CompletedOderItems.REFUND_DECLINED
                item.save(
                    update_fields=[
                        "return_status",
                        "refund_status",
                        "return_resolved_at",
                        "return_resolution_note",
                    ]
                )

        item.refresh_from_db()
        return Response(
            {
                "success": True,
                "order_item": AdminReturnItemSerializer(item).data,
                "reversed_entries": reversed_count,
            }
        )


class AdminFinanceRulesView(APIView):
    permission_classes = [IsAdminUser]

    def _payload(self):
        return {
            "success": True,
            "commission_rules": CategoryCommissionRuleSerializer(
                CategoryCommissionRule.objects.select_related("category").all(),
                many=True,
            ).data,
            "tax_config": TaxConfigurationSerializer(get_active_tax_config()).data,
            "categories": list(Categories.objects.values("id", "name").order_by("name")),
        }

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(self._payload())

    @extend_schema(request=dict, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        if request.data.get("vat_rate") is not None or request.data.get("tax"):
            config = get_active_tax_config()
            payload = request.data.get("tax") or request.data
            serializer = TaxConfigurationSerializer(config, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        else:
            serializer = CategoryCommissionRuleSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        response = self._payload()
        response["success"] = True
        return Response(response, status=status.HTTP_201_CREATED)

    @extend_schema(request=dict, responses=OpenApiTypes.OBJECT)
    def patch(self, request):
        rule_id = request.data.get("id") or request.data.get("rule_id")
        if rule_id:
            rule = get_object_or_404(CategoryCommissionRule, pk=rule_id)
            serializer = CategoryCommissionRuleSerializer(
                rule, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()

        rules = request.data.get("commission_rules")
        if isinstance(rules, list):
            for entry in rules:
                current = CategoryCommissionRule.objects.filter(
                    pk=entry.get("id")
                ).first()
                if current is None:
                    continue
                serializer = CategoryCommissionRuleSerializer(
                    current, data=entry, partial=True
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()

        tax_payload = request.data.get("tax")
        if isinstance(tax_payload, dict) or any(
            key in request.data for key in ("vat_rate", "wht_rate", "wht_enabled")
        ):
            config = get_active_tax_config()
            payload = tax_payload or request.data
            serializer = TaxConfigurationSerializer(config, data=payload, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()

        return Response(self._payload())


class AdminPayoutListView(APIView):
    permission_classes = [IsAdminUser]
    pagination_class = StandardResultsSetPagination

    @extend_schema(responses=AdminPayoutSerializer(many=True))
    def get(self, request):
        queryset = VendorPayout.objects.select_related("vendor").prefetch_related(
            "entries"
        ).order_by("-created_at")
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(vendor__email__icontains=search)
                | Q(reference__icontains=search)
                | Q(vendor__first_name__icontains=search)
                | Q(vendor__last_name__icontains=search)
            )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AdminPayoutSerializer(page, many=True)
        response = paginator.get_paginated_response(serializer.data)
        response.data["counts"] = {
            "pending": VendorPayout.objects.filter(status=VendorPayout.PENDING).count(),
            "paid": VendorPayout.objects.filter(status=VendorPayout.PAID).count(),
            "failed": VendorPayout.objects.filter(status=VendorPayout.FAILED).count(),
        }
        return response

    @extend_schema(request=AdminPayoutCreateSerializer, responses=AdminPayoutSerializer)
    def post(self, request):
        serializer = AdminPayoutCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vendor = CustomUser.objects.filter(
            pk=serializer.validated_data["vendor"], user_role="3"
        ).first()
        if vendor is None:
            return Response(
                {"success": False, "error": {"message": "Vendor account not found."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        balances = vendor_balances(vendor)
        available = money(balances["available_for_payout"])
        amount = serializer.validated_data.get("amount")
        if amount is not None:
            amount = money(amount)
            if amount <= 0:
                return Response(
                    {
                        "success": False,
                        "error": {"message": "Payout amount must be greater than zero."},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if amount > available:
                return Response(
                    {
                        "success": False,
                        "error": {
                            "message": "Payout amount exceeds the vendor's available balance."
                        },
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            amount = available

        if amount <= 0:
            return Response(
                {
                    "success": False,
                    "error": {"message": "The vendor has no available balance to pay out."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            payout = VendorPayout.objects.create(
                vendor=vendor,
                amount=amount,
                status=VendorPayout.PENDING,
                reference=serializer.validated_data.get("reference", ""),
                period_start=serializer.validated_data.get("period_start"),
                period_end=serializer.validated_data.get("period_end"),
            )
            remaining = amount
            entries = VendorLedgerEntry.objects.select_for_update().filter(
                vendor=vendor,
                payout__isnull=True,
                payout_status=VendorLedgerEntry.AVAILABLE_FOR_PAYOUT,
            ).order_by("created_at")
            for entry in entries:
                if remaining <= 0:
                    break
                entry.payout = payout
                entry.save(update_fields=["payout"])
                remaining = money(remaining - money(entry.net_vendor_earning))

        return Response(
            {"success": True, "payout": AdminPayoutSerializer(payout).data},
            status=status.HTTP_201_CREATED,
        )


class AdminPayoutProcessView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(request=dict, responses=AdminPayoutSerializer)
    def post(self, request, payout_id):
        action = str(request.data.get("action", "approve")).lower()
        if action not in {"approve", "pay", "reject"}:
            return Response(
                {
                    "success": False,
                    "error": {"message": "Action must be 'approve' or 'reject'."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        reference = (request.data.get("reference") or "").strip()
        if action in {"approve", "pay"} and not reference:
            return Response(
                {
                    "success": False,
                    "error": {
                        "message": "A payment reference is required to mark a payout as paid."
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            payout = (
                VendorPayout.objects.select_for_update()
                .select_related("vendor")
                .filter(pk=payout_id)
                .first()
            )
            if payout is None:
                return Response(
                    {
                        "success": False,
                        "error": {"message": "Payout not found."},
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            if payout.status == VendorPayout.PAID and action in {"approve", "pay"}:
                return Response(
                    {"success": True, "payout": AdminPayoutSerializer(payout).data}
                )
            if payout.status != VendorPayout.PENDING:
                return Response(
                    {
                        "success": False,
                        "error": {"message": "Only pending payouts can be processed."},
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            entries = list(
                VendorLedgerEntry.objects.select_for_update().filter(payout=payout)
            )
            if action in {"approve", "pay"}:
                if not entries:
                    remaining = money(payout.amount)
                    available_entries = (
                        VendorLedgerEntry.objects.select_for_update()
                        .filter(
                            vendor=payout.vendor,
                            payout__isnull=True,
                            payout_status=VendorLedgerEntry.AVAILABLE_FOR_PAYOUT,
                        )
                        .order_by("created_at")
                    )
                    for entry in available_entries:
                        if remaining <= 0:
                            break
                        entries.append(entry)
                        remaining = money(remaining - money(entry.net_vendor_earning))
                for entry in entries:
                    entry.payout = payout
                    entry.payout_status = VendorLedgerEntry.PAID
                    entry.save(update_fields=["payout", "payout_status"])
                payout.status = VendorPayout.PAID
                payout.reference = reference
                payout.paid_at = timezone.now()
                payout.save(update_fields=["status", "reference", "paid_at"])
            else:
                for entry in entries:
                    entry.payout = None
                    entry.payout_status = VendorLedgerEntry.AVAILABLE_FOR_PAYOUT
                    entry.save(update_fields=["payout", "payout_status"])
                payout.status = VendorPayout.FAILED
                payout.reference = reference or (request.data.get("reason") or "")
                payout.save(update_fields=["status", "reference"])

        payout.refresh_from_db()
        return Response({"success": True, "payout": AdminPayoutSerializer(payout).data})


class AdminProductListView(APIView):
    permission_classes = [IsAdminUser]
    pagination_class = StandardResultsSetPagination

    @extend_schema(responses=AdminProductSerializer(many=True))
    def get(self, request):
        queryset = (
            Product.objects.select_related("categories", "vendor_stores__user")
            .prefetch_related("ai_draft_source")
            .order_by("-created_at")
        )
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(tag__icontains=search)
                | Q(modle__icontains=search)
                | Q(vendor_stores__name__icontains=search)
                | Q(vendor_stores__user__email__icontains=search)
            )
        moderation = request.query_params.get("moderation_status") or request.query_params.get(
            "status"
        )
        if moderation:
            queryset = queryset.filter(moderation_status=moderation.upper())
        vendor = request.query_params.get("vendor")
        if vendor:
            queryset = queryset.filter(vendor_stores_id=vendor)
        category = request.query_params.get("category")
        if category:
            queryset = queryset.filter(categories_id=category)
        source = request.query_params.get("source")
        if source == "ai":
            queryset = queryset.filter(ai_draft_source__isnull=False).distinct()
        elif source == "bulk":
            queryset = queryset.filter(
                ai_draft_source__bulk_batch__isnull=False
            ).distinct()
        elif source == "vendor":
            queryset = queryset.filter(ai_draft_source__isnull=True)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = AdminProductSerializer(
            page, many=True, context={"request": request}
        )
        return paginator.get_paginated_response(serializer.data)


class AdminProductModerateView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(request=dict, responses=AdminProductSerializer)
    def patch(self, request, product_id):
        product = get_object_or_404(Product, pk=product_id)
        raw = str(request.data.get("action") or request.data.get("status") or "").lower()
        mapping = {
            "approve": Product.MODERATION_APPROVED,
            "approved": Product.MODERATION_APPROVED,
            "reapprove": Product.MODERATION_APPROVED,
            "flag": Product.MODERATION_FLAGGED,
            "flagged": Product.MODERATION_FLAGGED,
            "unpublish": Product.MODERATION_UNPUBLISHED,
            "unpublished": Product.MODERATION_UNPUBLISHED,
            "pending": Product.MODERATION_PENDING,
        }
        if raw not in mapping:
            return Response(
                {
                    "success": False,
                    "error": {
                        "message": "Action must be approve, flag, unpublish, or pending."
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        product.moderation_status = mapping[raw]
        product.moderation_note = request.data.get("note", "") or ""
        product.moderated_at = timezone.now()
        product.save(
            update_fields=[
                "moderation_status",
                "moderation_note",
                "moderated_at",
            ]
        )
        return Response(
            {
                "success": True,
                "product": AdminProductSerializer(
                    product, context={"request": request}
                ).data,
            }
        )
