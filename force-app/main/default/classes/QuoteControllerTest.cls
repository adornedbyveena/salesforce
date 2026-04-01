@isTest
private class QuoteControllerTest {

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
            System.assert(e.getMessage().contains('Drive'), 'Message should mention Drive');
        }
        Test.stopTest();

        Opportunity updated = [SELECT Quote_Status__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent', updated.Quote_Status__c, 'Status should be Sent even after email failure');
    }

    // ── Token is unique per invocation ────────────────────────────────────────

    @isTest
    static void sendQuoteEmail_generatesUniqueToken() {
        Account acc = new Account(Name = 'Token Test Client');
        insert acc;
        Opportunity opp1 = new Opportunity(Name='Event 1', StageName='New Inquiry', CloseDate=Date.today().addDays(30), AccountId=acc.Id);
        Opportunity opp2 = new Opportunity(Name='Event 2', StageName='New Inquiry', CloseDate=Date.today().addDays(60), AccountId=acc.Id);
        insert new List<Opportunity>{ opp1, opp2 };

        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());
        Test.startTest();
        QuoteController.sendQuoteEmail(opp1.Id, EncodingUtil.base64Encode(Blob.valueOf('p')), 'q1.pdf', '<html/>');
        Test.stopTest();

        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());
        Test.startTest();
        QuoteController.sendQuoteEmail(opp2.Id, EncodingUtil.base64Encode(Blob.valueOf('p')), 'q2.pdf', '<html/>');
        Test.stopTest();

        List<Opportunity> results = [SELECT Quote_Token__c FROM Opportunity WHERE Id IN :new List<Id>{opp1.Id, opp2.Id}];
        System.assertNotEquals(results[0].Quote_Token__c, results[1].Quote_Token__c, 'Tokens should be unique');
    }
}
