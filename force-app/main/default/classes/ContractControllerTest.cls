@isTest
private class ContractControllerTest {

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

    // ── sendContractEmail: happy path ─────────────────────────────────────────

    @isTest
    static void sendContractEmail_updatesOpportunity() {
        Opportunity opp = makeOpp();
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());

        Test.startTest();
        ContractController.sendContractEmail(
            opp.Id,
            EncodingUtil.base64Encode(Blob.valueOf('pdf')),
            'Contract.pdf',
            '<html>Contract HTML</html>'
        );
        Test.stopTest();

        Opportunity updated = [SELECT Contract_Status__c, Contract_Sent_Date__c,
                                      Contract_Token__c, StageName, Drive_Folder_URL__c,
                                      Contract_HTML__c
                               FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent',             updated.Contract_Status__c);
        System.assertEquals('Contract Sent',    updated.StageName);
        System.assertEquals(Date.today(),       updated.Contract_Sent_Date__c);
        System.assertNotEquals(null,            updated.Contract_Token__c, 'Token should be generated');
        System.assert(updated.Drive_Folder_URL__c.contains('drive.google.com'), 'Drive URL should be set');
        System.assertEquals('<html>Contract HTML</html>', updated.Contract_HTML__c);
    }

    // ── sendContractEmail: Drive succeeds, Gmail fails → AuraHandledException ──

    @isTest
    static void sendContractEmail_emailFailure_throwsAuraHandledException() {
        Opportunity opp = makeOpp();
        // 4 Drive OK, then Gmail 500
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveUpload().add(500, 'Mail Error'));

        Test.startTest();
        try {
            ContractController.sendContractEmail(
                opp.Id,
                EncodingUtil.base64Encode(Blob.valueOf('pdf')),
                'Contract.pdf',
                '<html>Contract</html>'
            );
            System.assert(false, 'Should have thrown AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Drive'), 'Message should mention Drive');
        }
        Test.stopTest();

        // DML should still have run
        Opportunity updated = [SELECT Contract_Status__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent', updated.Contract_Status__c, 'Status should be Sent even after email failure');
    }

    // ── Uses Account.Name when Client_Name_Formula__c is blank ───────────────

    @isTest
    static void sendContractEmail_usesAccountNameFallback() {
        Account acc = new Account(Name = 'Fallback Client');
        insert acc;
        Opportunity opp = new Opportunity(
            Name            = 'Test Event',
            StageName       = 'New Inquiry',
            CloseDate       = Date.today().addDays(30),
            AccountId       = acc.Id
        );
        insert opp;
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.driveAndGmail());

        Test.startTest();
        ContractController.sendContractEmail(
            opp.Id,
            EncodingUtil.base64Encode(Blob.valueOf('pdf')),
            'Contract.pdf',
            '<html>Contract</html>'
        );
        Test.stopTest();

        Opportunity updated = [SELECT Contract_Status__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Sent', updated.Contract_Status__c);
    }
}
