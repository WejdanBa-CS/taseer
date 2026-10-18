import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:taseer/main.dart';

void main() {
  testWidgets('يفتح غلاف تسعير', (tester) async {
    await tester.pumpWidget(const TaseerApp());
    expect(find.byType(TaseerShell), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
