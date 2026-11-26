import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shop/constants.dart';

class SignUpForm extends StatelessWidget {
  const SignUpForm({
    super.key,
    required this.formKey,
    required this.firstNameController,
    required this.lastNameController,
    required this.mobileController,
    required this.emailController,
    required this.passwordController,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController firstNameController,
      lastNameController,
      mobileController,
      emailController,
      passwordController;

  static String? _required(String? value) {
    if (value == null || value.trim().isEmpty) return 'Required';
    return null;
  }

  static String? _mobile(String? value) {
    if (value == null || value.trim().isEmpty) return 'Required';
    if (int.tryParse(value.trim()) == null) return 'Use digits only';
    return null;
  }

  Widget _prefixIcon(BuildContext context, String svgSrc) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: defaultPadding * 0.75),
      child: SvgPicture.asset(
        svgSrc,
        height: 24,
        width: 24,
        colorFilter: ColorFilter.mode(
          Theme.of(context).textTheme.bodyLarge!.color!.withOpacity(0.3),
          BlendMode.srcIn,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        children: [
          TextFormField(
            controller: firstNameController,
            validator: _required,
            textInputAction: TextInputAction.next,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
              hintText: "First name",
              prefixIcon: _prefixIcon(context, "assets/icons/Profile.svg"),
            ),
          ),
          const SizedBox(height: defaultPadding),
          TextFormField(
            controller: lastNameController,
            validator: _required,
            textInputAction: TextInputAction.next,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
              hintText: "Last name",
              prefixIcon: _prefixIcon(context, "assets/icons/Profile.svg"),
            ),
          ),
          const SizedBox(height: defaultPadding),
          TextFormField(
            controller: mobileController,
            validator: _mobile,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
            decoration: InputDecoration(
              hintText: "Mobile number",
              prefixIcon: _prefixIcon(context, "assets/icons/Call.svg"),
            ),
          ),
          const SizedBox(height: defaultPadding),
          TextFormField(
            controller: emailController,
            validator: emaildValidator.call,
            textInputAction: TextInputAction.next,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              hintText: "Email address",
              prefixIcon: _prefixIcon(context, "assets/icons/Message.svg"),
            ),
          ),
          const SizedBox(height: defaultPadding),
          TextFormField(
            controller: passwordController,
            validator: passwordValidator.call,
            obscureText: true,
            decoration: InputDecoration(
              hintText: "Password",
              prefixIcon: _prefixIcon(context, "assets/icons/Lock.svg"),
            ),
          ),
        ],
      ),
    );
  }
}
