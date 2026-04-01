@isTest
private class GoogleDriveServiceTest {

    // ── uploadContract: both folders already exist ────────────────────────────

    @isTest
    static void uploadContract_foldersExist_returnsUrl() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveUpload());
        Test.startTest();
        String url = GoogleDriveService.uploadContract(
            'Priya Kumar - 06/27/2026', 'invoice.pdf', Blob.valueOf('pdf content')
        );
        Test.stopTest();
        System.assert(url.contains('drive.google.com'), 'Should return Drive folder URL');
        System.assertEquals('https://drive.google.com/drive/folders/eventFolderId', url);
    }

    // ── uploadContract: root folder missing, event folder missing ─────────────

    @isTest
    static void uploadContract_foldersNotExist_createsAndReturnsUrl() {
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout()
            .add(200, '{"files":[]}')         // search root: not found
            .add(200, '{"id":"newRootId"}')   // create root folder
            .add(200, '{"files":[]}')         // search event folder: not found
            .add(200, '{"id":"newEventId"}')  // create event folder
            .add(200, '{"id":"newFileId"}')   // create file metadata
            .add(200, '{"id":"newFileId"}')   // upload PDF
        );
        Test.startTest();
        String url = GoogleDriveService.uploadContract(
            'New Client - 06/27/2026', 'contract.pdf', Blob.valueOf('pdf')
        );
        Test.stopTest();
        System.assert(url.contains('drive.google.com'), 'Should return Drive folder URL');
    }

    // ── 401 throws AuraHandledException ──────────────────────────────────────

    @isTest
    static void uploadContract_401_throwsAuraHandledException() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok('').add(401, ''));
        Test.startTest();
        try {
            GoogleDriveService.uploadContract('Test', 'file.pdf', Blob.valueOf('x'));
            System.assert(false, 'Should have thrown');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('authentication'), 'Expected reauth message');
        }
        Test.stopTest();
    }

    // ── Non-200 throws AuraHandledException ──────────────────────────────────

    @isTest
    static void uploadContract_500_throwsAuraHandledException() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok('').add(500, 'Server Error'));
        Test.startTest();
        try {
            GoogleDriveService.uploadContract('Test', 'file.pdf', Blob.valueOf('x'));
            System.assert(false, 'Should have thrown');
        } catch (AuraHandledException e) {
            System.assert(true, 'AuraHandledException thrown as expected');
        }
        Test.stopTest();
    }
}
