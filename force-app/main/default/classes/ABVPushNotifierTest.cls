@isTest
private class ABVPushNotifierTest {

    @isTest
    static void notifyVeena_noException() {
        List<RecordType> rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true AND DeveloperName='Client' LIMIT 1];
        if (rts.isEmpty()) rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1];
        Account acc = new Account(FirstName='Test', LastName='Client');
        if (!rts.isEmpty()) acc.RecordTypeId = rts[0].Id;
        insert acc;
        Opportunity opp = new Opportunity(
            Name      = 'Test Event',
            StageName = 'New Inquiry',
            CloseDate = Date.today().addDays(30),
            AccountId = acc.Id
        );
        insert opp;

        Test.startTest();
        // ABVPushNotifier guards against missing notif type / missing user — should never throw
        ABVPushNotifier.notifyVeena('Test Title', 'Test body', opp.Id);
        Test.stopTest();

        System.assert(true, 'notifyVeena completed without exception');
    }

    @isTest
    static void notifyVeena_withInvalidTargetId_noException() {
        Test.startTest();
        ABVPushNotifier.notifyVeena('Title', 'Body', null);
        Test.stopTest();
        System.assert(true, 'notifyVeena with null target completed without exception');
    }
}
