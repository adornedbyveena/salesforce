@isTest
private class ContractSiteControllerTest {

    static final String TOKEN = 'abc123testtoken';

    static Opportunity makeOpp(String contractStatus) {
        Account acc = new Account(Name = 'Test Client');
        insert acc;
        Opportunity opp = new Opportunity(
            Name                  = 'Test Wedding',
            StageName             = 'Contract Sent',
            CloseDate             = Date.today().addDays(60),
            AccountId             = acc.Id,
            Contract_Token__c     = TOKEN,
            Contract_Status__c    = contractStatus,
            Contract_HTML__c      = '<html>Contract</html>'
        );
        insert opp;
        return opp;
    }

    // ── Constructor: valid token, pending status ──────────────────────────────

    @isTest
    static void constructor_validToken_showsContractAndActions() {
        makeOpp('Sent');
        Test.setCurrentPage(Page.ContractAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        Test.startTest();
        ContractSiteController ctrl = new ContractSiteController();
        Test.stopTest();

        System.assertEquals(true,  ctrl.showContract, 'showContract should be true');
        System.assertEquals(true,  ctrl.showActions,  'showActions should be true for pending contract');
        System.assertEquals(null,  ctrl.statusMessage,'statusMessage should be null for pending');
    }

    // ── Constructor: blank token ──────────────────────────────────────────────

    @isTest
    static void constructor_blankToken_setsStatusMessage() {
        Test.setCurrentPage(Page.ContractAcceptance);

        Test.startTest();
        ContractSiteController ctrl = new ContractSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showContract, 'showContract should be false');
        System.assertNotEquals(null, ctrl.statusMessage, 'statusMessage should be set');
    }

    // ── Constructor: token not found ─────────────────────────────────────────

    @isTest
    static void constructor_invalidToken_setsNotFoundMessage() {
        Test.setCurrentPage(Page.ContractAcceptance);
        ApexPages.currentPage().getParameters().put('token', 'nonexistenttoken');

        Test.startTest();
        ContractSiteController ctrl = new ContractSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showContract, 'showContract should be false');
        System.assert(ctrl.statusMessage.contains('not found'), 'Should show not found message');
    }

    // ── Constructor: already signed — hides actions ───────────────────────────

    @isTest
    static void constructor_alreadySigned_hidesActions() {
        makeOpp('Signed');
        Test.setCurrentPage(Page.ContractAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        Test.startTest();
        ContractSiteController ctrl = new ContractSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showActions, 'Actions should be hidden for signed contract');
        System.assertNotEquals(null, ctrl.statusMessage, 'Status message should be set');
    }

    // ── Constructor: msg=signed parameter ────────────────────────────────────

    @isTest
    static void constructor_msgSigned_showsConfirmation() {
        makeOpp('Sent');
        Test.setCurrentPage(Page.ContractAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);
        ApexPages.currentPage().getParameters().put('msg', 'signed');

        Test.startTest();
        ContractSiteController ctrl = new ContractSiteController();
        Test.stopTest();

        System.assertEquals(false, ctrl.showActions, 'Actions should be hidden after signing');
        System.assert(ctrl.statusMessage.contains('signed'), 'Should show signed confirmation');
    }

    // ── accept(): updates Opportunity and redirects ───────────────────────────

    @isTest
    static void accept_validSignedName_updatesOppAndRedirects() {
        Opportunity opp = makeOpp('Sent');
        Test.setCurrentPage(Page.ContractAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        // 2 callouts: sendContractSignedConfirmation + sendInternalContractSigned
        Test.setMock(HttpCalloutMock.class, new ABVMockHttpCallout()
            .add(200, '{"id":"msg1"}')
            .add(200, '{"id":"msg2"}')
        );

        ContractSiteController ctrl = new ContractSiteController();
        ctrl.signedName = 'Priya Kumar';

        Test.startTest();
        PageReference result = ctrl.accept();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Should return redirect PageReference');

        Opportunity updated = [SELECT Contract_Status__c, Contract_Signed_Name__c,
                                      Contract_Signed_Date_Time__c, StageName
                               FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Signed',          updated.Contract_Status__c);
        System.assertEquals('Priya Kumar',     updated.Contract_Signed_Name__c);
        System.assertEquals('Contract Signed', updated.StageName);
        System.assertNotEquals(null,           updated.Contract_Signed_Date_Time__c);
    }

    // ── accept(): blank name returns null and adds page message ───────────────

    @isTest
    static void accept_blankSignedName_returnsNull() {
        makeOpp('Sent');
        Test.setCurrentPage(Page.ContractAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        ContractSiteController ctrl = new ContractSiteController();
        ctrl.signedName = '';

        Test.startTest();
        PageReference result = ctrl.accept();
        Test.stopTest();

        System.assertEquals(null, result, 'Should return null when name is blank');
        System.assertEquals(1, ApexPages.getMessages().size(), 'Should add a page error message');
    }

    // ── decline(): publishes platform event and redirects ────────────────────

    @isTest
    static void decline_publishesEventAndRedirects() {
        makeOpp('Sent');
        Test.setCurrentPage(Page.ContractAcceptance);
        ApexPages.currentPage().getParameters().put('token', TOKEN);

        ContractSiteController ctrl = new ContractSiteController();

        Test.startTest();
        PageReference result = ctrl.decline();
        Test.stopTest();

        System.assertNotEquals(null, result, 'Should return redirect PageReference');
        System.assert(result.getParameters().get('msg') == 'declined', 'msg param should be declined');
    }
}
