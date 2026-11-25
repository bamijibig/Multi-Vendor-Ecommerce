"""Admin Center API tests: authorization, moderation visibility, returns, payouts."""

from decimal import Decimal
from unittest.mock import patch

from rest_framework.test import APITestCase

from accounts.models import CustomUser
from api.services import complete_order, place_order
from finance.models import VendorLedgerEntry, VendorPayout
from products.models import (
    Cart,
    Categories,
    CompletedOderItems,
    CustomerAddress,
    Industry,
    Product,
)
from Vendors.models import VendorStore


class AdminCenterTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.vendor = CustomUser.objects.create_user(
            email="admincenter-vendor@example.com",
            password="TestPass123!",
            first_name="Vera",
            last_name="Vendor",
            mobile=1111111,
            user_role="3",
        )
        cls.other_vendor = CustomUser.objects.create_user(
            email="admincenter-other@example.com",
            password="TestPass123!",
            first_name="Ola",
            last_name="Other",
            mobile=2222222,
            user_role="3",
        )
        cls.customer = CustomUser.objects.create_user(
            email="admincenter-customer@example.com",
            password="TestPass123!",
            first_name="Cara",
            last_name="Customer",
            mobile=3333333,
            user_role="1",
        )
        cls.employee = CustomUser.objects.create_user(
            email="admincenter-employee@example.com",
            password="TestPass123!",
            first_name="Eli",
            last_name="Employee",
            mobile=4444444,
            user_role="2",
        )
        cls.admin = CustomUser.objects.create_superuser(
            email="admincenter-admin@example.com",
            password="TestPass123!",
            first_name="Ada",
            last_name="Admin",
            mobile=5555555,
        )

        cls.store = VendorStore.objects.create(
            user=cls.vendor, name="Admin Center Store"
        )
        cls.pending_store = VendorStore.objects.create(
            user=cls.other_vendor,
            name="Pending Center Store",
            status=VendorStore.STATUS_PENDING,
        )

        cls.industry = Industry.objects.create(name="Admin Center Industry")
        cls.category = Categories.objects.create(
            name="Admin Center Category", industry=cls.industry
        )
        cls.product = Product.objects.create(
            title="Admin Center Phone",
            regular_price=1000,
            stoc=10,
            discounted_parcent=0,
            description="Phone",
            modle="AC-1",
            categories=cls.category,
            tag="phone",
            vendor_stores=cls.store,
            details_description="Details",
        )
        cls.pending_product = Product.objects.create(
            title="Pending Store Item",
            regular_price=250,
            stoc=4,
            discounted_parcent=0,
            description="Item",
            modle="AC-2",
            categories=cls.category,
            tag="item",
            vendor_stores=cls.pending_store,
            details_description="Details",
        )
        cls.address = CustomerAddress.objects.create(
            user=cls.customer,
            state="Lagos",
            city="Ikeja",
            zip_code=100001,
            street_address="1 Admin Test",
            mobile=3333333,
        )

    def setUp(self):
        self.client = self.client_class(HTTP_HOST="testserver")

    def _completed_item(self):
        Cart.objects.create(user=self.customer, product=self.product, quantity=1)
        order = place_order(self.customer, self.address, paid=False)
        completed = complete_order(order)
        item = completed.delivered_items.first()
        item.return_status = CompletedOderItems.RETURN_REQUESTED
        item.refund_status = CompletedOderItems.REFUND_PENDING
        item.return_reason = "Item arrived damaged"
        from django.utils import timezone

        item.return_requested_at = timezone.now()
        item.save(
            update_fields=[
                "return_status",
                "refund_status",
                "return_reason",
                "return_requested_at",
            ]
        )
        return completed, item

    def test_non_admin_receives_403_on_admin_center_endpoints(self):
        completed, item = self._completed_item()
        payout = VendorPayout.objects.create(vendor=self.vendor, amount=Decimal("10.00"))
        requests = [
            ("get", "/api/admin/dashboard/overview/", None),
            ("get", "/api/admin/vendors/", None),
            ("patch", f"/api/admin/vendors/{self.store.id}/status/", {"status": "ACTIVE"}),
            ("get", "/api/admin/orders/", None),
            (
                "post",
                f"/api/admin/orders/{item.id}/resolve-return/",
                {"action": "approve"},
            ),
            ("get", "/api/admin/finance/rules/", None),
            (
                "post",
                "/api/admin/finance/rules/",
                {"category": self.category.id, "commission_rate": "8.00"},
            ),
            ("get", "/api/admin/payouts/", None),
            (
                "post",
                f"/api/admin/payouts/{payout.id}/process/",
                {"action": "approve", "reference": "PAY-1"},
            ),
            ("get", "/api/admin/products/", None),
            (
                "patch",
                f"/api/admin/products/{self.product.id}/moderate/",
                {"action": "flag"},
            ),
        ]

        for auth_user in (self.customer, self.vendor):
            self.client.force_authenticate(auth_user)
            for method, path, payload in requests:
                response = getattr(self.client, method)(
                    path, payload or {}, format="json"
                )
                self.assertEqual(
                    response.status_code,
                    403,
                    f"{auth_user.email} should not access {method.upper()} {path}",
                )

        item.refresh_from_db()
        self.assertEqual(item.return_status, CompletedOderItems.RETURN_REQUESTED)
        self.assertFalse(
            VendorLedgerEntry.objects.filter(
                completed_order=completed, entry_type=VendorLedgerEntry.ENTRY_REVERSAL
            ).exists()
        )

    def test_overview_and_finance_rules_report_platform_totals(self):
        self._completed_item()
        self.client.force_authenticate(self.employee)

        response = self.client.get("/api/admin/dashboard/overview/")
        self.assertEqual(response.status_code, 200)
        kpis = response.data["kpis"]
        self.assertEqual(kpis["pending_vendors"], 1)
        self.assertEqual(kpis["open_return_disputes"], 1)
        self.assertGreater(float(kpis["total_gmv"]), 0)
        self.assertGreater(float(kpis["platform_commission"]), 0)
        self.assertGreater(float(kpis["total_vat_collected"]), 0)
        self.assertEqual(response.data["alerts"]["open_return_disputes"], 1)

        response = self.client.get("/api/admin/finance/rules/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("commission_rules", response.data)
        self.assertIn("tax_config", response.data)
        self.assertIn("categories", response.data)

    def test_vendor_approval_toggles_store_and_catalog_visibility(self):
        self.client.force_authenticate(self.customer)
        hidden = self.client.get("/api/products/?vendor_store=%s" % self.pending_store.id)
        self.assertEqual(hidden.data["count"], 0)
        vendor_list = self.client.get("/api/vendors/")
        self.assertNotIn(
            self.pending_store.id, [vendor["id"] for vendor in vendor_list.data]
        )

        self.client.force_authenticate(self.employee)
        response = self.client.patch(
            f"/api/admin/vendors/{self.pending_store.id}/status/",
            {"status": "active", "note": "Documents verified"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["vendor"]["status"], VendorStore.STATUS_ACTIVE)

        self.client.force_authenticate(self.customer)
        visible = self.client.get("/api/products/?vendor_store=%s" % self.pending_store.id)
        self.assertEqual(visible.data["count"], 1)
        vendor_list = self.client.get("/api/vendors/")
        self.assertIn(
            self.pending_store.id, [vendor["id"] for vendor in vendor_list.data]
        )

        self.client.force_authenticate(self.employee)
        response = self.client.patch(
            f"/api/admin/vendors/{self.pending_store.id}/status/",
            {"status": "suspend"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.client.force_authenticate(self.customer)
        hidden = self.client.get("/api/products/?vendor_store=%s" % self.pending_store.id)
        self.assertEqual(hidden.data["count"], 0)

    def test_return_approval_reverses_ledger_and_updates_refund(self):
        completed, item = self._completed_item()
        original = VendorLedgerEntry.objects.get(
            completed_order=completed,
            completed_order_item=item,
            entry_type=VendorLedgerEntry.ENTRY_DELIVERY,
        )
        self.assertEqual(original.payout_status, VendorLedgerEntry.AVAILABLE_FOR_PAYOUT)

        self.client.force_authenticate(self.employee)
        response = self.client.get("/api/admin/orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["return_counts"]["requested"], 1)
        self.assertEqual(response.data["returns"][0]["id"], item.id)

        response = self.client.post(
            f"/api/admin/orders/{item.id}/resolve-return/",
            {"action": "approve", "note": "Refund approved"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reversed_entries"], 1)

        item.refresh_from_db()
        completed.refresh_from_db()
        original.refresh_from_db()
        reversal = VendorLedgerEntry.objects.get(
            completed_order=completed,
            completed_order_item=item,
            entry_type=VendorLedgerEntry.ENTRY_REVERSAL,
        )
        self.assertEqual(item.return_status, CompletedOderItems.RETURN_APPROVED)
        self.assertEqual(item.refund_status, CompletedOderItems.REFUND_REFUNDED)
        self.assertEqual(completed.status, "Returned")
        self.assertEqual(original.payout_status, VendorLedgerEntry.REVERSED_ON_RETURN)
        self.assertEqual(reversal.net_vendor_earning, -original.net_vendor_earning)

    def test_return_resolution_rolls_back_when_reversal_fails(self):
        completed, item = self._completed_item()
        original = VendorLedgerEntry.objects.get(
            completed_order=completed,
            completed_order_item=item,
            entry_type=VendorLedgerEntry.ENTRY_DELIVERY,
        )
        self.client.force_authenticate(self.employee)
        with patch(
            "api.views.admin_center.reverse_completed_order",
            side_effect=RuntimeError("ledger unavailable"),
        ):
            with self.assertRaises(RuntimeError):
                self.client.post(
                    f"/api/admin/orders/{item.id}/resolve-return/",
                    {"action": "approve"},
                    format="json",
                )

        item.refresh_from_db()
        completed.refresh_from_db()
        original.refresh_from_db()
        self.assertEqual(item.return_status, CompletedOderItems.RETURN_REQUESTED)
        self.assertEqual(item.refund_status, CompletedOderItems.REFUND_PENDING)
        self.assertNotEqual(completed.status, "Returned")
        self.assertEqual(original.payout_status, VendorLedgerEntry.AVAILABLE_FOR_PAYOUT)
        self.assertFalse(
            VendorLedgerEntry.objects.filter(
                completed_order=completed, entry_type=VendorLedgerEntry.ENTRY_REVERSAL
            ).exists()
        )

    def test_payout_process_marks_ledger_paid_and_rejection_releases_funds(self):
        completed, item = self._completed_item()
        entry = VendorLedgerEntry.objects.get(
            completed_order=completed,
            completed_order_item=item,
            entry_type=VendorLedgerEntry.ENTRY_DELIVERY,
        )
        payout = VendorPayout.objects.create(
            vendor=self.vendor, amount=entry.net_vendor_earning
        )
        entry.payout = payout
        entry.save(update_fields=["payout"])

        self.client.force_authenticate(self.employee)
        response = self.client.post(
            f"/api/admin/payouts/{payout.id}/process/",
            {"action": "approve", "reference": "BANK-REF-001"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        payout.refresh_from_db()
        entry.refresh_from_db()
        self.assertEqual(payout.status, VendorPayout.PAID)
        self.assertEqual(payout.reference, "BANK-REF-001")
        self.assertIsNotNone(payout.paid_at)
        self.assertEqual(entry.payout_status, VendorLedgerEntry.PAID)
        self.assertEqual(entry.payout_id, payout.id)

        second_payout = VendorPayout.objects.create(
            vendor=self.other_vendor, amount=Decimal("20.00")
        )
        second_entry = VendorLedgerEntry.objects.create(
            vendor=self.other_vendor,
            store=self.pending_store,
            completed_order=completed,
            completed_order_item=item,
            product=self.pending_product,
            entry_type=VendorLedgerEntry.ENTRY_DELIVERY,
            gross_item_amount=Decimal("20.00"),
            net_vendor_earning=Decimal("20.00"),
            payout=second_payout,
            payout_status=VendorLedgerEntry.AVAILABLE_FOR_PAYOUT,
        )
        response = self.client.post(
            f"/api/admin/payouts/{second_payout.id}/process/",
            {"action": "reject", "reason": "Bank details invalid"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        second_payout.refresh_from_db()
        second_entry.refresh_from_db()
        self.assertEqual(second_payout.status, VendorPayout.FAILED)
        self.assertEqual(
            second_entry.payout_status, VendorLedgerEntry.AVAILABLE_FOR_PAYOUT
        )
        self.assertIsNone(second_entry.payout_id)

    def test_catalog_moderation_hides_unpublished_products(self):
        self.client.force_authenticate(self.employee)
        response = self.client.patch(
            f"/api/admin/products/{self.product.id}/moderate/",
            {"action": "unpublish", "note": "Misleading listing"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["product"]["moderation_status"],
            Product.MODERATION_UNPUBLISHED,
        )

        self.client.force_authenticate(self.customer)
        listing = self.client.get("/api/products/")
        self.assertEqual(listing.data["count"], 0)
        detail = self.client.get(f"/api/products/{self.product.slug}/")
        self.assertEqual(detail.status_code, 404)

        self.client.force_authenticate(self.employee)
        response = self.client.patch(
            f"/api/admin/products/{self.product.id}/moderate/",
            {"action": "approve"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/products/").data["count"], 1)
