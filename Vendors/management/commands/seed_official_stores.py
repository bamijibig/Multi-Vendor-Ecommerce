"""Mark or seed the marketplace's flagship official storefronts."""

from pathlib import Path
from xml.sax.saxutils import escape

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from Vendors.models import VendorStore
from accounts.models import CustomUser
from products.models import Categories, Product, ProductImage

OFFICIAL_STORES = [
    {
        "name": "Oraimo Store",
        "slug": "oraimo-store",
        "tagline": "Smart accessories and everyday power.",
        "products": [
            {
                "title": "Oraimo FreePods 4 ANC Earbuds",
                "category": "Smartphones & Accessories",
                "regular_price": 79,
                "discounted_parcent": 20,
                "stoc": 48,
                "modle": "OTW-324",
                "tag": "audio, wireless earbuds, noise cancelling",
                "image": "oraimo-freepods.svg",
                "image_label": "FreePods 4",
                "accent": "#c25a34",
                "description": (
                    "<p>Immersive active noise cancellation, punchy bass, and a "
                    "compact charging case built for all-day listening.</p>"
                ),
                "details_description": (
                    "<p>Bluetooth 5.3, up to 35 hours of combined playback, "
                    "fast USB-C charging, and touch controls.</p>"
                ),
            }
        ],
    },
    {
        "name": "Sinomart Store",
        "slug": "sinomart-store",
        "tagline": "Everyday essentials, unbeatable value.",
        "products": [
            {
                "title": "Sinomart 5L Digital Air Fryer",
                "category": "Home Decor",
                "regular_price": 129,
                "discounted_parcent": 15,
                "stoc": 32,
                "modle": "SM-AF5L",
                "tag": "kitchen, air fryer, home essentials",
                "image": "sinomart-air-fryer.svg",
                "image_label": "5L Air Fryer",
                "accent": "#9b6a43",
                "description": (
                    "<p>Crisp, golden results with little oil. A family-size "
                    "digital air fryer with eight one-touch cooking presets.</p>"
                ),
                "details_description": (
                    "<p>5-litre basket, 1500W rapid heating, dishwasher-safe "
                    "parts, and an auto-shutoff timer for everyday safety.</p>"
                ),
            }
        ],
    },
    {
        "name": "Souvenir Republic",
        "slug": "souvenir-republic",
        "tagline": "Curated keepsakes and memorable gifts.",
        "products": [
            {
                "title": "Souvenir Republic Celebration Gift Box",
                "category": "Home Decor",
                "regular_price": 64,
                "discounted_parcent": 10,
                "stoc": 25,
                "modle": "SR-GIFT-01",
                "tag": "gift box, keepsake, celebration",
                "image": "souvenir-gift-box.svg",
                "image_label": "Celebration Box",
                "accent": "#7a5c78",
                "description": (
                    "<p>A thoughtfully curated keepsake box for birthdays, "
                    "housewarmings, and milestones worth remembering.</p>"
                ),
                "details_description": (
                    "<p>Includes a ceramic trinket dish, illustrated cards, "
                    "ribbon-tied packaging, and a personalised gift note.</p>"
                ),
            }
        ],
    },
]


def seed_image(filename, label, accent):
    """Create lightweight local product artwork when it does not exist yet."""
    directory = Path(settings.MEDIA_ROOT) / "seed"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / filename
    if not path.exists():
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6f2ea"/>
      <stop offset="1" stop-color="{accent}"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffdf9"/>
      <stop offset="1" stop-color="#efe7da"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1100" fill="url(#bg)"/>
  <circle cx="760" cy="180" r="190" fill="#ffffff" opacity="0.14"/>
  <circle cx="120" cy="940" r="240" fill="#28241f" opacity="0.10"/>
  <rect x="150" y="250" width="600" height="640" rx="48" fill="url(#card)" stroke="#28241f" stroke-opacity="0.12" stroke-width="4"/>
  <rect x="210" y="320" width="480" height="300" rx="28" fill="{accent}" opacity="0.16"/>
  <circle cx="450" cy="470" r="112" fill="{accent}" opacity="0.88"/>
  <circle cx="450" cy="470" r="72" fill="#fffdf9" opacity="0.90"/>
  <text x="450" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#28241f">{escape(label)}</text>
  <text x="450" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" letter-spacing="7" fill="#756e64">OFFICIAL STORE</text>
  <text x="450" y="980" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" letter-spacing="4" fill="#fffdf9">CURATED BY THE MARKETPLACE</text>
</svg>
"""
        path.write_text(svg, encoding="utf-8")
    return f"seed/{filename}"


class Command(BaseCommand):
    help = (
        "Mark the flagship stores as official. Existing stores are matched by "
        "name; pass --create to create demo vendor accounts/stores when missing "
        "and --with-products to seed one flagship product per store."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--create",
            action="store_true",
            help="Create missing official stores with demo vendor accounts.",
        )
        parser.add_argument(
            "--with-products",
            action="store_true",
            help="Seed one flagship product for each official store.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing to the database.",
        )

    def handle(self, *args, **options):
        create = options["create"]
        with_products = options["with_products"]
        dry_run = options["dry_run"]

        for seed in OFFICIAL_STORES:
            store = VendorStore.objects.filter(name__iexact=seed["name"]).first()
            if store:
                changed = []
                if not store.is_official:
                    store.is_official = True
                    changed.append("is_official")
                if not store.official_badge:
                    store.official_badge = "Official Store"
                    changed.append("official_badge")
                if not store.official_tagline:
                    store.official_tagline = seed["tagline"]
                    changed.append("official_tagline")
                if changed and not dry_run:
                    store.save(update_fields=changed)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"{seed['name']}: "
                        + ("marked official" if changed else "already official")
                        + (" (dry run)" if dry_run else "")
                    )
                )
            elif not create:
                self.stdout.write(
                    self.style.WARNING(
                        f"{seed['name']}: not found. Run with --create to seed it."
                    )
                )
                continue
            elif dry_run:
                self.stdout.write(
                    self.style.SUCCESS(f"{seed['name']}: would be created (dry run)")
                )
                continue

            if dry_run and store is None:
                continue

            if store is None:
                email = f"vendor+{seed['slug']}@official.local"
                user = CustomUser.objects.filter(email=email).first()
                if user is None:
                    user = CustomUser.objects.create_user(
                        email=email,
                        password=None,
                        first_name=seed["name"].split()[0],
                        last_name="Official",
                        mobile=0,
                        user_role="3",
                    )
                store = VendorStore.objects.create(
                    user=user,
                    name=seed["name"],
                    status=VendorStore.STATUS_ACTIVE,
                    is_official=True,
                    official_badge="Official Store",
                    official_tagline=seed["tagline"],
                )
                self.stdout.write(
                    self.style.SUCCESS(f"{seed['name']}: created official storefront")
                )

            if with_products:
                self.seed_products(store, seed["products"], dry_run)

    def seed_products(self, store, products, dry_run):
        for item in products:
            existing = Product.objects.filter(
                vendor_stores=store, title=item["title"]
            ).first()
            if existing:
                self.stdout.write(
                    self.style.WARNING(
                        f"  {item['title']}: already exists"
                        + (" (dry run)" if dry_run else "")
                    )
                )
                product = existing
            elif dry_run:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  {item['title']}: would be created (dry run)"
                    )
                )
                continue
            else:
                category = Categories.objects.filter(
                    name__iexact=item["category"]
                ).first()
                if category is None:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  {item['title']}: skipped, category "
                            f"'{item['category']}' not found"
                        )
                    )
                    continue
                product = Product.objects.create(
                    title=item["title"],
                    regular_price=item["regular_price"],
                    discounted_parcent=item["discounted_parcent"],
                    stoc=item["stoc"],
                    modle=item["modle"],
                    tag=item["tag"],
                    categories=category,
                    vendor_stores=store,
                    description=item["description"],
                    details_description=item["details_description"],
                    moderation_status=Product.MODERATION_APPROVED,
                )
                self.stdout.write(
                    self.style.SUCCESS(f"  {item['title']}: created")
                )

            if not product.productimage_set.exists() and not dry_run:
                image_path = seed_image(
                    item["image"], item["image_label"], item["accent"]
                )
                ProductImage.objects.create(product=product, image=image_path)
                self.stdout.write(
                    self.style.SUCCESS(f"  {item['title']}: artwork added")
                )
