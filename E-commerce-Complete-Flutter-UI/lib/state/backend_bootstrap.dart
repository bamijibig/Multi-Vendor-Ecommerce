import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shop/state/app_scope.dart';
import 'package:shop/state/app_state.dart';

/// Provides the shared [AppState] to the app and kicks off the first catalog
/// request.
class BackendBootstrap extends StatefulWidget {
  const BackendBootstrap({super.key, required this.child});

  final Widget child;

  @override
  State<BackendBootstrap> createState() => _BackendBootstrapState();
}

class _BackendBootstrapState extends State<BackendBootstrap> {
  late final AppState _appState = AppState();

  @override
  void initState() {
    super.initState();
    unawaited(_appState.initialize());
  }

  @override
  void dispose() {
    _appState.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(state: _appState, child: widget.child);
  }
}
