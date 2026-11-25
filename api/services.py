"""Order placement business logic.

Kept out of views so checkout, Stripe confirmation and future webhooks all use
exactly the same atomic, stock-safe flow.
"""

from django.db import transaction
from rest_framework.exceptions import ValidationError

from products.models import (
    Cart,
    CompletedOder,
    CompletedOderItems,
    CustomerAddress,
    PlacedOder,
    PlacedeOderItem,
    Product,
)


@transaction.atomic
def set_cart_item(user, product, quantity=1):
    """Set one product's quantity in the user's active cart.

    Shared by the AI concierge so it obeys the same stock and quantity rules as
    the regular cart API. Existing cart rows are updated rather than duplicated.
    """
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        raise ValidationError({"quantity": "Quantity must be a number."})

    if quantity < 1:
        raise ValidationError({"quantity": "Quantity must be at least 1."})
    if quantity > 50:
        raise ValidationError({"quantity": "Quantity cannot exceed 50."})
    if product.out_of_stoc or product.stoc <= 0:
        raise ValidationError({"product": "This product is out of stock."})
    if quantity > product.stoc:
        raise ValidationError(
            {"quantity": f"Only {product.stoc} unit(s) available."}
        )

    item, _ = Cart.objects.update_or_create(
        user=user, product=product, defaults={"quantity": quantity}
    )
    return item


@transaction.atomic
def place_order(user, shipping_address, paid=False):
    """Move the user's cart into a placed order and update stock.

    Raises ``ValidationError`` when the cart is empty, the address does not
    belong to the user, or a product has insufficient stock.
    """
    if not shipping_address or shipping_address.user_id != user.id:
        raise ValidationError({"shipping_address": "Select a valid shipping address."})

    cart_items = list(
        Cart.objects.select_related("product").filter(user=user).order_by("id")
    )
    if not cart_items:
        raise ValidationError({"cart": "Your cart is empty."})

    subtotal = Cart.subtotal_product_price(user)

    # Validate stock before creating anything so a failure leaves no residue.
    for item in cart_items:
        product = item.product
        if product.out_of_stoc or product.stoc < item.quantity:
            raise ValidationError(
                {"cart": f"'{product.title[:40]}' is out of stock or has insufficient quantity."}
            )

    order = PlacedOder.objects.create(
        user=user,
        shipping_address=shipping_address,
        sub_total_price=subtotal,
        paid=paid,
    )

    for item in cart_items:
        PlacedeOderItem.objects.create(
            placed_oder=order,
            product=item.product,
            quantity=item.quantity,
            total_price=item.total_product_price,
        )

        product = Product.objects.select_for_update().get(pk=item.product_id)
        product.stoc = max(product.stoc - item.quantity, 0)
        if product.stoc == 0:
            product.out_of_stoc = True
        product.save(update_fields=["stoc", "out_of_stoc"])

    # The cart shipping address choice is kept only until checkout completes.
    Cart.objects.filter(user=user).delete()
    return order


@transaction.atomic
def complete_order(order):
    """Copy a placed order into the completed-order tables, then remove it.

    Mirrors the legacy admin-panel behaviour while preserving both models.
    """
    completed = CompletedOder.objects.create(
        user=order.user,
        shipping_address=order.shipping_address,
        sub_total_price=order.sub_total_price or 0,
        status="Completed",
        paid=order.paid,
        oder_number=order.order_number or order.oder_id,
    )

    for item in order.order_items.select_related("product"):
        CompletedOderItems.objects.create(
            completed_oder=completed,
            product=item.product,
            quantity=item.quantity,
            total_price=item.total_price or 0,
        )

    from finance.services import record_completed_order

    record_completed_order(completed)

    order.delete()
    return completed
