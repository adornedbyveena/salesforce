@isTest
private class DriveFolderControllerTest {

    static final String FILES_RESPONSE = '{"files":['
        + '{"id":"file1","name":"Contract.pdf","mimeType":"application/pdf",'
        + '"webViewLink":"https://drive.google.com/file/d/file1","modifiedTime":"2026-01-01T00:00:00Z"}'
        + ']}';

    // ── getFilesInFolder: returns file list ───────────────────────────────────

    @isTest
    static void getFilesInFolder_returnsFiles() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(FILES_RESPONSE));
        Test.startTest();
        List<Map<String,String>> files = DriveFolderController.getFilesInFolder(
            'https://drive.google.com/drive/folders/testFolderId'
        );
        Test.stopTest();
        System.assertEquals(1, files.size(), 'Should return 1 file');
        System.assertEquals('Contract.pdf', files[0].get('name'));
        System.assertEquals('application/pdf', files[0].get('mimeType'));
    }

    // ── Blank URL returns empty list without callout ──────────────────────────

    @isTest
    static void getFilesInFolder_blankUrl_returnsEmpty() {
        Test.startTest();
        List<Map<String,String>> files = DriveFolderController.getFilesInFolder('');
        Test.stopTest();
        System.assertEquals(0, files.size(), 'Blank URL should return empty list');
    }

    // ── Null files in response returns empty list ─────────────────────────────

    @isTest
    static void getFilesInFolder_noFilesKey_returnsEmpty() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok('{}'));
        Test.startTest();
        List<Map<String,String>> files = DriveFolderController.getFilesInFolder(
            'https://drive.google.com/drive/folders/emptyFolderId'
        );
        Test.stopTest();
        System.assertEquals(0, files.size(), 'No files key should return empty list');
    }

    // ── 401 throws AuraHandledException ──────────────────────────────────────

    @isTest
    static void getFilesInFolder_401_throwsAuraHandledException() {
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout().add(401, ''));
        Test.startTest();
        try {
            DriveFolderController.getFilesInFolder('https://drive.google.com/drive/folders/x');
            System.assert(false, 'Should have thrown');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('authentication'), 'Expected reauth message');
        }
        Test.stopTest();
    }

    // ── Non-200 throws AuraHandledException ──────────────────────────────────

    @isTest
    static void getFilesInFolder_500_throwsAuraHandledException() {
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout().add(500, 'Error'));
        Test.startTest();
        try {
            DriveFolderController.getFilesInFolder('https://drive.google.com/drive/folders/x');
            System.assert(false, 'Should have thrown');
        } catch (AuraHandledException e) {
            System.assert(true, 'AuraHandledException thrown as expected');
        }
        Test.stopTest();
    }
}
