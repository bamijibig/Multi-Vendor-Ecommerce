"""AI assistant API and ranking tests.

Run with: python manage.py test ai_assistant
"""

import io
import shutil
import tempfile
import zipfile
from unittest.mock import patch

from openpyxl import Workbook
from PIL import Image

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.models import CustomUser
from products.models import (
    Cart,
    Categories,
    CustomerAddress,
    Industry,
    PlacedOder,
    PlacedeOderItem,
    Product,
    ProductImage,
    ProductStarRatingAndReview,
)
from Vendors.models import VendorStore

from .models import ProductDraft
from .services.image_service import generate_listing_image
from .services.provider import AIProviderError
from .services.sourcing_engine import parse_budget_from_prompt, score_candidate


class AiAssistantTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.vendor_a = CustomUser.objects.create_user(
            email="ai-vendor-a@example.com",
            password="TestPass123!",
            first_name="Ava",
            last_name="Vendor",
            mobile=6111111,
            user_role="3",
        )
        cls.vendor_b = CustomUser.objects.create_user(
            email="ai-vendor-b@example.com",
            password="TestPass123!",
            first_name="Ben",
            last_name="Vendor",
            mobile=6222222,
            user_role="3",
        )
        cls.customer = CustomUser.objects.create_user(
            email="ai-customer@example.com",
            password="TestPass123!",
            first_name="Cora",
            last_name="Customer",
            mobile=6333333,
            user_role="1",
        )
        cls.store_a = VendorStore.objects.create(user=cls.vendor_a, name="AI Vendor A")
        cls.store_b = VendorStore.objects.create(user=cls.vendor_b, name="AI Vendor B")

        cls.industry = Industry.objects.create(name="AI Electronics")
        cls.category = Categories.objects.create(
            name="AI Phones", industry=cls.industry
        )

        cls.product_a = Product.objects.create(
            title="High Rated Phone",
            regular_price=100,
            stoc=10,
            discounted_parcent=10,
            description="A highly rated phone for everyday use.",
            modle="HP-1",
            categories=cls.category,
            tag="phone,smartphone",
            vendor_stores=cls.store_a,
            details_description="Battery, camera and display details.",
        )
        cls.product_b = Product.objects.create(
            title="Budget Phone",
            regular_price=200,
            stoc=8,
            discounted_parcent=0,
            description="An affordable phone.",
            modle="BP-1",
            categories=cls.category,
            tag="phone,budget",
            vendor_stores=cls.store_b,
            details_description="A simple phone.",
        )
        cls.address = CustomerAddress.objects.create(
            user=cls.customer,
            state="Lagos",
            city="Ikeja",
            zip_code=100001,
            street_address="2 AI Test Street",
            mobile=6333333,
        )

        ProductStarRatingAndReview.objects.create(
            product=cls.product_a,
            user=cls.customer,
            stars=5,
            review_message="Excellent phone, very reliable.",
        )
        ProductStarRatingAndReview.objects.create(
            product=cls.product_a,
            user=cls.customer,
            stars=5,
            review_message="Would buy again.",
        )
        ProductStarRatingAndReview.objects.create(
            product=cls.product_b,
            user=cls.customer,
            stars=3,
            review_message="It is okay.",
        )
        order = PlacedOder.objects.create(
            user=cls.customer,
            shipping_address=cls.address,
            sub_total_price=2000,
            paid=True,
        )
        PlacedeOderItem.objects.create(
            placed_oder=order, product=cls.product_a, quantity=20
        )

    def setUp(self):
        self.temp_media = tempfile.mkdtemp(prefix="ai-assistant-tests-")
        self.settings_override = override_settings(
            MEDIA_ROOT=self.temp_media,
            AI_PROVIDER="",
            AI_API_KEY="",
            AI_MODEL="",
            AI_IMAGE_MODEL="",
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(shutil.rmtree, self.temp_media, True)
        self.client = self.client_class(HTTP_HOST="testserver")

    def test_budget_parser_and_weighted_ranking(self):
        self.assertEqual(parse_budget_from_prompt("phone under ₦50k"), 50_000)
        self.assertEqual(parse_budget_from_prompt("budget of 120,000 naira"), 120_000)
        self.assertEqual(parse_budget_from_prompt("headphones under $80"), 80)
        self.assertIsNone(parse_budget_from_prompt("iPhone 13 128GB"))

        strong = score_candidate(
            average_rating=4.9,
            review_count=25,
            sold_units=80,
            stock=12,
            quantity=1,
            price=90,
            budget=500,
            relevance=1.0,
        )
        weak = score_candidate(
            average_rating=2.0,
            review_count=0,
            sold_units=0,
            stock=12,
            quantity=1,
            price=190,
            budget=500,
            relevance=0.2,
        )
        self.assertGreater(strong["final"], weak["final"])
        self.assertEqual(strong["price_fit"], 1.0)
        self.assertEqual(
            score_candidate(
                average_rating=5,
                review_count=1,
                sold_units=1,
                stock=12,
                quantity=1,
                price=200,
                budget=100,
                relevance=1,
            )["price_fit"],
            0.0,
        )

    def test_buyer_concierge_builds_ranked_cart_with_reasons(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            "/api/ai/buyer/source-and-build-cart/",
            {
                "prompt": "I need a reliable phone under ₦500",
                "max_items": 2,
                "quantity": 1,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["budget"], 500)
        self.assertEqual(response.data["currency"], "NGN")
        self.assertGreaterEqual(len(response.data["selections"]), 1)
        first = response.data["selections"][0]
        self.assertEqual(first["product"]["id"], self.product_a.id)
        self.assertIn("reasons", first)
        self.assertIn("rating", first["score_breakdown"])
        self.assertIn("review_volume", first["score_breakdown"])
        self.assertIn("sales_volume", first["score_breakdown"])
        self.assertIn("price_fit", first["score_breakdown"])
        self.assertTrue(any("sold" in reason for reason in first["reasons"]))
        self.assertIn("alternatives", first)
        self.assertEqual(Cart.objects.filter(user=self.customer).count(), 2)
        self.assertTrue(Cart.objects.filter(user=self.customer, product=self.product_a).exists())
        self.assertLessEqual(response.data["selected_total"], 500)
        self.assertIn("items", response.data["cart"])

    def test_prepare_checkout_validates_without_creating_order(self):
        Cart.objects.create(user=self.customer, product=self.product_a, quantity=2)
        placed_before = PlacedOder.objects.filter(user=self.customer).count()
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            "/api/ai/buyer/prepare-checkout/",
            {"address_id": self.address.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["checkout_ready"])
        self.assertFalse(response.data["payment"]["auto_charge"])
        self.assertEqual(response.data["address"]["id"], self.address.id)
        self.assertTrue(
            Cart.objects.filter(
                user=self.customer, shipping_address=self.address
            ).exists()
        )
        self.assertEqual(
            PlacedOder.objects.filter(user=self.customer).count(), placed_before
        )

        bad_address = CustomerAddress.objects.create(
            user=self.vendor_a,
            state="Abuja",
            city="Garki",
            zip_code=900001,
            street_address="Other address",
            mobile=6111111,
        )
        response = self.client.post(
            "/api/ai/buyer/prepare-checkout/",
            {"address_id": bad_address.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)

    def test_prepare_checkout_reports_missing_address(self):
        Cart.objects.create(user=self.customer, product=self.product_a, quantity=1)
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            "/api/ai/buyer/prepare-checkout/", {}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data["checkout_ready"])
        self.assertIn("shipping_address", response.data["missing"])

    def test_seller_generation_is_vendor_only_and_uses_fallback(self):
        self.client.force_authenticate(self.customer)
        response = self.client.post(
            "/api/ai/seller/generate-listing/",
            {"prompt": "Sell my used phone"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(self.vendor_a)
        response = self.client.post(
            "/api/ai/seller/generate-listing/",
            {
                "prompt": "Sell my used iPhone 13 128GB, great battery",
                "category": self.category.id,
                "condition": "used",
                "store_id": self.store_a.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        draft = ProductDraft.objects.get(pk=response.data["draft"]["id"])
        self.assertEqual(draft.vendor, self.vendor_a)
        self.assertEqual(draft.provider_used, "fallback")
        self.assertTrue(draft.image.name)
        self.assertIsNotNone(draft.suggested_price)
        self.assertGreater(draft.market_sample_size, 0)
        self.assertIn("AI is not configured", draft.ai_note)

    def test_provider_failure_falls_back_to_local_draft(self):
        class BrokenProvider:
            name = "broken"
            supports_images = False

            def generate_json(self, **kwargs):
                raise AIProviderError("simulated timeout")

        self.client.force_authenticate(self.vendor_a)
        with patch(
            "ai_assistant.services.content_generator.get_provider",
            return_value=BrokenProvider(),
        ):
            response = self.client.post(
                "/api/ai/seller/generate-listing/",
                {
                    "prompt": "A compact desk lamp",
                    "category": self.category.id,
                    "store_id": self.store_a.id,
                },
                format="json",
            )
        self.assertEqual(response.status_code, 201, response.data)
        draft = ProductDraft.objects.get(pk=response.data["draft"]["id"])
        self.assertEqual(draft.provider_used, "fallback")
        self.assertIn("unavailable", draft.ai_note)

    def test_draft_approval_permissions_and_idempotent_publish(self):
        draft = ProductDraft.objects.create(
            vendor=self.vendor_a,
            store=self.store_a,
            title="AI Approved Phone",
            description="<p>A reviewed draft.</p>",
            details_description="<p>Full details.</p>",
            category=self.category,
            condition="used",
            price=75,
            suggested_price=75,
            stock=3,
            tag="phone,ai",
            modle="AI-1",
            prompt="Sell an AI phone",
        )
        generate_listing_image(draft)

        self.client.force_authenticate(self.vendor_b)
        response = self.client.post(f"/api/ai/seller/approve-listing/{draft.id}/")
        self.assertEqual(response.status_code, 404)

        self.client.force_authenticate(self.vendor_a)
        response = self.client.post(f"/api/ai/seller/approve-listing/{draft.id}/")
        self.assertEqual(response.status_code, 201, response.data)
        product_id = response.data["product"]["id"]
        self.assertEqual(Product.objects.get(pk=product_id).vendor_stores, self.store_a)
        self.assertEqual(ProductImage.objects.filter(product_id=product_id).count(), 1)
        draft.refresh_from_db()
        self.assertEqual(draft.status, ProductDraft.STATUS_PUBLISHED)

        response = self.client.post(f"/api/ai/seller/approve-listing/{draft.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["created"])
        self.assertEqual(Product.objects.filter(pk=product_id).count(), 1)

        # Another vendor cannot see or edit the draft.
        self.client.force_authenticate(self.vendor_b)
        self.assertEqual(
            self.client.get(f"/api/ai/seller/drafts/{draft.id}/").status_code, 404
        )

    def test_vendor_can_edit_and_upload_draft_image(self):
        self.client.force_authenticate(self.vendor_a)
        draft = ProductDraft.objects.create(
            vendor=self.vendor_a,
            store=self.store_a,
            title="Editable Draft",
            description="<p>Draft</p>",
            details_description="<p>Details</p>",
            category=self.category,
            price=40,
            prompt="Sell a draft",
        )
        image = SimpleUploadedFile(
            "replacement.png", b"replacement-image-bytes", content_type="image/png"
        )
        response = self.client.patch(
            f"/api/ai/seller/drafts/{draft.id}/",
            {"title": "Edited Draft", "image": image},
            format="multipart",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["draft"]["title"], "Edited Draft")
        self.assertIn("/images/ai-listings/", response.data["draft"]["image_url"])

        self.client.force_authenticate(self.vendor_b)
        response = self.client.patch(
            f"/api/ai/seller/drafts/{draft.id}/",
            {"title": "Hijacked"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_reject_draft_and_block_publish(self):
        self.client.force_authenticate(self.vendor_a)
        draft = ProductDraft.objects.create(
            vendor=self.vendor_a,
            store=self.store_a,
            title="Rejected Lamp",
            description="<p>Draft</p>",
            details_description="<p>Details</p>",
            category=self.category,
            price=50,
            stock=2,
            prompt="Sell a lamp",
        )
        response = self.client.post(
            f"/api/ai/seller/drafts/{draft.id}/reject/",
            {"reason": "Needs better photos"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["draft"]["status"], "rejected")
        response = self.client.post(f"/api/ai/seller/approve-listing/{draft.id}/")
        self.assertEqual(response.status_code, 400)

    def _make_xlsx(self, rows):
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.append(
            [
                "title",
                "category",
                "stock_quantity",
                "sku",
                "condition",
                "price",
                "description",
                "image_url",
            ]
        )
        for row in rows:
            worksheet.append(row)
        buffer = io.BytesIO()
        workbook.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    def _make_zip(self, entries):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            for name, data in entries.items():
                archive.writestr(name, data)
        buffer.seek(0)
        return buffer.getvalue()

    def _image_bytes(self, fmt="PNG"):
        image = Image.new("RGB", (4, 4), "red")
        buffer = io.BytesIO()
        image.save(buffer, format=fmt)
        return buffer.getvalue()

    def test_bulk_upload_mixed_supplied_and_ai_filled_rows(self):
        xlsx = self._make_xlsx(
            [
                [
                    "Supplied Mouse",
                    self.category.name,
                    5,
                    "NOSKU-1",
                    "new",
                    120,
                    "Supplied description",
                    "https://example.com/mouse.jpg",
                ],
                [
                    "AI Keyboard",
                    self.category.name,
                    3,
                    "KB-2",
                    "used",
                    "",
                    "",
                    "",
                ],
            ]
        )
        zip_bytes = self._make_zip(
            {"KB-2.png": self._image_bytes("PNG"), "KB-2_1.jpg": self._image_bytes("JPEG")}
        )
        self.client.force_authenticate(self.vendor_a)
        response = self.client.post(
            "/api/ai/seller/bulk-upload/",
            {
                "excel_file": SimpleUploadedFile(
                    "products.xlsx",
                    xlsx,
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
                "images_zip": SimpleUploadedFile("images.zip", zip_bytes, content_type="application/zip"),
                "store_id": self.store_a.id,
                "auto_generate_description": "true",
                "auto_suggest_price": "true",
                "auto_generate_image": "true",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        batch_id = response.data["batch"]["id"]
        batch_response = self.client.get(f"/api/ai/seller/bulk-upload/{batch_id}/")
        self.assertEqual(batch_response.status_code, 200, batch_response.data)
        self.assertEqual(batch_response.data["batch"]["status"], "READY_FOR_REVIEW")
        drafts = batch_response.data["drafts"]
        self.assertEqual(len(drafts), 2)

        supplied = next(draft for draft in drafts if draft["title"] == "Supplied Mouse")
        self.assertEqual(supplied["price"], 120)
        self.assertIn("Supplied description", supplied["description"])
        self.assertEqual(supplied["image_source"], "excel_url")
        self.assertEqual(supplied["image_url"], "https://example.com/mouse.jpg")

        generated = next(draft for draft in drafts if draft["title"] == "AI Keyboard")
        self.assertIsNotNone(generated["price"])
        self.assertTrue(generated["description"])
        self.assertEqual(generated["image_source"], "zip")
        self.assertIn("/images/ai-listings/", generated["image_url"])

    def test_bulk_zip_sku_matching_is_case_insensitive(self):
        from ai_assistant.services.zip_image_matcher import extract_zip_images

        zip_bytes = self._make_zip({"SKU1.PNG": self._image_bytes("PNG")})
        images, warnings = extract_zip_images(io.BytesIO(zip_bytes))
        self.assertIn("sku1", images)
        self.assertEqual(warnings, [])

    def test_bulk_zip_rejects_path_traversal(self):
        from ai_assistant.services.zip_image_matcher import ZipSecurityError, extract_zip_images

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            archive.writestr("../evil.png", self._image_bytes("PNG"))
        buffer.seek(0)
        with self.assertRaises(ZipSecurityError):
            extract_zip_images(buffer)

    def test_bulk_upload_vendor_ownership_and_approval(self):
        xlsx = self._make_xlsx(
            [["Owned Product", self.category.name, 4, "SKU-9", "new", 99, "Desc", ""]]
        )
        self.client.force_authenticate(self.vendor_a)
        response = self.client.post(
            "/api/ai/seller/bulk-upload/",
            {
                "excel_file": SimpleUploadedFile(
                    "owned.xlsx",
                    xlsx,
                    content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
                "store_id": self.store_a.id,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        batch_id = response.data["batch"]["id"]

        self.client.force_authenticate(self.vendor_b)
        response = self.client.get(f"/api/ai/seller/bulk-upload/{batch_id}/")
        self.assertEqual(response.status_code, 404)
        response = self.client.post(
            f"/api/ai/seller/bulk-upload/{batch_id}/approve-all/", {}, format="json"
        )
        self.assertEqual(response.status_code, 404)

        self.client.force_authenticate(self.vendor_a)
        response = self.client.post(
            f"/api/ai/seller/bulk-upload/{batch_id}/approve-all/", {}, format="json"
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["published_count"], 1)
        from products.models import Product

        product = Product.objects.get(title="Owned Product")
        self.assertEqual(product.vendor_stores, self.store_a)

    def test_buyer_endpoint_requires_authentication(self):
        response = self.client.post(
            "/api/ai/buyer/source-and-build-cart/",
            {"prompt": "phone"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)
