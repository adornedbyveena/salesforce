public without sharing class ContractSiteController {

    public String  contractHtml  { get; private set; }
    public String  clientName    { get; private set; }
    public String  eventName     { get; private set; }
    public String  statusMessage { get; private set; }
    public Boolean showContract  { get; private set; }
    public Boolean showActions   { get; private set; }
    public Boolean isPdfMode     { get; private set; }
    public String  signedName    { get; set; }

    private String opportunityId;
    private String contractToken;
    private String clientEmail;

    public ContractSiteController() {
        showContract = false;
        showActions  = false;

        String token = ApexPages.currentPage().getParameters().get('token');

        if (String.isBlank(token)) {
            statusMessage = 'Invalid contract link.';
            return;
        }

        List<Opportunity> opps = [
            SELECT Id, Name, Contract_HTML__c, Contract_Status__c,
                   Client_Name_Formula__c, Account.Name, Client_Email__c
            FROM Opportunity
            WHERE Contract_Token__c = :token
            LIMIT 1
        ];

        if (opps.isEmpty()) {
            statusMessage = 'Contract not found.';
            return;
        }

        Opportunity opp = opps[0];
        opportunityId = opp.Id;
        contractToken = token;
        contractHtml  = opp.Contract_HTML__c;
        eventName     = opp.Name;
        clientEmail   = opp.Client_Email__c;
        clientName    = String.isNotBlank(opp.Client_Name_Formula__c)
                        ? opp.Client_Name_Formula__c
                        : opp.Account.Name;
        showContract  = true;

        isPdfMode = ApexPages.currentPage().getParameters().get('pdf') == 'true';
        String msg = ApexPages.currentPage().getParameters().get('msg');

        if (msg == 'signed') {
            statusMessage = 'Thank you! Your contract has been signed. We look forward to working with you!';
            showActions = false;
        } else if (msg == 'declined') {
            statusMessage = 'Your contract has been declined. We will be in touch shortly.';
            showActions = false;
        } else if (isPdfMode || opp.Contract_Status__c == 'Signed') {
            if (opp.Contract_Status__c == 'Signed') {
                statusMessage = 'This contract has already been signed. Thank you!';
            }
            showActions = false;
        } else if (opp.Contract_Status__c == 'Declined') {
            statusMessage = 'This contract has been declined.';
            showActions   = false;
        } else {
            showActions = true;
        }
    }

    public PageReference accept() {
        if (String.isBlank(contractToken)) return null;

        // Server-side validation
        if (String.isBlank(signedName)) {
            ApexPages.addMessage(new ApexPages.Message(ApexPages.Severity.ERROR,
                'Please enter your full legal name to sign the contract.'));
            return null;
        }

        // Capture IP address
        String signerIp = ApexPages.currentPage().getHeaders().get('X-Salesforce-SIP');
        if (String.isBlank(signerIp)) {
            signerIp = ApexPages.currentPage().getHeaders().get('X-Forwarded-For');
        }

        DateTime signedAt = DateTime.now();

        // Send confirmation email (callout must come before any DML)
        try {
            GoogleGmailService.sendContractSignedConfirmation(
                clientEmail, clientName, eventName, signedName, signedAt
            );
        } catch (Exception e) {
            // Don't block signing if email fails — log and continue
            System.debug('Contract signed confirmation email failed: ' + e.getMessage());
        }

        // Update Opportunity directly with all signature details
        update new Opportunity(
            Id                           = opportunityId,
            Contract_Status__c           = 'Signed',
            Contract_Signed_Date_Time__c = signedAt,
            Contract_Signed_Name__c      = signedName.trim(),
            Contract_Signer_IP__c        = signerIp,
            StageName                    = 'Contract Signed'
        );

        PageReference pr = Page.ContractAcceptance;
        pr.getParameters().put('token', contractToken);
        pr.getParameters().put('msg', 'signed');
        pr.setRedirect(true);
        return pr;
    }

    public PageReference decline() {
        if (String.isBlank(contractToken)) return null;
        EventBus.publish(new Contract_Action__e(Token__c = contractToken, Action__c = 'Decline'));
        PageReference pr = Page.ContractAcceptance;
        pr.getParameters().put('token', contractToken);
        pr.getParameters().put('msg', 'declined');
        pr.setRedirect(true);
        return pr;
    }
}
