@isTest
private class QuoteControllerTest {

    static Account makeAccount(String firstName, String lastName) {
        List<RecordType> rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true AND DeveloperName='Client' LIMIT 1];
        if (rts.isEmpty()) rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1];
        Account acc = new Account(FirstName=firstName, LastName=lastName);
        if (!rts.isEmpty()) acc.RecordTypeId = rts[0].Id;
        insert acc;
        return acc;
    }

    static Opportunity makeOpp() {
        Account acc = makeAccount('Test', 'Client');
        Opportunity opp = new Opportunity(
            Name      = 'Test Wedding',
            StageName = 'New Inquiry',
            CloseDate = Date.today().addDays(60),
            AccountId = acc.Id
        );
        insert opp;
        return opp;
    }

    // ── sendQuoteEmail: happy path ────────────────────────────────────────────

    @isTest
    static void sendQuoteEmail_updatesOpportunity() {
        Opportunity opp = makeOpp();
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());

        Test.startTest();
        QuoteController.sendQuoteEmail(
            opp.Id,
            EncodingUtil.base64Encode(Blob.valueOf('pdf')),
            'Quote.pdf',
            '<html>Quote HTML</html>'
        );
        Test.stopTest();

        Opportunity updated = [SELECT Quote_Status__c, Quote_Sent_Date__c,
                                      Quote_Token__c, StageName, Drive_Folder_URL__c,
                                      Quote_HTML__c
                               FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent',                updated.Quote_Status__c);
        System.assertEquals('Building Proposal',   updated.StageName);
        System.assertEquals(Date.today(),           updated.Quote_Sent_Date__c);
        System.assertNotEquals(null,                updated.Quote_Token__c, 'Token should be generated');
        System.assert(updated.Drive_Folder_URL__c.contains('drive.google.com'), 'Drive URL should be set');
        System.assertEquals('<html>Quote HTML</html>', updated.Quote_HTML__c);
    }

    // ── sendQuoteEmail: Drive succeeds, Gmail fails → AuraHandledException ────

    @isTest
    static void sendQuoteEmail_emailFailure_throwsAuraHandledException() {
        Opportunity opp = makeOpp();
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveUpload().add(500, 'Mail Error'));

        Test.startTest();
        try {
            QuoteController.sendQuoteEmail(
                opp.Id,
                EncodingUtil.base64Encode(Blob.valueOf('pdf')),
                'Quote.pdf',
                '<html>Quote</html>'
            );
            System.assert(false, 'Should have thrown AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(true, 'AuraHandledException thrown as expected after email failure');
        }
        Test.stopTest();

        Opportunity updated = [SELECT Quote_Status__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent', updated.Quote_Status__c, 'Status should be Sent even after email failure');
    }

    // ── Token is generated on send ────────────────────────────────────────────

    @isTest
    static void sendQuoteEmail_generatesToken() {
        Opportunity opp = makeOpp();
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());

        Test.startTest();
        QuoteController.sendQuoteEmail(opp.Id, EncodingUtil.base64Encode(Blob.valueOf('p')), 'q.pdf', '<html/>');
        Test.stopTest();

        Opportunity updated = [SELECT Quote_Token__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertNotEquals(null, updated.Quote_Token__c, 'Token should be generated');
        System.assert(updated.Quote_Token__c.length() > 10, 'Token should be non-trivial');
    }
}
