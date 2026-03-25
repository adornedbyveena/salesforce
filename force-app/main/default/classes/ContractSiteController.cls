public without sharing class ContractSiteController {

    public String  contractHtml  { get; private set; }
    public String  clientName    { get; private set; }
    public String  eventName     { get; private set; }
    public String  statusMessage { get; private set; }
    public Boolean showContract  { get; private set; }
    public Boolean showActions   { get; private set; }
    public Boolean isPdfMode     { get; private set; }

    private String opportunityId;
    private String contractToken;

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
                   Client_Name_Formula__c, Account.Name
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
        EventBus.publish(new Contract_Action__e(Token__c = contractToken, Action__c = 'Accept'));
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
