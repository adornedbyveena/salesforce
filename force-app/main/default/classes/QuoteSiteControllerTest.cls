@isTest
private class QuoteSiteControllerTest {

    static final String TOKEN = 'quotetoken123test';

    static Opportunity makeOpp(String quoteStatus) {
        Account acc = new Account(Name = 'Test Client');
        insert acc;
        Opportunity opp = new Opportunity(
            Name              = 'Test Wedding',
            StageName         = 'Building Proposal',
            CloseDate         = Date.today().addDays(60),
            AccountId         = acc.Id,
            Quote_Token__c    = TOKEN,
            Quote_Status__c   = quoteStatus,
            Quote_HTML__c     = '<html>Quote</html>'
        );
        insert opp;
        return opp;
    }

    // ── Constructor: valid token, pending status ──────────────────────────────

    @isTest
    static void constructor_validToken_showsQuoteAndActions() {
        makeOpp('Sent');
        Test.setCurrentPage(Page.QuoteAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        Test.startTest();
        QuoteSiteController ctrl = new QuoteSiteController();
        Test.stopTest();

        System.assertEquals(true,  ctrl.showQuote,    'showQuote should be true');
        System.assertEquals(true,  ctrl.showActions,  'showActions should be true for pending quote');
        System.assertEquals(null,  ctrl.statusMessage,'statusMessage should be null for pending');
    }

    // ── Constructor: blank token ──────────────────────────────────────────────

    @isTest
    static void constructor_blankToken_setsStatusMessage() {
        Test.setCurrentPage(Page.QuoteAcceptance);

        Test.startTest();
        QuoteSiteController ctrl = new QuoteSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showQuote, 'showQuote should be false');
        System.assertNotEquals(null, ctrl.statusMessage, 'statusMessage should be set');
    }

    // ── Constructor: token not found ─────────────────────────────────────────

    @isTest
    static void constructor_invalidToken_setsNotFoundMessage() {
        Test.setCurrentPage(Page.QuoteAcceptance);
        ApexPages.currentPage().getParameters().put('token', 'bogustoken999');

        Test.startTest();
        QuoteSiteController ctrl = new QuoteSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showQuote, 'showQuote should be false');
        System.assert(ctrl.statusMessage.contains('not found'), 'Should show not found message');
    }

    // ── Constructor: already approved — hides actions ─────────────────────────

    @isTest
    static void constructor_alreadyApproved_hidesActions() {
        makeOpp('Approved');
        Test.setCurrentPage(Page.QuoteAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        Test.startTest();
        QuoteSiteController ctrl = new QuoteSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showActions, 'Actions should be hidden for approved quote');
        System.assertNotEquals(null, ctrl.statusMessage, 'Status message should be set');
    }

    // ── Constructor: msg=approved parameter ──────────────────────────────────

    @isTest
    static void constructor_msgApproved_showsConfirmation() {
        makeOpp('Sent');
        Test.setCurrentPage(Page.QuoteAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);
        ApexPages.currentPage().getParameters().put('msg', 'approved');

        Test.startTest();
        QuoteSiteController ctrl = new QuoteSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showActions, 'Actions should be hidden after approval');
        System.assert(ctrl.statusMessage.contains('approved'), 'Should show approved confirmation');
    }

    // ── approve(): updates Opportunity and redirects ──────────────────────────

    @isTest
    static void approve_validApprovedName_updatesOppAndRedirects() {
        Opportunity opp = makeOpp('Sent');
        Test.setCurrentPage(Page.QuoteAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        // 2 callouts: sendQuoteApprovedConfirmation + sendInternalQuoteApproved
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout()
            .add(200, '{"id":"msg1"}')
            .add(200, '{"id":"msg2"}')
        );

        QuoteSiteController ctrl = new QuoteSiteController();
        ctrl.approvedName = 'Priya Kumar';

        Test.startTest();
        PageReference result = ctrl.approve();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Should return redirect PageReference');

        Opportunity updated = [SELECT Quote_Status__c, Quote_Approved_Name__c,
                                      Quote_Approved_Date_Time__c
                               FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Approved',    updated.Quote_Status__c);
        System.assertEquals('Priya Kumar', updated.Quote_Approved_Name__c);
        System.assertNotEquals(null,        updated.Quote_Approved_Date_Time__c);
    }

    // ── approve(): blank name returns null and adds page message ─────────────

    @isTest
    static void approve_blankApprovedName_returnsNull() {
        makeOpp('Sent');
        Test.setCurrentPage(Page.QuoteAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        QuoteSiteController ctrl = new QuoteSiteController();
        ctrl.approvedName = '';

        Test.startTest();
        PageReference result = ctrl.approve();
        Test.stopTest();

        System.assertEquals(null, result, 'Should return null when name is blank');
        System.assertEquals(1, ApexPages.getMessages().size(), 'Should add a page error message');
    }

    // ── decline(): updates Opportunity and redirects ──────────────────────────

    @isTest
    static void decline_setsDeclinedAndRedirects() {
        Opportunity opp = makeOpp('Sent');
        Test.setCurrentPage(Page.QuoteAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        QuoteSiteController ctrl = new QuoteSiteController();

        Test.startTest();
        PageReference result = ctrl.decline();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Should return redirect PageReference');
        System.assertEquals('declined', result.getParameters().get('msg'));

        Opportunity updated = [SELECT Quote_Status__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Declined', updated.Quote_Status__c);
    }
}
