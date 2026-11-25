from django.test import TestCase
from django.utils import timezone

from accounts.models import CustomUser
from products.models import (
    Cart,
    Categories,
    CustomerAddress,
    Industry,
    Product,
    ProductStarRatingAndReview,
)
from Vendors.models import VendorStore

from finance.services import record_completed_order
from api.services import complete_order, place_order
from .services import calculate_seller_score


class SellerScoreTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.vendor = CustomUser.objects.create_user(
            email="analytics-vendor@example.com", password="TestPass123!", user_role="3", mobile=3
        )
        cls.customer = CustomUser.objects.create_user(
            email="analytics-customer@example.com", password="TestPass123!", user_role="1", mobile=4
        )
        cls.store = VendorStore.objects.create(user=cls.vendor, name="Analytics Store")
        cls.industry = Industry.objects.create(name="Analytics Industry")
        cls.category = Categories.objects.create(name="Analytics Category", industry=cls.industry)
        cls.product = Product.objects.create(
            title="Analytics Product",
            regular_price=100,
            stoc=10,
            discounted_parcent=0,
            description="Product",
            modle="AP",
            categories=cls.category,
            tag="test",
            vendor_stores=cls.store,
            details_description="Details",
        )
        cls.address = CustomerAddress.objects.create(
            user=cls.customer, state="Lagos", city="Ikeja", zip_code=100001,
            street_address="1 Test", mobile=4,
        )

    def test_perfect_score(self):
        Cart.objects.create(user=self.customer, product=self.product, quantity=1)
        order = place_order(self.customer, self.address, paid=False)
        complete_order(order)
        ProductStarRatingAndReview.objects.create(
            product=self.product, user=self.customer, stars=5, review_message="Great"
        )
        score = calculate_seller_score(self.vendor, timezone.now().date(), timezone.now().date())
        self.assertEqual(score["score"], 5.0)
        self.assertEqual(score["return_rate"], 0.0)

    def test_low_score_with_returns_and_bad_reviews(self):
        Cart.objects.create(user=self.customer, product=self.product, quantity=1)
        order = place_order(self.customer, self.address, paid=False)
        completed = complete_order(order)
        ProductStarRatingAndReview.objects.create(
            product=self.product, user=self.customer, stars=2, review_message="Poor"
        )
        from finance.services import reverse_completed_order

        reverse_completed_order(completed, "Return")
        score = calculate_seller_score(self.vendor, timezone.now().date(), timezone.now().date())
        self.assertLess(score["score"], 5.0)
        self.assertGreater(score["penalties"]["returns"], 0)
        self.assertGreater(score["penalties"]["reviews"], 0)