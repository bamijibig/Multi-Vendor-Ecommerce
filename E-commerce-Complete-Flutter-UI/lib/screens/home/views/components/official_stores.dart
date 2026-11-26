import 'package:flutter/material.dart';
import 'package:shop/components/network_image_with_loader.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/models/product_query.dart';
import 'package:shop/route/route_constants.dart';

/// Official storefront rail (`vendor_stores.is_official == True`).
///
/// Uses the UI kit's card tokens (outlined button, 12 px radius, same spacing)
/// so it sits in the home feed without changing the template's visual design.
class OfficialStores extends StatelessWidget {
  const OfficialStores({
    super.key,
    this.stores = const <VendorStore>[],
  });

  final List<VendorStore> stores;

  @override
  Widget build(BuildContext context) {
    final visible = stores.where((store) => store.isOfficial).take(8).toList();
    if (visible.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: defaultPadding / 2),
        Padding(
          padding: const EdgeInsets.all(defaultPadding),
          child: Text(
            "Official stores",
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ),
        SizedBox(
          height: 112,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: visible.length,
            itemBuilder: (context, index) => Padding(
              padding: EdgeInsets.only(
                left: defaultPadding,
                right: index == visible.length - 1 ? defaultPadding : 0,
              ),
              child: _OfficialStoreCard(store: visible[index]),
            ),
          ),
        ),
      ],
    );
  }
}

class _OfficialStoreCard extends StatelessWidget {
  const _OfficialStoreCard({required this.store});

  final VendorStore store;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: () {
        Navigator.pushNamed(
          context,
          onSaleScreenRoute,
          arguments: ProductQuery(
            title: store.name,
            vendorStore: store.id,
            ordering: "-created_at",
          ),
        );
      },
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(170, 112),
        maximumSize: const Size(170, 112),
        padding: const EdgeInsets.all(defaultPadding / 2),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: NetworkImageWithLoader(
              store.logo,
              radius: defaultBorderRadious,
            ),
          ),
          const SizedBox(width: defaultPadding / 2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  store.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall!
                      .copyWith(fontSize: 12),
                ),
                const SizedBox(height: defaultPadding / 4),
                Text(
                  store.badge.isEmpty ? "Official Store" : store.badge,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium!
                      .copyWith(fontSize: 10),
                ),
                const SizedBox(height: defaultPadding / 4),
                Text(
                  "${store.productCount} products",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium!
                      .copyWith(fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
