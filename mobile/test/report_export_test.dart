import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:face_absen_mobile/features/admin/reports/data/report_admin_repository.dart';
import 'package:face_absen_mobile/features/admin/reports/domain/report_admin_models.dart';
import 'package:flutter_test/flutter_test.dart';

class _ExportAdapter implements HttpClientAdapter {
  _ExportAdapter({this.filename, this.contentType = 'application/pdf'});

  final String? filename;
  final String? contentType;
  RequestOptions? lastOptions;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastOptions = options;
    return ResponseBody.fromBytes(
      const <int>[0x25, 0x50, 0x44, 0x46],
      200,
      headers: <String, List<String>>{
        if (contentType != null)
          Headers.contentTypeHeader: <String>[contentType!],
        if (filename != null)
          'content-disposition': <String>[
            'attachment; filename="$filename"',
          ],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('ReportAdminRepository.export', () {
    test('requests bytes with the selected format and reads the filename',
        () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));
      final _ExportAdapter adapter = _ExportAdapter(
        filename: 'laporan-harian.pdf',
      );
      dio.httpClientAdapter = adapter;
      final ReportAdminRepository repo = ReportAdminRepository(dio: dio);

      final ReportExport file = await repo.export(
        ReportKind.daily,
        format: 'pdf',
        date: '2026-10-27',
      );

      expect(adapter.lastOptions?.path, '/reports/daily');
      expect(adapter.lastOptions?.queryParameters['date'], '2026-10-27');
      expect(adapter.lastOptions?.queryParameters['format'], 'pdf');
      expect(adapter.lastOptions?.responseType, ResponseType.bytes);
      expect(file.filename, 'laporan-harian.pdf');
      expect(file.mimeType, 'application/pdf');
      expect(file.bytes, Uint8List.fromList(<int>[0x25, 0x50, 0x44, 0x46]));
    });

    test('falls back to a safe filename and MIME type without headers',
        () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'));
      dio.httpClientAdapter = _ExportAdapter(contentType: null);
      final ReportAdminRepository repo = ReportAdminRepository(dio: dio);

      final ReportExport file = await repo.export(
        ReportKind.monthly,
        format: 'xlsx',
        month: '2026-10',
      );

      expect(file.filename, 'laporan-monthly-2026-10.xlsx');
      expect(
        file.mimeType,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });
}
