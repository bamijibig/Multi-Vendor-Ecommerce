"""Focused API tests for role isolation and the checkout lifecycle.

Run with: python manage.py test api
"""

import os
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import CustomUser
from products.models import (
    Cart,
    Categories,
    CompletedOder,
    CustomerAddress,
    Industry,
    PlacedOder,
    Product,
)
from Vendors.models import VendorStore

from .services import place_order


class ApiAuthorizationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.vendor_a = CustomUser.objects.create_user(
            email="vendor-a@example.com",
            password="TestPass123!",
            first_name="Vera",
            last_name="Vendor",
            mobile=1111111,
            user_role="3",
        )
        cls.vendor_b = CustomUser.objects.create_user(
            email="vendor-b@example.com",
            password="TestPass123!",
            first_name="Vic",
            last_name="Vendor",
            mobile=2222222,
            user_role="3",
        )
        cls.customer = CustomUser.objects.create_user(
            email="customer@example.com",
            password="TestPass123!",
            first_name="Cara",
            last_name="Customer",
            mobile=3333333,
            user_role="1",
        )
        cls.employee = CustomUser.objects.create_user(
            email="employee@example.com",
            password="TestPass123!",
            first_name="Eli",
            last_name="Employee",
            mobile=4444444,
            user_role="2",
        )
        cls.admin = CustomUser.objects.create_superuser(
            email="admin@example.com",
            password="TestPass123!",
            first_name="Ada",
            last_name="Admin",
            mobile=5555555,
        )

        cls.store_a = VendorStore.objects.create(user=cls.vendor_a, name="Vendor A Store")
        cls.store_b = VendorStore.objects.create(user=cls.vendor_b, name="Vendor B Store")

        cls.industry = Industry.objects.create(name="Test Electronics")
        cls.category = Categories.objects.create(
            name="Test Phones", industry=cls.industry
        )

        cls.product_a = Product.objects.create(
            title="Vendor A Phone",
            regular_price=100,
            stoc=10,
            discounted_parcent=10,
            description="A great phone.",
            modle="A1",
            categories=cls.category,
            tag="phone,test",
            vendor_stores=cls.store_a,
            details_description="Full details for the vendor A phone.",
        )
        cls.product_b = Product.objects.create(
            title="Vendor B Phone",
            regular_price=200,
            stoc=5,
            discounted_parcent=0,
            description="Another great phone.",
            modle="B1",
            categories=cls.category,
            tag="phone,test",
            vendor_stores=cls.store_b,
            details_description="Full details for the vendor B phone.",
        )

        cls.address = CustomerAddress.objects.create(
            user=cls.customer,
            state="Lagos",
            city="Ikeja",
            zip_code=100001,
            street_address="1 Test Street",
            mobile=3333333,
        )

    def setUp(self):
        # The test runner runs with DEBUG=False and adds "testserver" to
        # ALLOWED_HOSTS even though the project leaves the list empty.
        self.client = self.client_class(HTTP_HOST="testserver")

    def test_public_catalog_and_jwt_login(self):
        self.assertEqual(self.client.get("/api/home/").status_code, 200)
        self.assertEqual(self.client.get("/api/products/").status_code, 200)
        self.assertEqual(self.client.get("/api/industries/").status_code, 200)

        response = self.client.post(
            "/api/auth/login/",
            {"email": self.customer.email, "password": "TestPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], self.customer.email)

        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)

    def test_vendor_product_ownership(self):
        self.client.force_authenticate(self.vendor_a)
        payload = {
            "title": "New Vendor A Product",
            "regular_price": 50,
            "stoc": 3,
            "discounted_parcent": 5,
            "description": "Fresh product",
            "modle": "NEW1",
            "categories": self.category.id,
            "tag": "new",
            "details_description": "Details",
        }
        response = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data["product"]["vendor_store"]["id"], self.store_a.id
        )

        # Another vendor cannot edit A's product.
        self.client.force_authenticate(self.vendor_b)
        response = self.client.patch(
            f"/api/products/{self.product_a.slug}/",
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        # Assigning a product to someone else's store is rejected.
        response = self.client.post(
            "/api/products/",
            {**payload, "vendor_stores": self.store_a.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

        # The owner can edit their product.
        self.client.force_authenticate(self.vendor_a)
        response = self.client.patch(
            f"/api/products/{self.product_a.slug}/",
            {"title": "Updated by owner"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["product"]["title"], "Updated by owner")

        # Customers cannot write products.
        self.client.force_authenticate(self.customer)
        response = self.client.post("/api/products/", payload, format="json")
        self.assertEqual(response.status_code, 403)

    def test_reviews_are_customer_only(self):
        url = f"/api/products/{self.product_a.slug}/reviews/"
        self.assertEqual(self.client.get(url).status_code, 200)

        self.client.force_authenticate(self.vendor_a)
        response = self.client.post(
            url, {"stars": 5, "review_message": "Vendor review"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(self.customer)
        response = self.client.post(
            url, {"stars": 5, "review_message": "Excellent phone"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["review"]["stars"], 5)

    def test_cart_checkout_stock_and_vendor_isolation(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            "/api/cart/",
            {"product": self.product_a.id, "quantity": 2},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        response = self.client.post(
            "/api/cart/",
            {"product": self.product_b.id, "quantity": 1},
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        response = self.client.post(
            "/api/orders/place/",
            {"shipping_address_id": self.address.id},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        order = response.data["order"]
        self.assertEqual(len(order["items"]), 2)
        self.assertTrue(order["order_number"].startswith("OID"))
        self.assertFalse(order["paid"])

        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_a.stoc, 8)
        self.assertEqual(self.product_b.stoc, 4)
        self.assertFalse(Cart.objects.filter(user=self.customer).exists())

        # Each vendor only sees the order item for their own product.
        self.client.force_authenticate(self.vendor_a)
        response = self.client.get("/api/vendor/order-items/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        dashboard = self.client.get("/api/dashboard/vendor/")
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data["stats"]["total_products"], 1)
        self.assertEqual(response.data["results"][0]["product"]["id"], self.product_a.id)

        self.client.force_authenticate(self.vendor_b)
        response = self.client.get("/api/vendor/order-items/")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["product"]["id"], self.product_b.id)

        self.client.force_authenticate(self.customer)
        response = self.client.get("/api/orders/")
        self.assertEqual(response.data["count"], 1)

    def test_admin_order_oversight_and_completion(self):
        Cart.objects.create(user=self.customer, product=self.product_a, quantity=1)
        order = place_order(self.customer, self.address, paid=False)
        order_id = order.id

        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get("/api/admin/orders/").status_code, 403)
        self.assertEqual(self.client.get("/api/dashboard/vendor/").status_code, 403)

        self.client.force_authenticate(self.employee)
        response = self.client.get("/api/admin/orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(self.client.get("/api/dashboard/admin/").status_code, 200)

        response = self.client.patch(
            f"/api/admin/orders/{order_id}/",
            {"status": "Oder Packed", "paid": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["order"]["status"], "Oder Packed")
        self.assertTrue(response.data["order"]["paid"])

        response = self.client.post(f"/api/admin/orders/{order_id}/complete/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["completed_order"]["status"], "Completed")
        self.assertFalse(PlacedOder.objects.filter(pk=order_id).exists())
        self.assertEqual(CompletedOder.objects.filter(user=self.customer).count(), 1)

        self.client.force_authenticate(self.customer)
        response = self.client.get("/api/completed-orders/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_store_creation_is_vendor_only(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            "/api/vendors/", {"name": "Customer Store"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(self.vendor_a)
        response = self.client.post(
            "/api/vendors/", {"name": "Second Vendor A Store"}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        response = self.client.get("/api/vendors/mine/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 2)

    @override_settings(STRIPE_SECRET_KEY="")
    def test_payment_intent_requires_stripe_configuration(self):
        Cart.objects.create(user=self.customer, product=self.product_a, quantity=1)
        self.client.force_authenticate(self.customer)
        with patch.dict(os.environ, {"STRIPE_SECRET_KEY": ""}):
            response = self.client.post("/api/payments/create-intent/")
        self.assertEqual(response.status_code, 503)
        self.assertIn("not configured", response.data["error"]["message"])
