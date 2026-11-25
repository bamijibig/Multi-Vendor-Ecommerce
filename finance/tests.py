from decimal import Decimal

from django.test import TestCase

from accounts.models import CustomUser
from products.models import (
    Cart,
    Categories,
    CustomerAddress,
    Industry,
    PlacedOder,
    Product,
)
from Vendors.models import VendorStore

from .models import CategoryCommissionRule, TaxConfiguration, VendorLedgerEntry
from .services import money, record_completed_order, reverse_completed_order
from api.services import complete_order, place_order


class FinanceLedgerTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.vendor = CustomUser.objects.create_user(
            email="finance-vendor@example.com", password="TestPass123!", user_role="3", mobile=1
        )
        cls.customer = CustomUser.objects.create_user(
            email="finance-customer@example.com", password="TestPass123!", user_role="1", mobile=2
        )
        cls.store = VendorStore.objects.create(user=cls.vendor, name="Finance Store")
        cls.industry = Industry.objects.create(name="Finance Industry")
        cls.category = Categories.objects.create(name="Finance Electronics", industry=cls.industry)
        cls.product = Product.objects.create(
            title="Finance Phone",
            regular_price=1000,
            stoc=10,
            discounted_parcent=10,
            description="Phone",
            modle="FP",
            categories=cls.category,
            tag="phone",
            vendor_stores=cls.store,
            details_description="Details",
        )
        cls.address = CustomerAddress.objects.create(
            user=cls.customer, state="Lagos", city="Ikeja", zip_code=100001,
            street_address="1 Test", mobile=2,
        )
        CategoryCommissionRule.objects.create(
            category=cls.category, commission_rate=Decimal("6.00"), shipping_contribution_fee=Decimal("5.00")
        )
        TaxConfiguration.objects.create(vat_rate=Decimal("7.50"), is_active=True)

    def test_delivery_ledger_math(self):
        Cart.objects.create(user=self.customer, product=self.product, quantity=2)
        order = place_order(self.customer, self.address, paid=False)
        completed = complete_order(order)
        entry = VendorLedgerEntry.objects.get(completed_order=completed, entry_type="DELIVERY")
        self.assertEqual(entry.gross_item_amount, Decimal("1800.00"))
        self.assertEqual(entry.commission_amount, Decimal("108.00"))
        self.assertEqual(entry.vat_on_commission, Decimal("8.10"))
        self.assertEqual(entry.shipping_fee_deduction, Decimal("10.00"))
        self.assertEqual(entry.vat_on_shipping, Decimal("0.75"))
        self.assertEqual(entry.net_vendor_earning, Decimal("1673.15"))
        self.assertEqual(entry.payout_status, VendorLedgerEntry.AVAILABLE_FOR_PAYOUT)

    def test_return_reversal(self):
        Cart.objects.create(user=self.customer, product=self.product, quantity=1)
        order = place_order(self.customer, self.address, paid=False)
        completed = complete_order(order)
        reversals = reverse_completed_order(completed, "Returned")
        self.assertEqual(len(reversals), 1)
        original = VendorLedgerEntry.objects.get(completed_order=completed, entry_type="DELIVERY")
        self.assertEqual(original.payout_status, VendorLedgerEntry.REVERSED_ON_RETURN)
        self.assertEqual(reversals[0].net_vendor_earning, -original.net_vendor_earning)
        self.assertEqual(reversals[0].payout_status, VendorLedgerEntry.REVERSED_ON_RETURN)

    def test_record_is_idempotent(self):
        Cart.objects.create(user=self.customer, product=self.product, quantity=1)
        order = place_order(self.customer, self.address, paid=False)
        completed = complete_order(order)
        first_count = VendorLedgerEntry.objects.filter(completed_order=completed).count()
        record_completed_order(completed)
        second_count = VendorLedgerEntry.objects.filter(completed_order=completed).count()
        self.assertEqual(first_count, second_count)