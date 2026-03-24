public without sharing class ContractSiteController {

    public String  contractHtml  { get; private set; }
    public String  clientName    { get; private set; }
    public String  eventName     { get; private set; }
    public String  statusMessage { get; private set; }
    public Boolean showContract  { get; private set; }
    public Boolean showActions   { get; private set; }

    private String opportunityId;

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
        contractHtml  = opp.Contract_HTML__c;
        eventName     = opp.Name;
        clientName    = String.isNotBlank(opp.Client_Name_Formula__c)
                        ? opp.Client_Name_Formula__c
                        : opp.Account.Name;
        showContract  = true;

        if (opp.Contract_Status__c == 'Signed') {
            statusMessage = 'This contract has already been signed. Thank you!';
            showActions   = false;
        } else if (opp.Contract_Status__c == 'Declined') {
            statusMessage = 'This contract has been declined.';
            showActions   = false;
        } else {
            showActions = true;
        }
    }

    public PageReference accept() {
        if (String.isBlank(opportunityId)) return null;

        update new Opportunity(
            Id = opportunityId,
            Contract_Status__c = 'Signed',
            Contract_Signed_Date_Time__c = DateTime.now(),
            StageName = 'Closed Won'
        );

        showActions   = false;
        statusMessage = 'Thank you! Your contract has been signed. We look forward to working with you!';
        return null;
    }

    public PageReference decline() {
        if (String.isBlank(opportunityId)) return null;

        update new Opportunity(
            Id = opportunityId,
            Contract_Status__c = 'Declined'
        );

        showActions   = false;
        statusMessage = 'Your contract has been declined. We will be in touch shortly.';
        return null;
    }
}
