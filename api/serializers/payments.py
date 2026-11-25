from rest_framework import serializers


class ConfirmPaymentSerializer(serializers.Serializer):
    payment_intent_id = serializers.CharField()
    shipping_address_id = serializers.IntegerField()
