import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shop/components/api_state_view.dart';
import 'package:shop/components/custom_modal_bottom_sheet.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/services/account_service.dart';
import 'package:shop/services/api_client.dart';

class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<Address>? _addresses;
  String? _error;
  int? _deletingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final addresses = await AccountService.addresses();
      if (!mounted) return;
      setState(() => _addresses = addresses);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  Future<void> _delete(Address address) async {
    if (_deletingId != null) return;
    setState(() => _deletingId = address.id);
    try {
      await AccountService.deleteAddress(address.id);
      if (!mounted) return;
      await _load();
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  Future<void> _addAddress() async {
    await customModalBottomSheet(
      context,
      height: MediaQuery.of(context).size.height * 0.9,
      child: const _AddressForm(),
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final addresses = _addresses;

    return Scaffold(
      appBar: AppBar(title: const Text("Addresses")),
      body: _error != null
          ? ApiErrorView(message: _error!, onRetry: _load)
          : addresses == null
              ? const Center(child: CircularProgressIndicator())
              : addresses.isEmpty
                  ? ApiEmptyView(
                      imagePath: 'assets/Illustration/EmptyState_lightTheme.png',
                      title: "No saved addresses",
                      message: "Add a delivery address to check out faster.",
                      actionLabel: "Add address",
                      onAction: _addAddress,
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(defaultPadding),
                      itemCount: addresses.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final address = addresses[index];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: SvgPicture.asset(
                            "assets/icons/Address.svg",
                            height: 24,
                            colorFilter: ColorFilter.mode(
                              Theme.of(context).iconTheme.color!,
                              BlendMode.srcIn,
                            ),
                          ),
                          title: Text(
                            address.streetAddress,
                            style: const TextStyle(fontSize: 14),
                          ),
                          subtitle: Text(
                            '${address.fullAddress}\n${address.mobile}',
                          ),
                          isThreeLine: true,
                          trailing: IconButton(
                            onPressed:
                                _deletingId == null ? () => _delete(address) : null,
                            icon: SvgPicture.asset(
                              "assets/icons/Delete.svg",
                              height: 20,
                              colorFilter: const ColorFilter.mode(
                                errorColor,
                                BlendMode.srcIn,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(defaultPadding),
        child: ElevatedButton(
          onPressed: _addAddress,
          child: const Text("Add new address"),
        ),
      ),
    );
  }
}

class _AddressForm extends StatefulWidget {
  const _AddressForm();

  @override
  State<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<_AddressForm> {
  final _formKey = GlobalKey<FormState>();
  final _streetController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _zipController = TextEditingController();
  final _mobileController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _streetController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _zipController.dispose();
    _mobileController.dispose();
    super.dispose();
  }

  String? _required(String? value) {
    if (value == null || value.trim().isEmpty) return "Required";
    return null;
  }

  String? _number(String? value) {
    if (value == null || value.trim().isEmpty) return "Required";
    if (int.tryParse(value.trim()) == null) return "Use digits only";
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final address = await AccountService.createAddress(
        state: _stateController.text,
        city: _cityController.text,
        zipCode: _zipController.text,
        streetAddress: _streetController.text,
        mobile: _mobileController.text,
      );
      if (!mounted) return;
      Navigator.pop(context, address);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(defaultPadding),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Add new address",
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: defaultPadding),
              TextFormField(
                controller: _streetController,
                validator: _required,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(hintText: "Street address"),
              ),
              const SizedBox(height: defaultPadding),
              TextFormField(
                controller: _cityController,
                validator: _required,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(hintText: "City"),
              ),
              const SizedBox(height: defaultPadding),
              TextFormField(
                controller: _stateController,
                validator: _required,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(hintText: "State"),
              ),
              const SizedBox(height: defaultPadding),
              TextFormField(
                controller: _zipController,
                validator: _number,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(hintText: "Zip code"),
              ),
              const SizedBox(height: defaultPadding),
              TextFormField(
                controller: _mobileController,
                validator: _number,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(hintText: "Mobile number"),
              ),
              const SizedBox(height: defaultPadding * 2),
              ElevatedButton(
                onPressed: _saving ? null : _submit,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text("Save address"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
