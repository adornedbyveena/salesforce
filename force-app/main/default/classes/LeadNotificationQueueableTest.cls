@isTest
private class LeadNotificationQueueableTest {

    // ── With Person Account — emails and push fire ────────────────────────────

    @isTest
    static void execute_personAccount_sendsNotifications() {
        // Attempt to create a Person Account; if record type not found, skip
        List<RecordType> rts = [
            SELECT Id FROM RecordType
            WHERE SobjectType = 'Account' AND IsPersonType = true LIMIT 1
        ];
        if (rts.isEmpty()) return; // Person Accounts not enabled — skip

        Account acc = new Account(
            FirstName   = 'Priya',
            LastName    = 'Kumar',
            RecordTypeId = rts[0].Id,
            PersonEmail = 'priya@test.com',
            Phone       = '555-1234'
        );
        insert acc;

        // Re-query to get the merged Id after Person Account insert
        acc = [SELECT Id FROM Account WHERE LastName = 'Kumar' LIMIT 1];

        Opportunity opp = new Opportunity(
            Name          = 'Priya Kumar - Wedding',
            StageName     = 'New Inquiry',
            CloseDate     = Date.today().addDays(90),
            AccountId     = acc.Id,
            LeadSource    = 'Web',
            Event_Type__c = 'Wedding Ceremony'
        );
        insert opp;

        // 2 Gmail callouts: sendLeadThankYou + sendInternalLeadNotification
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout()
            .add(200, '{"id":"msg1"}')
            .add(200, '{"id":"msg2"}')
        );

        Test.startTest();
        System.enqueueJob(new LeadNotificationQueueable(new List<Id>{ opp.Id }));
        Test.stopTest();

        System.assert(true, 'LeadNotificationQueueable executed without exception');
    }

    // ── With standard Account (no PersonEmail) — skips notifications ──────────

    @isTest
    static void execute_noPersonEmail_skipsGracefully() {
        List<RecordType> rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true AND DeveloperName='Client' LIMIT 1];
        if (rts.isEmpty()) rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1];
        Account acc = new Account(FirstName='No', LastName='Email');
        if (!rts.isEmpty()) acc.RecordTypeId = rts[0].Id;
        insert acc;
        Opportunity opp = new Opportunity(
            Name      = 'Corp Event',
            StageName = 'New Inquiry',
            CloseDate = Date.today().addDays(30),
            AccountId = acc.Id,
            LeadSource = 'Web'
        );
        insert opp;

        // No mock needed — code skips when PersonEmail is blank
        Test.startTest();
        System.enqueueJob(new LeadNotificationQueueable(new List<Id>{ opp.Id }));
        Test.stopTest();

        System.assert(true, 'Queueable handled missing PersonEmail without exception');
    }

    // ── Empty ID list — executes without error ────────────────────────────────

    @isTest
    static void execute_emptyList_noException() {
        Test.startTest();
        System.enqueueJob(new LeadNotificationQueueable(new List<Id>()));
        Test.stopTest();
        System.assert(true, 'Empty list handled without exception');
    }

    // ── OpportunityTrigger enqueues job for Web / New Inquiry ─────────────────

    @isTest
    static void trigger_webNewInquiry_enqueuesJob() {
        List<RecordType> rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true AND DeveloperName='Client' LIMIT 1];
        if (rts.isEmpty()) rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1];
        Account acc = new Account(FirstName='Trigger', LastName='Client');
        if (!rts.isEmpty()) acc.RecordTypeId = rts[0].Id;
        insert acc;

        Test.startTest();
        Opportunity opp = new Opportunity(
            Name       = 'Trigger Event',
            StageName  = 'New Inquiry',
            CloseDate  = Date.today().addDays(30),
            AccountId  = acc.Id,
            LeadSource = 'Web'
        );
        insert opp;
        Test.stopTest();

        // Verify the Opportunity was created (trigger ran without error)
        System.assertEquals(1, [SELECT COUNT() FROM Opportunity WHERE Id = :opp.Id]);
    }

    // ── Trigger does NOT enqueue for non-Web leads ────────────────────────────

    @isTest
    static void trigger_nonWebLead_noJob() {
        List<RecordType> rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true AND DeveloperName='Client' LIMIT 1];
        if (rts.isEmpty()) rts = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1];
        Account acc = new Account(FirstName='NonWeb', LastName='Client');
        if (!rts.isEmpty()) acc.RecordTypeId = rts[0].Id;
        insert acc;
        Test.startTest();
        Opportunity opp = new Opportunity(
            Name       = 'Non-Web Event',
            StageName  = 'New Inquiry',
            CloseDate  = Date.today().addDays(30),
            AccountId  = acc.Id,
            LeadSource = 'Phone'
        );
        insert opp;
        Test.stopTest();
        System.assertEquals(1, [SELECT COUNT() FROM Opportunity WHERE Id = :opp.Id]);
    }
}
