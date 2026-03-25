import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CONTRACT_TEMPLATE } from './contractPDFTemplate';
import saveContractHtml from '@salesforce/apex/ContractController.saveContractHtml';
import generateContractPdf from '@salesforce/apex/ContractController.generateContractPdf';
import sendContractEmail from '@salesforce/apex/ContractController.sendContractEmail';

const OPPORTUNITY_FIELDS = [
    'Opportunity.Name',
    'Opportunity.Total_Amount__c',
    'Opportunity.Deposit__c',
    'Opportunity.Balance_Due__c',
    'Opportunity.Deposit_Paid__c',
    'Opportunity.AccountId',
    'Opportunity.CloseDate',
    'Opportunity.Client_Name_Formula__c',
    'Opportunity.Client_Email__c'
];

export default class ContractGenerator extends LightningElement {
    @api recordId;
    @track currentStep = '1';
    @track isLoading = true;
    @track pdfUrl;
    @track pdfFileName = 'Contract.pdf';
    @track emailTo = '';
    @track emailSubject = '';
    @track emailClientName = '';
    @track emailEventName = '';

    accountId; oppData; contractHtml;
    oppSaved = false; accSaved = false;
    oppRecordData = {}; accRecordData = {};
    wiredLineItemsResult;

    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }

    @wire(getRecord, { recordId: '$recordId', fields: OPPORTUNITY_FIELDS })
    wiredOpp({ data, error }) {
        if (data) {
            this.oppData = data;
            this.accountId = data.fields.AccountId.value;
            this.isLoading = false;
        } else if (error) {
            console.error('Wire error (Opp fields):', JSON.stringify(error));
            this.isLoading = false;
        }
    }

    @wire(getRelatedListRecords, {
        parentRecordId: '$recordId',
        relatedListId: 'Line_Items__r',
        fields: [
            'Line_Item__c.Product__c',
            'Line_Item__c.Product__r.Name',
            'Line_Item__c.Description__c',
            'Line_Item__c.Quantity__c'
        ]
    })
    wiredLineItems(result) { this.wiredLineItemsResult = result; }

    saveStep1() {
        this.isLoading = true;
        this.oppSaved = false;
        this.accSaved = false;
        this.template.querySelector('lightning-record-edit-form[data-id="oppForm"]').submit();
        this.template.querySelector('lightning-record-edit-form[data-id="accForm"]').submit();
    }

    handleOppSuccess(event) { this.oppRecordData = event.detail.fields; this.oppSaved = true; this.checkStep1Completion(); }
    handleAccSuccess(event) { this.accRecordData = event.detail.fields; this.accSaved = true; this.checkStep1Completion(); }
    handleFormError(event) { console.error('Form Error:', event.detail); this.isLoading = false; }

    checkStep1Completion() {
        if (this.oppSaved && this.accSaved) {
            this.generateContractPDF();
        }
    }

    async generateContractPDF() {
        try {
            // --- DATA EXTRACTION ---
            const oppName       = this.oppRecordData.Name?.value              || this.oppData?.fields?.Name?.value              || 'Event';
            const totalAmt      = parseFloat(this.oppRecordData.Total_Amount__c?.value  ?? this.oppData?.fields?.Total_Amount__c?.value  ?? 0).toFixed(2);
            const depAmt        = parseFloat(this.oppRecordData.Deposit__c?.value       ?? this.oppData?.fields?.Deposit__c?.value       ?? 0).toFixed(2);
            const balAmt        = parseFloat(this.oppRecordData.Balance_Due__c?.value   ?? this.oppData?.fields?.Balance_Due__c?.value   ?? 0).toFixed(2);
            const isDepositPaid = this.oppRecordData.Deposit_Paid__c?.value   ?? this.oppData?.fields?.Deposit_Paid__c?.value   ?? false;
            const eventDateRaw  = this.oppRecordData.CloseDate?.value      || this.oppData?.fields?.CloseDate?.value      || '';

            const billingStreet = this.accRecordData.BillingStreet?.value     || '';
            const billingCity   = this.accRecordData.BillingCity?.value       || '';
            const billingState  = this.accRecordData.BillingState?.value      || '';
            const billingZip    = this.accRecordData.BillingPostalCode?.value || '';

            const formulaName = this.oppData?.fields?.Client_Name_Formula__c?.value;
            const firstName   = this.accRecordData.FirstName?.value || '';
            const lastName    = this.accRecordData.LastName?.value  || '';
            const personName  = (firstName + ' ' + lastName).trim();
            const accName     = this.accRecordData.Name?.value || personName || '';
            const clientName  = formulaName || accName || 'Client';

            // --- FORMAT DATES ---
            const createdDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            const eventDate   = eventDateRaw
                ? new Date(eventDateRaw + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'TBD';

            // --- FORMAT ADDRESS ---
            const clientAddress = [billingStreet, billingCity, `${billingState} ${billingZip}`.trim()].filter(Boolean).join(', ');
            const venue = clientAddress || 'TBD';

            // --- DEPOSIT STRING ---
            const depositString = isDepositPaid
                ? `A non-refundable deposit of $${depAmt} was paid prior to this Agreement.`
                : `A non-refundable deposit of $${depAmt} is due upon signing this Agreement.`;

            // --- LINE ITEMS HTML ---
            const dbLines = this.wiredLineItemsResult?.data?.records || [];
            const lineItemsHtml = dbLines.map(rec => {
                const name = rec.fields.Product__r?.value?.fields?.Name?.value || '';
                const desc = rec.fields.Description__c?.value || '';
                const qty  = rec.fields.Quantity__c?.value    || '';
                return `<tr>
                    <td class="line-name" style="padding:8px;font-size:9pt;border-bottom:1px solid #D4AF37;vertical-align:top;width:35%;font-weight:bold;">${name}</td>
                    <td class="line-qty"  style="padding:8px;font-size:9pt;border-bottom:1px solid #D4AF37;vertical-align:top;width:10%;text-align:center;">${qty}</td>
                    <td class="line-desc" style="padding:8px;font-size:9pt;border-bottom:1px solid #D4AF37;vertical-align:top;width:55%;">${desc}</td>
                </tr>`;
            }).join('');

            // --- BUILD HTML ---
            this.contractHtml = CONTRACT_TEMPLATE
                .replace(/{{CREATED_DATE}}/g,   createdDate)
                .replace(/{{CLIENT_NAME}}/g,    clientName)
                .replace(/{{CLIENT_ADDRESS}}/g, clientAddress)
                .replace(/{{EVENT_NAME}}/g,     oppName)
                .replace(/{{EVENT_DATE}}/g,     eventDate)
                .replace(/{{VENUE}}/g,          venue)
                .replace(/{{TOTAL_AMOUNT}}/g,   totalAmt)
                .replace(/{{DEPOSIT}}/g,        depAmt)
                .replace(/{{BALANCE}}/g,        balAmt)
                .replace(/{{DEPOSIT_STRING}}/g, depositString)
                .replace(/{{LINE_ITEMS}}/g,     lineItemsHtml);

            // --- SAVE HTML TO SALESFORCE ---
            await saveContractHtml({ recordId: this.recordId, html: this.contractHtml });

            // --- GENERATE PDF SERVER-SIDE ---
            const base64Pdf = await generateContractPdf({ recordId: this.recordId });
            this.pdfUrl = 'data:application/pdf;base64,' + base64Pdf;
            this.pdfFileName = `${clientName} - ${createdDate}.pdf`;

            // --- POPULATE EMAIL PREVIEW ---
            this.emailClientName = clientName;
            this.emailEventName  = oppName;
            this.emailTo         = this.oppData?.fields?.Client_Email__c?.value || '';
            this.emailSubject    = `Your Event Contract - ${oppName}`;

            this.currentStep = '2';
            this.isLoading = false;

        } catch (e) {
            const msg = e?.body?.message || e?.message || JSON.stringify(e);
            console.error('PDF Generation Error:', msg);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: msg,
                variant: 'error'
            }));
        }
    }

    goBack() {
        if (this.currentStep === '3') { this.currentStep = '2'; }
        else if (this.currentStep === '2') { this.currentStep = '1'; this.pdfUrl = null; }
    }

    previewEmail() { this.currentStep = '3'; }

    closeAction() { this.dispatchEvent(new CloseActionScreenEvent()); }

    async saveAndSend() {
        this.isLoading = true;
        try {
            await sendContractEmail({ recordId: this.recordId });

            this.dispatchEvent(new ShowToastEvent({
                title: 'Contract Sent',
                message: 'The contract has been sent to the client for signature.',
                variant: 'success'
            }));
            this.closeAction();

        } catch (e) {
            console.error('Send Error:', e);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Failed to send contract. Please try again.',
                variant: 'error'
            }));
        }
    }
}
