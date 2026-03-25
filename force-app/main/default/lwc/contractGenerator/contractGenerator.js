import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { loadScript } from 'lightning/platformResourceLoader';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import sendContractEmail from '@salesforce/apex/ContractController.sendContractEmail';
import JSPDF_LIB from '@salesforce/resourceUrl/jsPDF';
import AUTOTABLE_LIB from '@salesforce/resourceUrl/jsPDFAutoTable';
import { adornedByVeenaLogo } from './logoData';

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

    accountId; oppData; rawPdfBase64;
    jsPdfInitialized = false;
    oppSaved = false; accSaved = false;
    oppRecordData = {}; accRecordData = {};
    wiredLineItemsResult;

    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }

    renderedCallback() {
        if (this.jsPdfInitialized) return;
        this.jsPdfInitialized = true;

        Promise.all([loadScript(this, JSPDF_LIB)])
            .then(() => loadScript(this, AUTOTABLE_LIB))
            .then(() => { this.isLoading = false; })
            .catch(e => { console.error('Error loading PDF Scripts:', e); this.isLoading = false; });
    }

    @wire(getRecord, { recordId: '$recordId', fields: OPPORTUNITY_FIELDS })
    wiredOpp({ data, error }) {
        if (data) {
            this.oppData = data;
            this.accountId = data.fields.AccountId.value;
        } else if (error) {
            console.error('Wire error (Opp fields):', JSON.stringify(error));
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

    generateContractPDF() {
        try {
            // --- DATA ---
            const oppName       = this.oppRecordData.Name?.value              || this.oppData?.fields?.Name?.value              || 'Event';
            const totalAmt      = parseFloat(this.oppRecordData.Total_Amount__c?.value  ?? this.oppData?.fields?.Total_Amount__c?.value  ?? 0).toFixed(2);
            const depAmt        = parseFloat(this.oppRecordData.Deposit__c?.value       ?? this.oppData?.fields?.Deposit__c?.value       ?? 0).toFixed(2);
            const balAmt        = parseFloat(this.oppRecordData.Balance_Due__c?.value   ?? this.oppData?.fields?.Balance_Due__c?.value   ?? 0).toFixed(2);
            const isDepositPaid = this.oppRecordData.Deposit_Paid__c?.value   ?? this.oppData?.fields?.Deposit_Paid__c?.value   ?? false;
            const eventDateRaw  = this.oppRecordData.CloseDate?.value         || this.oppData?.fields?.CloseDate?.value         || '';

            const billingStreet = this.accRecordData.BillingStreet?.value     || '';
            const billingCity   = this.accRecordData.BillingCity?.value       || '';
            const billingState  = this.accRecordData.BillingState?.value      || '';
            const billingZip    = this.accRecordData.BillingPostalCode?.value || '';

            const formulaName  = this.oppData?.fields?.Client_Name_Formula__c?.value;
            const firstName    = this.accRecordData.FirstName?.value || '';
            const lastName     = this.accRecordData.LastName?.value  || '';
            const accName      = this.accRecordData.Name?.value || (firstName + ' ' + lastName).trim() || '';
            const clientName   = formulaName || accName || 'Client';

            const createdDate    = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            const eventDate      = eventDateRaw
                ? new Date(eventDateRaw + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'TBD';
            const clientAddress  = [billingStreet, billingCity, `${billingState} ${billingZip}`.trim()].filter(Boolean).join(', ');
            const venue          = clientAddress || 'TBD';
            const depositString  = isDepositPaid
                ? `A non-refundable deposit of $${depAmt} was paid prior to this Agreement.`
                : `A non-refundable deposit of $${depAmt} is due upon signing this Agreement.`;

            // --- jsPDF SETUP ---
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const MARGIN = 14;
            const CONTENT_W = 210 - MARGIN * 2;
            let y = 15;

            const newPage = () => {
                doc.addPage();
                doc.setFillColor(255, 255, 255);
                doc.rect(0, 0, 210, 297, 'F');
                doc.setTextColor(2, 12, 29);
                y = 15;
            };
            const chk = (needed = 8) => { if (y + needed > 278) newPage(); };

            const goldLine = () => {
                chk(10);
                doc.setDrawColor(212, 175, 55);
                doc.setLineWidth(0.6);
                doc.line(MARGIN, y, 210 - MARGIN, y);
                y += 8;
            };

            const h2 = (text) => {
                chk(14);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(2, 12, 29);
                doc.text(text.toUpperCase(), MARGIN, y);
                y += 7;
            };

            const h3 = (text, italic = false) => {
                chk(10);
                doc.setFontSize(9.5);
                doc.setFont('helvetica', italic ? 'bolditalic' : 'bold');
                doc.setTextColor(2, 12, 29);
                doc.text(text, MARGIN, y);
                y += 6;
            };

            const body = (text, opts = {}) => {
                chk(6);
                doc.setFontSize(9);
                doc.setFont('helvetica', opts.italic ? 'italic' : 'normal');
                doc.setTextColor(opts.gray ? 80 : 2, opts.gray ? 80 : 12, opts.gray ? 80 : 29);
                const lines = doc.splitTextToSize(text, CONTENT_W);
                lines.forEach(line => { chk(5); doc.text(line, MARGIN, y); y += 5; });
                y += 1;
            };

            const bullet = (text, boldLabel = '') => {
                chk(6);
                doc.setFontSize(9);
                doc.setTextColor(2, 12, 29);
                const tx = MARGIN + 5;
                const wrapW = CONTENT_W - 5;
                doc.text('\u2022', MARGIN, y);
                if (boldLabel) {
                    doc.setFont('helvetica', 'bold');
                    doc.text(boldLabel, tx, y);
                    const labelW = doc.getTextWidth(boldLabel);
                    doc.setFont('helvetica', 'normal');
                    const remainW = wrapW - labelW;
                    if (doc.getTextWidth(text) <= remainW) {
                        doc.text(text, tx + labelW, y);
                        y += 5;
                    } else {
                        y += 5;
                        doc.splitTextToSize(text, wrapW).forEach(line => { chk(5); doc.text(line, tx, y); y += 5; });
                    }
                } else {
                    doc.setFont('helvetica', 'normal');
                    const lines = doc.splitTextToSize(text, wrapW);
                    lines.forEach((line, i) => {
                        if (i > 0) chk(5);
                        doc.text(line, tx, y);
                        if (i < lines.length - 1) y += 5;
                    });
                    y += 5;
                }
            };

            // --- PAGE 1 BACKGROUND ---
            doc.setFillColor(255, 255, 255);
            doc.rect(0, 0, 210, 297, 'F');
            doc.setTextColor(2, 12, 29);

            // --- HEADER ---
            doc.addImage(adornedByVeenaLogo, 'PNG', MARGIN, 8, 38, 30);
            doc.setFontSize(18); doc.setFont('helvetica', 'bold');
            doc.text('EVENT PLANNING CONTRACT', 210 - MARGIN, 14, { align: 'right' });
            doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            doc.text(`Date: ${createdDate}`,  210 - MARGIN, 21, { align: 'right' });
            doc.text(`Event: ${oppName}`,      210 - MARGIN, 27, { align: 'right' });
            doc.text(`Client: ${clientName}`,  210 - MARGIN, 33, { align: 'right' });

            y = 42;
            doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.8);
            doc.line(MARGIN, y, 210 - MARGIN, y);
            y += 8;

            // --- INTRODUCTION ---
            h2('Introduction');
            body(`This Event Planning / Decor Contract Agreement ("Agreement") is entered into on ${createdDate} by and between:`);
            bullet(`Adorned By Veena, LLC, a limited liability company organized and existing under the laws of the State of Texas, with its principal office located at 19730 Shinnery Ridge Ct, Cypress, TX 77433, represented by Veena Boppana, Principal Designer (the "Company").`);
            bullet(`${clientName}, an individual residing at ${clientAddress || 'address on file'} ("the Client").`);
            body('The parties hereby agree as follows:');
            goldLine();

            // --- SCOPE OF SERVICES ---
            h2('Scope of Services');
            h3('Event Planning Services');
            body('The Company agrees to provide the following services for the event hosted by the Client:');

            const dbLines = this.wiredLineItemsResult?.data?.records || [];
            const tableData = dbLines.map(rec => {
                const name = rec.fields.Product__r?.value?.fields?.Name?.value || '';
                const desc = rec.fields.Description__c?.value || '';
                const qty  = rec.fields.Quantity__c?.value != null ? String(rec.fields.Quantity__c.value) : '';
                return [{ content: name, styles: { fontStyle: 'bold' } }, qty, desc];
            });

            doc.autoTable({
                startY: y,
                head: [['Service / Product', 'Qty', 'Description']],
                body: tableData,
                theme: 'plain',
                headStyles: { fillColor: [212, 175, 55], textColor: [2, 12, 29], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fillColor: [255, 255, 255], textColor: [2, 12, 29], fontSize: 9 },
                columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 104 } },
                margin: { left: MARGIN, right: MARGIN }
            });
            y = doc.lastAutoTable.finalY + 5;

            body('These services will be provided in accordance with the terms outlined in this Agreement.');

            h3('Exclusions', true);
            [
                'Travel or accommodation costs for The Company or Client unless otherwise specified.',
                'Insurance for the event (Client will need to secure separate insurance coverage).',
                'Costs for any services or items not explicitly mentioned in this Agreement.'
            ].forEach(t => bullet(t));

            // --- EVENT DETAILS ---
            h2('Event Details');
            bullet(`Event Name: ${oppName}`);
            bullet(`Event Date: ${eventDate}`);
            bullet(`Event Location: ${venue}`);
            goldLine();

            // --- COMPENSATION ---
            h2('Compensation and Payment Terms');
            h3('Fees');
            bullet(`Flat Event Planning Fee: $${totalAmt} for all planning and coordination services.`);
            h3('Payment Schedule');
            bullet(depositString);
            bullet(`Final Payment: The remaining balance of $${balAmt} is due no later than the day of the event.`);
            y += 2;
            doc.setTextColor(80, 80, 80);
            [
                'Fees are subject to Texas State & Local Sales Tax (currently 8.25% in Cypress/Harris County). Tax will be itemized on the final invoice unless otherwise specified.',
                'Payments are accepted via Zelle, Cash, or Credit Card. Credit Card payments incur a 3% convenience fee.',
                `Zelle payments should be directed to adornedbyveena@gmail.com with the Inv Ref: ${oppName} - ${eventDate} in the memo.`
            ].forEach(t => bullet(t));
            doc.setTextColor(2, 12, 29);
            goldLine();

            // --- RESPONSIBILITIES ---
            h2('Responsibilities of the Parties');
            h3("The Company's Responsibilities");
            [
                'Provide event planning services as outlined in this Agreement.',
                'Coordinate and manage vendors, venue, and logistics for the event.',
                'Ensure all event-related activities are completed as scheduled.',
                'Maintain communication with Clients to ensure satisfaction and resolve any issues.',
                'Provide on-site event management to ensure smooth operations during the event.'
            ].forEach(t => bullet(t));

            h3("Client's Responsibilities");
            [
                ['Information Accuracy: ',        'Provide all event goals, themes, and budget constraints.'],
                ['Decision-Making Authority: ',    'Client must designate one (1) primary point of contact with full authority to make binding decisions and approvals.'],
                ['Financial Obligations: ',        'Ensure timely payments of planning fees and direct vendor invoices.'],
                ['Approvals: ',                    'Review and approve designs and contracts within 72 hours of receipt.'],
                ['Venue Logistics: ',              'Provide all necessary access codes, loading-dock info, and permits.'],
                ['Third-Party Agreements: ',       'Client shall sign and be solely responsible for all vendor contracts.'],
                ['Conduct & Liability: ',          'Client is responsible for guest behavior and any damages caused by attendees.'],
                ['Proof of Insurance (COI): ',     'Client is responsible for obtaining Event Cancellation or Host Liability insurance if required by the venue.']
            ].forEach(([label, text]) => bullet(text, label));
            goldLine();

            // --- CHANGES AND CANCELLATIONS ---
            h2('Changes and Cancellations');
            h3('Changes to the Event Scope');
            body('If Client wishes to make significant changes to the event scope, such as increasing the number of attendees, adding services, or changing the event date, such changes will be documented and may result in additional charges. Changes must be communicated to The Company in writing and approved by both parties.');
            h3('Event Cancellation');
            body('If the event is canceled by the Client:');
            bullet('More than 15 days prior to event date: Client will be responsible for paying 50% of the total fees (deposit and planning services).');
            bullet('Less than 15 days prior to event date: Client will be responsible for paying 100% of the total fees (deposit and planning services).');
            h3('Force Majeure & Limited Liability');
            bullet("If The Company is unable to perform due to circumstances beyond their reasonable control, including but not limited to hurricanes, tropical storms, regional power grid failures, or other Acts of God - the Company's liability shall be limited to refund of the unearned portion of the deposit.");
            bullet('The Company shall be entitled to retain a prorated amount of the deposit to compensate for services already rendered (e.g., planning hours, site visits, and administrative costs) up to the date of the event. Neither party shall be liable for any further indirect, consequential, or damages.');
            body('This Agreement is governed by the laws of the State of Texas. Any disputes shall be resolved via mandatory mediation in Harris County, Texas, prior to the filing of any lawsuit.');
            goldLine();

            // --- CONFIDENTIALITY & GOVERNING LAW ---
            h2('Confidentiality');
            bullet('Both parties agree to keep all sensitive information confidential, including but not limited to event details, pricing, and any proprietary business information disclosed during the term of this Agreement.');
            bullet('This confidentiality obligation will survive the termination of this Agreement.');
            h2('Governing Law');
            bullet('This Agreement shall be governed by and construed in accordance with the laws of the State of Texas.');
            bullet('Any disputes arising from this Agreement will be resolved in the courts located in Harris County, Texas.');
            goldLine();

            // --- MISCELLANEOUS ---
            h2('Miscellaneous Provisions');
            h3('Entire Agreement');
            bullet('This Agreement constitutes the full and complete understanding between the parties regarding the event planning services and supersedes all prior agreements or understandings, whether written or oral.');
            h3('Amendments');
            bullet('Any amendments or modifications to this Agreement must be made in writing and signed by both parties.');
            h3('Severability');
            bullet('If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.');
            body('For any inquiries regarding this agreement, please contact Veena Boppana at veena@adornedbyveena.com');
            goldLine();

            // --- SIGNATURE BLOCK ---
            h2('Acknowledgement & Acceptance');
            body('By signing below, the parties acknowledge that they have read, understood, and agree to the terms and conditions outlined in this Agreement.');
            y += 10;
            chk(40);

            doc.setDrawColor(2, 12, 29); doc.setLineWidth(0.4);
            doc.line(MARGIN, y + 22, MARGIN + 80, y + 22);
            doc.setFontSize(9); doc.setFont('helvetica', 'bold');
            doc.text('Adorned by Veena, LLC', MARGIN, y + 27);
            doc.setFont('helvetica', 'normal');
            doc.text(`Date: ${createdDate}`, MARGIN, y + 32);

            const sigRightX = 210 - MARGIN - 80;
            doc.line(sigRightX, y + 22, 210 - MARGIN, y + 22);
            doc.setFont('helvetica', 'bold');
            doc.text(clientName, sigRightX, y + 27);
            doc.setFont('helvetica', 'normal');
            doc.text(`Date: ${createdDate}`, sigRightX, y + 32);

            // --- OUTPUT ---
            const pdfBlob = doc.output('blob');
            this.pdfUrl = URL.createObjectURL(pdfBlob);
            this.rawPdfBase64 = btoa(doc.output());

            const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            this.pdfFileName    = `${clientName} - Contract - ${dateStr}.pdf`;
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
            this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: msg, variant: 'error' }));
        }
    }

    goBack() {
        if (this.currentStep === '3') { this.currentStep = '2'; }
        else if (this.currentStep === '2') { this.currentStep = '1'; this.pdfUrl = null; this.rawPdfBase64 = null; }
    }

    previewEmail() { this.currentStep = '3'; }

    closeAction() { this.dispatchEvent(new CloseActionScreenEvent()); }

    async saveAndSend() {
        this.isLoading = true;
        try {
            await sendContractEmail({
                recordId: this.recordId,
                pdfBase64: this.rawPdfBase64,
                fileName: this.pdfFileName
            });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Contract Sent',
                message: 'The contract has been sent to the client for signature.',
                variant: 'success'
            }));
            this.closeAction();
        } catch (e) {
            const msg = e?.body?.message || e?.message || JSON.stringify(e);
            console.error('Send Error:', msg);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: msg, variant: 'error' }));
        }
    }
}