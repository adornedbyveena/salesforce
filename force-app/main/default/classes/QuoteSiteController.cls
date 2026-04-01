public without sharing class QuoteSiteController {

    public String  quoteHtml     { get; private set; }
    public String  clientName    { get; private set; }
    public String  eventName     { get; private set; }
    public String  statusMessage { get; private set; }
    public Boolean showQuote     { get; private set; }
    public Boolean showActions   { get; private set; }
    public String  approvedName  { get; set; }

    private String opportunityId;
    private String quoteToken;
    private String clientEmail;

    public QuoteSiteController() {
        showQuote   = false;
        showActions = false;

        String token = ApexPages.currentPage().getParameters().get('token');

        if (String.isBlank(token)) {
            statusMessage = 'Invalid quote link.';
            return;
        }

        List<Opportunity> opps = [
            SELECT Id, Name, Quote_HTML__c, Quote_Status__c,
                   Client_Name_Formula__c, Account.Name, Client_Email__c
            FROM Opportunity
            WHERE Quote_Token__c = :token
            LIMIT 1
        ];

        if (opps.isEmpty()) {
            statusMessage = 'Quote not found.';
            return;
        }

        Opportunity opp = opps[0];
        opportunityId = opp.Id;
        quoteToken    = token;
        quoteHtml     = opp.Quote_HTML__c;
        eventName     = opp.Name;
        clientEmail   = opp.Client_Email__c;
        clientName    = String.isNotBlank(opp.Client_Name_Formula__c)
                        ? opp.Client_Name_Formula__c
                        : opp.Account.Name;
        showQuote     = true;

        String msg = ApexPages.currentPage().getParameters().get('msg');

        if (msg == 'approved') {
            statusMessage = 'Thank you! Your quote has been approved. We will follow up shortly with your contract.';
            showActions = false;
        } else if (msg == 'declined') {
            statusMessage = 'Your quote has been declined. We will be in touch shortly.';
            showActions = false;
        } else if (opp.Quote_Status__c == 'Approved') {
            statusMessage = 'This quote has already been approved. Thank you!';
            showActions = false;
        } else if (opp.Quote_Status__c == 'Declined') {
            statusMessage = 'This quote has been declined.';
            showActions = false;
        } else {
            showActions = true;
        }
    }

    public PageReference approve() {
        if (String.isBlank(quoteToken)) return null;

        if (String.isBlank(approvedName)) {
            ApexPages.addMessage(new ApexPages.Message(ApexPages.Severity.ERROR,
                'Please enter your name to approve the quote.'));
            return null;
        }

        // Capture IP address
        String approverIp = ApexPages.currentPage().getHeaders().get('X-Salesforce-SIP');
        if (String.isBlank(approverIp)) {
            approverIp = ApexPages.currentPage().getHeaders().get('X-Forwarded-For');
        }

        DateTime approvedAt = DateTime.now();

        // Send emails (callouts must come before any DML)
        try {
            GoogleGmailService.sendQuoteApprovedConfirmation(
                clientEmail, clientName, eventName, approvedName, approvedAt
            );
        } catch (Exception e) {
            System.debug('Quote approval confirmation email failed: ' + e.getMessage());
        }
        try {
            String oppUrl = URL.getOrgDomainUrl().toExternalForm() + '/' + opportunityId;
            GoogleGmailService.sendInternalQuoteApproved(
                clientName, clientEmail, eventName, approvedName, approvedAt, oppUrl
            );
        } catch (Exception e) {
            System.debug('Quote approved internal notification failed: ' + e.getMessage());
        }

        update new Opportunity(
            Id                        = opportunityId,
            Quote_Status__c           = 'Approved',
            Quote_Approved_Date_Time__c = approvedAt,
            Quote_Approved_Name__c    = approvedName.trim(),
            Quote_Approver_IP__c      = approverIp
        );

        ABVPushNotifier.notifyVeena(
            'Quote Approved: ' + eventName,
            clientName + ' has approved the quote.',
            opportunityId
        );

        PageReference pr = Page.QuoteAcceptance;
        pr.getParameters().put('token', quoteToken);
        pr.getParameters().put('msg', 'approved');
        pr.setRedirect(true);
        return pr;
    }

    public PageReference decline() {
        if (String.isBlank(quoteToken)) return null;

        update new Opportunity(
            Id              = opportunityId,
            Quote_Status__c = 'Declined'
        );

        PageReference pr = Page.QuoteAcceptance;
        pr.getParameters().put('token', quoteToken);
        pr.getParameters().put('msg', 'declined');
        pr.setRedirect(true);
        return pr;
    }
}