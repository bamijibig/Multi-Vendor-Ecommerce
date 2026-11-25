from rest_framework import serializers

from products.models import Cart, CuponCodeGenaration, CustomerAddress, Product

from .catalog import ProductListSerializer


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = [
            "id",
            "state",
            "city",
            "zip_code",
            "street_address",
            "mobile",
            "is_billing",
            "is_shipping",
        ]
        read_only_fields = ["id"]


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuponCodeGenaration
        fields = ["id", "name", "cupon_code", "discoun_parcent", "up_to"]


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )
    total_product_price = serializers.SerializerMethodField()
    shipping_address = AddressSerializer(read_only=True)
    coupon = CouponSerializer(source="cupon_code", read_only=True)

    class Meta:
        model = Cart
        fields = [
            "id",
            "product",
            "product_id",
            "quantity",
            "total_product_price",
            "shipping_address",
            "cupon_applaied",
            "coupon",
            "last_updated",
        ]
        read_only_fields = ["id", "last_updated", "cupon_applaied"]

    def get_total_product_price(self, obj):
        return round(obj.total_product_price, 2)

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        if value > 50:
            raise serializers.ValidationError("Quantity cannot exceed 50.")
        return value


class CartItemWriteSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=1, max_value=50, default=1)

    def validate(self, attrs):
        product = attrs["product"]
        if product.out_of_stoc or product.stoc <= 0:
            raise serializers.ValidationError({"product": "This product is out of stock."})
        if attrs["quantity"] > product.stoc:
            raise serializers.ValidationError(
                {"quantity": f"Only {product.stoc} unit(s) available."}
            )
        return attrs
