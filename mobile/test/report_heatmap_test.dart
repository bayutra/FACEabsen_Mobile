import 'package:face_absen_mobile/features/admin/reports/domain/report_admin_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AdminReport heatmap', () {
    test('parses heatmap cells and peak metadata', () {
      final List<List<int>> cells = List<List<int>>.generate(
        7,
        (int day) => List<int>.generate(
          24,
          (int hour) => day == 0 && hour == 14 ? 3 : 0,
        ),
      );
      final AdminReport report = AdminReport.fromResponse(<String, dynamic>{
        'title': 'Heatmap Kehadiran',
        'generatedAt': '2026-10-26T10:00:00.000Z',
        'summary': <dynamic>[
          <String>['Total check-in', '3'],
        ],
        'days': <String>['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
        'hours': <int>[for (int h = 0; h < 24; h++) h],
        'cells': cells,
        'maxCount': 3,
        'totalCheckIns': 3,
        'lateCheckIns': 1,
        'peak': <String, dynamic>{'day': 'Senin', 'hour': 14, 'count': 3},
      });

      final AdminHeatmap heatmap = report.heatmap!;
      expect(heatmap.cells[0][14], 3);
      expect(heatmap.maxCount, 3);
      expect(heatmap.totalCheckIns, 3);
      expect(heatmap.lateCheckIns, 1);
      expect(heatmap.peakDay, 'Senin');
      expect(heatmap.peakHour, 14);
      expect(heatmap.peakCount, 3);
      expect(report.isEmpty, isFalse);
    });

    test('regular tabular reports keep heatmap null', () {
      final AdminReport report = AdminReport.fromResponse(<String, dynamic>{
        'title': 'Laporan Harian',
        'headers': <String>['NIP'],
        'rows': <dynamic>[
          <String>['EMP-1'],
        ],
      });

      expect(report.heatmap, isNull);
      expect(report.isEmpty, isFalse);
    });

    test('heatmap report kind has a stable API code', () {
      expect(ReportKind.heatmap.code, 'heatmap');
      expect(ReportKind.fromCode('heatmap'), ReportKind.heatmap);
    });
  });
}
