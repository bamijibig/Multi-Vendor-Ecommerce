from rest_framework import serializers

from home.models import DisplayHotProductInCategories, PopularCategories, SliderArea

from ..utils import absolute_image_url


class SliderAreaSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    discount = serializers.IntegerField(read_only=True)

    class Meta:
        model = SliderArea
        fields = ["id", "image", "title", "discount", "product_url"]

    def get_image(self, obj):
        return absolute_image_url(self.context.get("request"), obj.image)


class DisplayHotProductSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="categories.name", read_only=True)

    class Meta:
        model = DisplayHotProductInCategories
        fields = ["id", "image", "title", "categories", "category_name", "product_url"]

    def get_image(self, obj):
        return absolute_image_url(self.context.get("request"), obj.image)


class PopularCategorySerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="categories.name", read_only=True)
    category_slug = serializers.CharField(source="categories.slug", read_only=True)

    class Meta:
        model = PopularCategories
        fields = ["id", "image", "categories", "category_name", "category_slug"]

    def get_image(self, obj):
        return absolute_image_url(self.context.get("request"), obj.image)
