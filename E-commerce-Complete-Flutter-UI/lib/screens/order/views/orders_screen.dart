import 'package:flutter/material.dart';
import 'package:shop/components/api_state_view.dart';
import 'package:shop/components/network_image_with_loader.dart';
import 'package:shop/components/order_process.dart';
import 'package:shop/components/order_status_card.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/route/route_constants.dart';
import 'package:shop/state/app_scope.dart';
import 'package:shop/utils/format.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      AppScope.of(context).loadOrders(force: true);
    });
  }

  List<Widget> _products(Order order) {
    return order.items
        .map(
          (item) => Padding(
            padding: const EdgeInsets.symmetric(vertical: defaultPadding / 4),
            child: Row(
              children: [
                SizedBox(
                  width: 48,
                  height: 48,
                  child: NetworkImageWithLoader(
                    item.product?.primaryImage ?? '',
                    radius: defaultBorderRadious,
                  ),
                ),
                const SizedBox(width: defaultPadding / 2),
                Expanded(
                  child: Text(
                    item.product?.title ?? "Product",
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
                const SizedBox(width: defaultPadding / 2),
                Text("x${item.quantity}"),
              ],
            ),
          ),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    if (!app.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text("Orders")),
        body: ApiEmptyView(
          imagePath: 'assets/Illustration/EmptyState_lightTheme.png',
          title: "Sign in to see your orders",
          message: "Your order history is linked to your account.",
          actionLabel: "Log in",
          onAction: () => Navigator.pushNamed(context, logInScreenRoute),
        ),
      );
    }

    final orders = app.orders;
    return Scaffold(
      appBar: AppBar(title: const Text("Orders")),
      body: orders == null
          ? (app.ordersError != null
              ? ApiErrorView(
                  message: app.ordersError!,
                  onRetry: () => app.loadOrders(force: true),
                )
              : const Center(child: CircularProgressIndicator()))
          : orders.isEmpty
              ? const ApiEmptyView(
                  title: "No orders yet",
                  message: "Your completed checkouts will appear here.",
                )
              : RefreshIndicator(
                  onRefresh: () => app.loadOrders(force: true),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(defaultPadding),
                    itemCount: orders.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: defaultPadding),
                    itemBuilder: (context, index) {
                      final order = orders[index];
                      final normalized = order.status.toLowerCase();

                      var processing = OrderProcessStatus.notDoneYeat;
                      var packed = OrderProcessStatus.notDoneYeat;
                      var shipped = OrderProcessStatus.notDoneYeat;
                      var delivered = OrderProcessStatus.notDoneYeat;

                      if (normalized.contains("packed")) {
                        processing = OrderProcessStatus.done;
                        packed = OrderProcessStatus.processing;
                      } else if (normalized.contains("way")) {
                        processing = OrderProcessStatus.done;
                        packed = OrderProcessStatus.done;
                        shipped = OrderProcessStatus.processing;
                      } else if (normalized.contains("shipped")) {
                        processing = OrderProcessStatus.done;
                        packed = OrderProcessStatus.done;
                        shipped = OrderProcessStatus.done;
                        delivered = OrderProcessStatus.processing;
                      } else {
                        processing = OrderProcessStatus.processing;
                      }

                      return OrderStatusCard(
                        orderId: order.orderNumber,
                        placedOn: formatDate(order.placedDate),
                        products: _products(order),
                        orderStatus: OrderProcessStatus.done,
                        processingStatus: processing,
                        packedStatus: packed,
                        shippedStatus: shipped,
                        deliveredStatus: delivered,
                      );
                    },
                  ),
                ),
    );
  }
}
