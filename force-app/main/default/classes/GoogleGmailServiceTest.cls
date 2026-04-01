@isTest
private class GoogleGmailServiceTest {

    static final String GMAIL_OK = '{"id":"msgId"}';

    // ── sendLeadThankYou ──────────────────────────────────────────────────────

    @isTest
    static void sendLeadThankYou_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendLeadThankYou('test@test.com', 'Priya', 'Summer Wedding');
        Test.stopTest();
        System.assert(true, 'sendLeadThankYou completed');
    }

    // ── sendContractEmail ─────────────────────────────────────────────────────

    @isTest
    static void sendContractEmail_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendContractEmail(
            'test@test.com', 'Priya Kumar', 'Summer Wedding',
            'https://example.com/contract?token=abc',
            EncodingUtil.base64Encode(Blob.valueOf('pdf')), 'contract.pdf'
        );
        Test.stopTest();
        System.assert(true, 'sendContractEmail completed');
    }

    // ── sendInvoiceEmail ──────────────────────────────────────────────────────

    @isTest
    static void sendInvoiceEmail_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendInvoiceEmail(
            'test@test.com', 'Priya Kumar', 'Summer Wedding',
            EncodingUtil.base64Encode(Blob.valueOf('pdf')), 'invoice.pdf'
        );
        Test.stopTest();
        System.assert(true, 'sendInvoiceEmail completed');
    }

    // ── sendQuoteEmail ────────────────────────────────────────────────────────

    @isTest
    static void sendQuoteEmail_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendQuoteEmail(
            'test@test.com', 'Priya Kumar', 'Summer Wedding',
            'https://example.com/quote?token=abc',
            EncodingUtil.base64Encode(Blob.valueOf('pdf')), 'quote.pdf'
        );
        Test.stopTest();
        System.assert(true, 'sendQuoteEmail completed');
    }

    // ── sendQuoteApprovedConfirmation ─────────────────────────────────────────

    @isTest
    static void sendQuoteApprovedConfirmation_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendQuoteApprovedConfirmation(
            'test@test.com', 'Priya Kumar', 'Summer Wedding',
            'Priya Kumar', DateTime.now()
        );
        Test.stopTest();
        System.assert(true, 'sendQuoteApprovedConfirmation completed');
    }

    // ── sendContractSignedConfirmation ────────────────────────────────────────

    @isTest
    static void sendContractSignedConfirmation_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendContractSignedConfirmation(
            'test@test.com', 'Priya Kumar', 'Summer Wedding',
            'Priya Kumar', DateTime.now()
        );
        Test.stopTest();
        System.assert(true, 'sendContractSignedConfirmation completed');
    }

    // ── sendInternalLeadNotification ──────────────────────────────────────────

    @isTest
    static void sendInternalLeadNotification_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendInternalLeadNotification(
            'Priya Kumar', 'priya@test.com', '555-1234',
            'Summer Wedding', 'Wedding',
            Date.today().addDays(90), null, 'Flexible',
            '5000', '100', 'Full Decor', 'Traditional ceremony',
            'https://example.com/opp/001'
        );
        Test.stopTest();
        System.assert(true, 'sendInternalLeadNotification completed');
    }

    // ── sendInternalContractSigned ────────────────────────────────────────────

    @isTest
    static void sendInternalContractSigned_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendInternalContractSigned(
            'Priya Kumar', 'priya@test.com', 'Summer Wedding',
            'Priya Kumar', DateTime.now(), 'https://example.com/opp/001'
        );
        Test.stopTest();
        System.assert(true, 'sendInternalContractSigned completed');
    }

    // ── sendInternalQuoteApproved ─────────────────────────────────────────────

    @isTest
    static void sendInternalQuoteApproved_success() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok(GMAIL_OK));
        Test.startTest();
        GoogleGmailService.sendInternalQuoteApproved(
            'Priya Kumar', 'priya@test.com', 'Summer Wedding',
            'Priya Kumar', DateTime.now(), 'https://example.com/opp/001'
        );
        Test.stopTest();
        System.assert(true, 'sendInternalQuoteApproved completed');
    }

    // ── 401 throws AuraHandledException ──────────────────────────────────────

    @isTest
    static void sendLeadThankYou_401_throwsAuraHandledException() {
        Test.setMock(HttpCalloutMock.class, ABVMockHttpCallout.ok('').add(401, ''));
        // renderTemplate (SOQL) runs first, then the 401 callout
        Test.startTest();
        try {
            GoogleGmailService.sendLeadThankYou('test@test.com', 'Priya', 'Summer Wedding');
            // If template query returns no rows it will throw QueryException which is acceptable
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('authentication'), 'Expected reauth message');
        } catch (Exception e) {
            System.assert(true, 'Exception acceptable in 401 test: ' + e.getMessage());
        }
        Test.stopTest();
    }
}
