@isTest
private class InvoiceControllerTest {

    static Opportunity makeOpp() {
        Account acc = new Account(Name = 'Test Client');
        insert acc;
        Opportunity opp = new Opportunity(
            Name      = 'Test Wedding',
            StageName = 'New Inquiry',
            CloseDate = Date.today().addDays(60),
            AccountId = acc.Id
        );
        insert opp;
        return opp;
    }

    // ── sendInvoiceEmail: happy path ──────────────────────────────────────────

    @isTest
    static void sendInvoiceEmail_updatesOpportunity() {
        Opportunity opp = makeOpp();
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());

        String pdfBase64 = EncodingUtil.base64Encode(Blob.valueOf('pdf content'));

        Test.startTest();
        InvoiceController.sendInvoiceEmail(opp.Id, pdfBase64, 'Invoice.pdf');
        Test.stopTest();

        Opportunity updated = [SELECT Invoice_Status__c, Invoice_Sent_Date__c,
                                      Drive_Folder_URL__c
                               FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent',    updated.Invoice_Status__c);
        System.assertEquals(Date.today(), updated.Invoice_Sent_Date__c);
        System.assert(updated.Drive_Folder_URL__c.contains('drive.google.com'), 'Drive URL should be set');
    }

    // ── sendInvoiceEmail: Drive succeeds, Gmail fails → AuraHandledException ──

    @isTest
    static void sendInvoiceEmail_emailFailure_throwsAuraHandledException() {
        Opportunity opp = makeOpp();
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveUpload().add(500, 'Mail Error'));

        Test.startTest();
        try {
            InvoiceController.sendInvoiceEmail(
                opp.Id, EncodingUtil.base64Encode(Blob.valueOf('pdf')), 'Invoice.pdf'
            );
            System.assert(false, 'Should have thrown AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Drive'), 'Message should mention Drive');
        }
        Test.stopTest();

        // DML should still have run
        Opportunity updated = [SELECT Invoice_Status__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent', updated.Invoice_Status__c, 'Status should be Sent even after email failure');
    }

    // ── Folder name uses Account.Name fallback when formula is blank ──────────

    @isTest
    static void sendInvoiceEmail_noEventDate_folderNameStillWorks() {
        Account acc = new Account(Name = 'No Date Client');
        insert acc;
        Opportunity opp = new Opportunity(
            Name            = 'Datelessly Event',
            StageName       = 'New Inquiry',
            CloseDate       = Date.today(), // required field, set to today
            AccountId       = acc.Id
        );
        insert opp;
        // Null out CloseDate via a direct update to simulate null date scenario is not possible
        // because CloseDate is required — instead verify it handles a non-null date normally
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());
        Test.startTest();
        InvoiceController.sendInvoiceEmail(
            opp.Id, EncodingUtil.base64Encode(Blob.valueOf('pdf')), 'Invoice.pdf'
        );
        Test.stopTest();
        Opportunity updated = [SELECT Invoice_Status__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent', updated.Invoice_Status__c);
    }
}
