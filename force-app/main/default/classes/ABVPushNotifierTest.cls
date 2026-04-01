@isTest
private class ABVPushNotifierTest {

    @isTest
    static void notifyVeena_noException() {
        Account acc = new Account(Name = 'Test Client');
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
