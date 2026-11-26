import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shop/components/api_state_view.dart';
import 'package:shop/components/network_image_with_loader.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/route/route_constants.dart';
import 'package:shop/services/account_service.dart';
import 'package:shop/services/api_client.dart';
import 'package:shop/state/app_scope.dart';
import 'package:shop/state/app_state.dart';
import 'package:shop/utils/format.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key, this.showAppBar = false});

  /// The cart tab renders without an app bar; the pushed route needs one.
  final bool showAppBar;

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  int? _busyItemId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      AppScope.of(context).loadCart();
    });
  }

  Future<void> _changeQuantity(CartItem item, int quantity) async {
    if (quantity < 1 || _busyItemId != null) return;
    final app = AppScope.of(context);
    setState(() => _busyItemId = item.id);
    try {
      await app.updateCartItem(item.id, quantity);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _busyItemId = null);
    }
  }

  Future<void> _remove(CartItem item) async {
    if (_busyItemId != null) return;
    final app = AppScope.of(context);
    setState(() => _busyItemId = item.id);
    try {
      await app.removeCartItem(item.id);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _busyItemId = null);
    }
  }

  Future<void> _checkout() async {
    final app = AppScope.of(context);
    if (app.cart == null || app.cart!.items.isEmpty) return;
    try {
      final addresses = await AccountService.addresses();
      if (!mounted) return;
      if (addresses.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Add a delivery address before checking out."),
          ),
        );
        Navigator.pushNamed(context, addressesScreenRoute);
        return;
      }

      final selected = await showModalBottomSheet<Address>(
        context: context,
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.only(
            topLeft: Radius.circular(defaultBorderRadious * 2),
            topRight: Radius.circular(defaultBorderRadious * 2),
          ),
        ),
        builder: (sheetContext) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.all(defaultPadding),
            children: [
              Text(
                "Select a delivery address",
                style: Theme.of(sheetContext).textTheme.titleSmall,
              ),
              const SizedBox(height: defaultPadding),
              ...addresses.map(
                (address) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: SvgPicture.asset(
                    "assets/icons/Address.svg",
                    height: 24,
                    colorFilter: ColorFilter.mode(
                      Theme.of(sheetContext).iconTheme.color!,
                      BlendMode.srcIn,
                    ),
                  ),
                  title: Text(
                    address.streetAddress,
                    style: const TextStyle(fontSize: 14),
                  ),
                  subtitle: Text(address.fullAddress),
                  onTap: () => Navigator.pop(sheetContext, address),
                ),
              ),
            ],
          ),
        ),
      );
      if (selected == null || !mounted) return;

      final order = await app.placeOrder(selected.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            order == null ? "Order placed." : "Order ${order.orderNumber} placed.",
          ),
        ),
      );
      Navigator.pushNamed(context, ordersScreenRoute);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final body = _buildBody(context, app);
    if (!widget.showAppBar) return SafeArea(child: body);
    return Scaffold(
      appBar: AppBar(title: const Text("Cart")),
      body: SafeArea(child: body),
    );
  }

  Widget _buildBody(BuildContext context, AppState app) {
    if (!app.isLoggedIn) {
      return ApiEmptyView(
        imagePath: 'assets/Illustration/EmptyState_lightTheme.png',
        title: "Sign in to see your cart",
        message:
            "Your basket follows your account, so log in to pick up where you left off.",
        actionLabel: "Log in",
        onAction: () => Navigator.pushNamed(context, logInScreenRoute),
      );
    }

    final cart = app.cart;
    if (cart == null && app.isLoadingCart) {
      return const Center(child: CircularProgressIndicator());
    }
    if (cart == null && app.cartError != null) {
      return ApiErrorView(
        message: app.cartError!,
        onRetry: () => app.loadCart(),
      );
    }

    final items = cart == null
        ? const <CartItem>[]
        : cart.items.where((item) => item.product != null).toList();
    if (cart == null || items.isEmpty) {
      return ApiEmptyView(
        imagePath: 'assets/Illustration/EmptyState_lightTheme.png',
        title: "Your cart is empty",
        message: "Browse the catalog and add products to your cart.",
        actionLabel: "Start shopping",
        onAction: () => Navigator.pushNamed(context, entryPointScreenRoute),
      );
    }

    return RefreshIndicator(
      onRefresh: () => app.loadCart(),
      child: ListView(
        padding: const EdgeInsets.all(defaultPadding),
        children: [
          Text(
            "${cart.totalQuantity} item${cart.totalQuantity == 1 ? '' : 's'} in your cart",
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: defaultPadding),
          ...items.map(
            (item) => _CartItemTile(
              item: item,
              busy: _busyItemId == item.id,
              onIncrement: () => _changeQuantity(item, item.quantity + 1),
              onDecrement: () => _changeQuantity(item, item.quantity - 1),
              onRemove: () => _remove(item),
            ),
          ),
          if (cart.couponApplied && cart.coupon != null) ...[
            Row(
              children: [
                SvgPicture.asset(
                  "assets/icons/Coupon.svg",
                  height: 20,
                  colorFilter: ColorFilter.mode(
                    Theme.of(context).iconTheme.color!,
                    BlendMode.srcIn,
                  ),
                ),
                const SizedBox(width: defaultPadding / 2),
                Text(
                  "Coupon ${cart.coupon!.code} applied (${cart.coupon!.percent}% off)",
                ),
              ],
            ),
            const SizedBox(height: defaultPadding / 2),
          ],
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Subtotal", style: Theme.of(context).textTheme.titleSmall),
              Text(
                formatMoney(cart.subtotal),
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ],
          ),
          const SizedBox(height: defaultPadding / 4),
          const Text("Delivery fees are calculated by the vendor at fulfilment."),
          const SizedBox(height: defaultPadding),
          ElevatedButton(
            onPressed: (app.isPlacingOrder || _busyItemId != null)
                ? null
                : _checkout,
            child: app.isPlacingOrder
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text("Checkout"),
          ),
        ],
      ),
    );
  }
}

class _CartItemTile extends StatelessWidget {
  const _CartItemTile({
    required this.item,
    required this.busy,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
  });

  final CartItem item;
  final bool busy;
  final VoidCallback onIncrement, onDecrement, onRemove;

  @override
  Widget build(BuildContext context) {
    final product = item.product!;
    return Container(
      margin: const EdgeInsets.only(bottom: defaultPadding),
      padding: const EdgeInsets.all(defaultPadding / 2),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius:
            const BorderRadius.all(Radius.circular(defaultBorderRadious)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            height: 80,
            child: NetworkImageWithLoader(
              product.primaryImage ?? '',
              radius: defaultBorderRadious,
            ),
          ),
          const SizedBox(width: defaultPadding / 2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall!
                      .copyWith(fontSize: 12),
                ),
                const SizedBox(height: defaultPadding / 4),
                Text(
                  formatMoney(product.effectivePrice),
                  style: const TextStyle(
                    color: Color(0xFF31B0D8),
                    fontWeight: FontWeight.w500,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: defaultPadding / 2),
                Row(
                  children: [
                    _QuantityButton(
                      svgSrc: "assets/icons/Minus.svg",
                      onPressed: busy ? null : onDecrement,
                    ),
                    SizedBox(
                      width: 36,
                      child: Center(
                        child: Text(
                          item.quantity.toString(),
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium!
                              .copyWith(fontWeight: FontWeight.w500),
                        ),
                      ),
                    ),
                    _QuantityButton(
                      svgSrc: "assets/icons/Plus1.svg",
                      onPressed: busy ? null : onIncrement,
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: busy ? null : onRemove,
            icon: SvgPicture.asset(
              "assets/icons/Delete.svg",
              height: 20,
              colorFilter: ColorFilter.mode(
                Theme.of(context).textTheme.bodyMedium!.color!,
                BlendMode.srcIn,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuantityButton extends StatelessWidget {
  const _QuantityButton({required this.svgSrc, required this.onPressed});

  final String svgSrc;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 32,
      width: 32,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.all(defaultPadding / 2),
        ),
        child: SvgPicture.asset(
          svgSrc,
          color: Theme.of(context).iconTheme.color,
        ),
      ),
    );
  }
}
