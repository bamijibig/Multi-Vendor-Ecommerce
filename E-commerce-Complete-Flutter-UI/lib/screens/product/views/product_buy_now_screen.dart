import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shop/components/cart_button.dart';
import 'package:shop/components/custom_modal_bottom_sheet.dart';
import 'package:shop/components/network_image_with_loader.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/route/route_constants.dart';
import 'package:shop/screens/product/views/added_to_cart_message_screen.dart';
import 'package:shop/screens/product/views/components/product_list_tile.dart';
import 'package:shop/screens/product/views/components/product_quantity.dart';
import 'package:shop/screens/product/views/components/unit_price.dart';
import 'package:shop/services/api_client.dart';
import 'package:shop/state/app_scope.dart';

class ProductBuyNowScreen extends StatefulWidget {
  const ProductBuyNowScreen({super.key, required this.product});

  final Product product;

  @override
  State<ProductBuyNowScreen> createState() => _ProductBuyNowScreenState();
}

class _ProductBuyNowScreenState extends State<ProductBuyNowScreen> {
  int _quantity = 1;
  bool _submitting = false;

  int get _maxQuantity {
    final stock = widget.product.stoc;
    if (stock <= 0) return 1;
    return stock > 50 ? 50 : stock;
  }

  void _increment() {
    if (_quantity >= _maxQuantity) return;
    setState(() => _quantity++);
  }

  void _decrement() {
    if (_quantity <= 1) return;
    setState(() => _quantity--);
  }

  Future<void> _addToCart() async {
    if (_submitting) return;
    if (!widget.product.inStock) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("This product is currently out of stock.")),
      );
      return;
    }
    final app = AppScope.of(context);
    if (!app.isLoggedIn) {
      Navigator.of(context).pop();
      Navigator.pushNamed(context, logInScreenRoute);
      return;
    }
    setState(() => _submitting = true);
    try {
      await app.addToCart(widget.product.id, quantity: _quantity);
      if (!mounted) return;
      customModalBottomSheet(
        context,
        isDismissible: false,
        child: const AddedToCartMessageScreen(),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showStore() {
    final store = widget.product.vendorStore;
    customModalBottomSheet(
      context,
      height: MediaQuery.of(context).size.height * 0.5,
      child: Padding(
        padding: const EdgeInsets.all(defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Sold by", style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: defaultPadding),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                child: SvgPicture.asset(
                  "assets/icons/Stores.svg",
                  height: 24,
                  colorFilter: ColorFilter.mode(
                    Theme.of(context).iconTheme.color!,
                    BlendMode.srcIn,
                  ),
                ),
              ),
              title: Text(
                store?.name.isNotEmpty == true
                    ? store!.name
                    : "Independent seller",
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              subtitle: Text(
                store == null
                    ? "This product is listed without a vendor storefront."
                    : store.isOfficial
                        ? (store.tagline.isEmpty
                            ? store.badge
                            : store.tagline)
                        : "Marketplace vendor",
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final image =
        product.gallery.isEmpty ? '' : product.gallery.first;

    return Scaffold(
      bottomNavigationBar: CartButton(
        price: product.effectivePrice * _quantity,
        title: _submitting ? "Adding..." : "Add to cart",
        subTitle: "Total price",
        press: _addToCart,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: defaultPadding / 2, vertical: defaultPadding),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const BackButton(),
                Expanded(
                  child: Text(
                    product.title,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                ),
                IconButton(
                  onPressed: () {},
                  icon: SvgPicture.asset("assets/icons/Bookmark.svg",
                      color: Theme.of(context).textTheme.bodyLarge!.color),
                ),
              ],
            ),
          ),
          Expanded(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: defaultPadding),
                    child: AspectRatio(
                      aspectRatio: 1.05,
                      child: NetworkImageWithLoader(image),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.all(defaultPadding),
                  sliver: SliverToBoxAdapter(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: UnitPrice(
                            price: product.regularPrice,
                            priceAfterDiscount: product.hasDiscount
                                ? product.discountedPrice
                                : null,
                          ),
                        ),
                        ProductQuantity(
                          numOfItem: _quantity,
                          onIncrement: _increment,
                          onDecrement: _decrement,
                        ),
                      ],
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: Divider()),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(vertical: defaultPadding),
                  sliver: ProductListTile(
                    title: "Sold by",
                    svgSrc: "assets/icons/Stores.svg",
                    isShowBottomBorder: true,
                    press: _showStore,
                  ),
                ),
                SliverPadding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: defaultPadding),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: defaultPadding / 2),
                        Text(
                          "Availability",
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: defaultPadding / 2),
                        Text(
                          product.inStock
                              ? "${product.stoc} unit(s) available from this seller."
                              : "This product is currently out of stock.",
                        )
                      ],
                    ),
                  ),
                ),
                const SliverToBoxAdapter(
                    child: SizedBox(height: defaultPadding))
              ],
            ),
          )
        ],
      ),
    );
  }
}
