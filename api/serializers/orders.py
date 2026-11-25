from rest_framework import serializers

from products.models import CompletedOder, PlacedOder, PlacedeOderItem

from .auth import UserSerializer
from .cart import AddressSerializer
from .catalog import ProductListSerializer


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    vendor_store = serializers.SerializerMethodField()

    class Meta:
        model = PlacedeOderItem
        fields = ["id", "product", "quantity", "total_price", "vendor_store"]

    def get_vendor_store(self, obj):
        store = obj.product.vendor_stores
        if not store:
            return None
        return {"id": store.id, "name": store.name, "slug": store.slug}


class PlacedOrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(source="order_items", many=True, read_only=True)
    shipping_address = AddressSerializer(read_only=True)
    customer = UserSerializer(source="user", read_only=True)
    order_number = serializers.CharField(read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = PlacedOder
        fields = [
            "id",
            "order_number",
            "customer",
            "shipping_address",
            "sub_total_price",
            "status",
            "paid",
            "placed_date",
            "items",
            "item_count",
        ]

    def get_item_count(self, obj):
        return sum(item.quantity for item in obj.order_items.all())


class AdminOrderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlacedOder
        fields = ["status", "paid"]


class CompletedOrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(source="delivered_items", many=True, read_only=True)
    shipping_address = AddressSerializer(read_only=True)
    customer = UserSerializer(source="user", read_only=True)

    class Meta:
        model = CompletedOder
        fields = [
            "id",
            "oder_number",
            "customer",
            "shipping_address",
            "sub_total_price",
            "status",
            "paid",
            "complete_date",
            "items",
        ]


class VendorOrderItemSerializer(OrderItemSerializer):
    """Order item view for vendors, exposing the parent order context."""

    order_id = serializers.IntegerField(source="placed_oder.id", read_only=True)
    order_number = serializers.CharField(source="placed_oder.order_number", read_only=True)
    status = serializers.CharField(source="placed_oder.status", read_only=True)
    paid = serializers.BooleanField(source="placed_oder.paid", read_only=True)
    placed_date = serializers.DateTimeField(source="placed_oder.placed_date", read_only=True)
    customer_email = serializers.CharField(source="placed_oder.user.email", read_only=True)
    shipping_address = AddressSerializer(source="placed_oder.shipping_address", read_only=True)

    class Meta(OrderItemSerializer.Meta):
        fields = OrderItemSerializer.Meta.fields + [
            "order_id",
            "order_number",
            "status",
            "paid",
            "placed_date",
            "customer_email",
            "shipping_address",
        ]


class PlaceOrderSerializer(serializers.Serializer):
    shipping_address_id = serializers.IntegerField()
    payment_intent_id = serializers.CharField(required=False, allow_blank=True)
