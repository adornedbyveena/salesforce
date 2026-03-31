import { LightningElement, api, wire, track } from 'lwc';
import { getRecord, deleteRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { loadScript } from 'lightning/platformResourceLoader';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
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
    'Opportunity.Client_Email__c',
    'Opportunity.Venue__Street__s',
    'Opportunity.Venue__City__s',
    'Opportunity.Venue__StateCode__s',
    'Opportunity.Venue__PostalCode__s'
];

export default class ContractGenerator extends LightningElement {
    @api recordId;
    @track currentStep = '1';
    @track isLoading = true;
    @track rows = [];
    @track pdfUrl;
    @track pdfFileName = 'Contract.pdf';
    @track emailTo = '';
    @track emailSubject = '';
    @track emailClientName = '';
    @track emailEventName = '';

    accountId; oppData; rawPdfBase64; rawContractHtml;
    jsPdfInitialized = false;
    saveCount = 0; totalForms = 0;
    oppSaved = false; accSaved = false;
    oppRecordData = {}; accRecordData = {};
    wiredLineItemsResult;

    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }
    get isStep4() { return this.currentStep === '4'; }

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
            'Line_Item__c.Id',
            'Line_Item__c.Product__c',
            'Line_Item__c.Product__r.Name',
            'Line_Item__c.Description__c',
            'Line_Item__c.Quantity__c',
            'Line_Item__c.Sales_Price__c'
        ]
    })
    wiredLineItems(result) {
        this.wiredLineItemsResult = result;
        if (result.data) {
            this.rows = result.data.records.map(rec => ({ id: rec.id, recordId: rec.id }));
            if (this.rows.length === 0) this.addRow();
        }
    }

    // ── STEP 1: LINE ITEMS ──
    addRow() { this.rows = [...this.rows, { id: Date.now() + Math.random(), recordId: null }]; }

    removeRow(e) {
        const id  = e.target.dataset.id;
        const row = this.rows.find(r => String(r.id) === id);
        if (row && row.recordId) deleteRecord(row.recordId);
        this.rows = this.rows.filter(r => String(r.id) !== id);
    }

    saveStep1() {
        const forms = this.template.querySelectorAll('lightning-record-edit-form');
        this.totalForms = forms.length; this.saveCount = 0; this.isLoading = true;
        forms.forEach(f => f.submit());
    }

    handleLineItemSuccess() {
        this.saveCount++;
        if (this.saveCount === this.totalForms) {
            refreshApex(this.wiredLineItemsResult).then(() => {
                this.currentStep = '2'; this.isLoading = false;
            });
        }
    }

    // ── STEP 2: EVENT & CLIENT DETAILS ──
    saveStep2() {
        this.isLoading = true;
        this.oppSaved = false;
        this.accSaved = false;
        this.template.querySelector('lightning-record-edit-form[data-id="oppForm"]').submit();
        this.template.querySelector('lightning-record-edit-form[data-id="accForm"]').submit();
    }

    handleOppSuccess(event) { this.oppRecordData = event.detail.fields; this.oppSaved = true; this.checkStep2Completion(); }
    handleAccSuccess(event) { this.accRecordData = event.detail.fields; this.accSaved = true; this.checkStep2Completion(); }
    handleFormError(event) {
        this.isLoading = false;
        const FIELD_LABELS = {
            Product__c: 'Product', Quantity__c: 'Quantity', Sales_Price__c: 'Unit Price',
            Discount__c: 'Discount', Description__c: 'Description',
            Name: 'Name', CloseDate: 'Event Date',
            Total_Amount__c: 'Total Amount', Deposit__c: 'Deposit',
            Balance_Due__c: 'Balance Due', Deposit_Paid__c: 'Deposit Paid',
            PersonEmail: 'Email', Phone: 'Phone',
            BillingStreet: 'Billing Street', BillingCity: 'Billing City',
            BillingState: 'Billing State', BillingPostalCode: 'Billing Zip'
        };
        const detail = event.detail;
        const messages = [];
        if (detail?.output?.fieldErrors) {
            Object.entries(detail.output.fieldErrors).forEach(([field, errs]) => {
                const label = FIELD_LABELS[field] || field;
                errs.forEach(e => messages.push(`${label}: ${e.message}`));
            });
        }
        if (detail?.output?.errors) {
            detail.output.errors.forEach(e => messages.push(e.message));
        }
        const msg = messages.length ? messages.join(' | ') : (detail?.message || 'Please complete all required fields and try again.');
        this.dispatchEvent(new ShowToastEvent({ title: 'Could not save', message: msg, variant: 'error', mode: 'sticky' }));
    }

    checkStep2Completion() {
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

            const venueStreet = this.oppData?.fields?.Venue__Street__s?.value    || '';
            const venueCity   = this.oppData?.fields?.Venue__City__s?.value      || '';
            const venueState  = this.oppData?.fields?.Venue__StateCode__s?.value || '';
            const venueZip    = this.oppData?.fields?.Venue__PostalCode__s?.value || '';

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
            const venue          = [venueStreet, venueCity, `${venueState} ${venueZip}`.trim()].filter(Boolean).join(', ') || 'TBD';
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
                doc.setFillColor(247, 231, 206);
                doc.rect(0, 0, 210, 297, 'F');
                doc.setTextColor(2, 12, 29);
                y = 15;
            };
            const chk = (needed = 8) => { if (y + needed > 278) newPage(); };

            const goldLine = () => {
                chk(50);
                doc.setDrawColor(212, 175, 55);
                doc.setLineWidth(0.6);
                doc.line(MARGIN, y, 210 - MARGIN, y);
                y += 8;
            };

            const h2 = (text) => {
                chk(35);
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
            doc.setFillColor(247, 231, 206);
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

            const fmtDesc = t => {
                if (!t) return '';
                return t
                    .replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
                    .replace(/(<([^>]+)>)/gi, '')
                    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#10;/g, '\n')
                    .replace(/\r\n|\r/g, '\n')
                    .replace(/^[-*]\s+/gm, '\u2022 ').trim();
            };

            const dbLines = this.wiredLineItemsResult?.data?.records || [];
            const tableData = [];
            dbLines.forEach(rec => {
                const name  = rec.fields.Product__r?.value?.fields?.Name?.value || '';
                const desc  = fmtDesc(rec.fields.Description__c?.value || '');
                const qty   = rec.fields.Quantity__c?.value != null ? rec.fields.Quantity__c.value : 0;
                const price = rec.fields.Sales_Price__c?.value != null ? rec.fields.Sales_Price__c.value : 0;
                const total = qty * price;
                tableData.push([
                    { content: name, styles: { fontStyle: 'bold' } },
                    { content: String(qty), styles: { halign: 'center' } },
                    { content: `$${parseFloat(price).toFixed(2)}`, styles: { halign: 'right' } },
                    { content: `$${total.toFixed(2)}`, styles: { fontStyle: 'bold', halign: 'right' } }
                ]);
                if (desc) {
                    desc.split('\n').forEach(line => {
                        if (line.trim()) tableData.push([
                            { content: line.trim(), colSpan: 4, styles: { fontStyle: 'normal', textColor: [80, 80, 80], fontSize: 8.5 } }
                        ]);
                    });
                }
            });

            doc.autoTable({
                startY: y,
                head: [[
                    { content: 'Service / Product', styles: { halign: 'left' } },
                    { content: 'Qty',               styles: { halign: 'center' } },
                    { content: 'Unit Price',         styles: { halign: 'right' } },
                    { content: 'Total',              styles: { halign: 'right' } }
                ]],
                body: tableData,
                theme: 'plain',
                headStyles: { fillColor: [212, 175, 55], textColor: [2, 12, 29], fontStyle: 'bold', fontSize: 9 },
                bodyStyles: { fillColor: [247, 231, 206], textColor: [2, 12, 29], fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 92 },
                    1: { cellWidth: 18, halign: 'center' },
                    2: { cellWidth: 36, halign: 'right' },
                    3: { cellWidth: 36, halign: 'right' }
                },
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

            goldLine();
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
            chk(60);
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

            this.rawContractHtml = this.buildContractHtml();
            this.currentStep = '3';
            this.isLoading = false;

        } catch (e) {
            console.error('PDF Generation Error:', e);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({ title: 'Could not generate PDF', message: 'An error occurred while preparing the document. Please try again.', variant: 'error' }));
        }
    }

    buildContractHtml() {
        const goldLine = '<p class="gold-line" style="display:block;width:100%;border-bottom:2pt solid #D4AF37;margin:15px 0;font-size:0;line-height:0;"></p>';

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

        const venueStreet = this.oppData?.fields?.Venue__Street__s?.value    || '';
        const venueCity   = this.oppData?.fields?.Venue__City__s?.value      || '';
        const venueState  = this.oppData?.fields?.Venue__StateCode__s?.value || '';
        const venueZip    = this.oppData?.fields?.Venue__PostalCode__s?.value || '';

        const formulaName = this.oppData?.fields?.Client_Name_Formula__c?.value;
        const accName     = this.accRecordData.Name?.value || '';
        const clientName  = formulaName || accName || 'Client';

        const createdDate   = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        const eventDate     = eventDateRaw
            ? new Date(eventDateRaw + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : 'TBD';
        const clientAddress = [billingStreet, billingCity, `${billingState} ${billingZip}`.trim()].filter(Boolean).join(', ');
        const venue         = [venueStreet, venueCity, `${venueState} ${venueZip}`.trim()].filter(Boolean).join(', ') || 'TBD';
        const depositString = isDepositPaid
            ? `A non-refundable deposit of $${depAmt} was paid prior to this Agreement.`
            : `A non-refundable deposit of $${depAmt} is due upon signing this Agreement.`;

        const fmtDescHtml = t => {
            if (!t) return '';
            return t
                .replace(/<\/p>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
                .replace(/(<([^>]+)>)/gi, '')
                .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#10;/g, '\n')
                .replace(/\r\n|\r/g, '\n')
                .replace(/^[-*]\s+/gm, '\u2022 ').trim()
                .replace(/\n/g, '<br/>');
        };

        const dbLines = this.wiredLineItemsResult?.data?.records || [];
        const lineItemRows = dbLines.map(rec => {
            const name  = rec.fields.Product__r?.value?.fields?.Name?.value || '';
            const desc  = fmtDescHtml(rec.fields.Description__c?.value || '');
            const qty   = rec.fields.Quantity__c?.value != null ? rec.fields.Quantity__c.value : 0;
            const price = rec.fields.Sales_Price__c?.value != null ? rec.fields.Sales_Price__c.value : 0;
            const total = qty * price;
            return `<tr>
                    <td style="padding:8px;font-size:9pt;border-bottom:1px solid #D4AF37;vertical-align:top;width:40%;font-weight:bold;">${name}${desc ? '<br/><span style="font-weight:normal;font-size:9pt;color:#444;">' + desc + '</span>' : ''}</td>
                    <td style="padding:8px;font-size:9pt;border-bottom:1px solid #D4AF37;vertical-align:top;width:10%;text-align:center;">${qty}</td>
                    <td style="padding:8px;font-size:9pt;border-bottom:1px solid #D4AF37;vertical-align:top;width:25%;text-align:right;">$${parseFloat(price).toFixed(2)}</td>
                    <td style="padding:8px;font-size:9pt;border-bottom:1px solid #D4AF37;vertical-align:top;width:25%;text-align:right;font-weight:bold;">$${total.toFixed(2)}</td>
                </tr>`;
        }).join('');

        return `${goldLine}

<h2>Introduction</h2>
<p>This <strong>Event Planning / Decor Contract Agreement (&quot;Agreement&quot;)</strong> is entered into on <strong>${createdDate}</strong> by and between:</p>
<ul class="contract-list">
    <li><strong>Adorned By Veena, LLC</strong>, a limited liability company organized and existing under the laws of the State of Texas, with its principal office located at <strong>19730 Shinnery Ridge Ct, Cypress, TX 77433, represented by Veena Boppana, Principal Designer (the &quot;Company&quot;)</strong>.</li>
    <li><strong>${clientName}</strong>, an individual residing at <strong>${clientAddress || 'address on file'} (&quot;the Client&quot;)</strong>.</li>
</ul>
<p><strong>The parties hereby agree as follows:</strong></p>

${goldLine}

<h2>Scope of Services</h2>
<h3>Event Planning Services</h3>
<p>The Company agrees to provide the following services for the event hosted by the Client:</p>
<table class="line-items-table" style="width:100%;border-collapse:collapse;margin:10px 0 15px 0;">
    <thead>
        <tr>
            <th style="background-color:#D4AF37;color:#020C1D;font-weight:bold;padding:8px;text-align:left;font-size:9pt;width:40%;">Service / Product</th>
            <th style="background-color:#D4AF37;color:#020C1D;font-weight:bold;padding:8px;text-align:center;font-size:9pt;width:10%;">Qty</th>
            <th style="background-color:#D4AF37;color:#020C1D;font-weight:bold;padding:8px;text-align:right;font-size:9pt;width:25%;">Unit Price</th>
            <th style="background-color:#D4AF37;color:#020C1D;font-weight:bold;padding:8px;text-align:right;font-size:9pt;width:25%;">Total</th>
        </tr>
    </thead>
    <tbody>
        ${lineItemRows}
    </tbody>
</table>
<p>These services will be provided in accordance with the terms outlined in this Agreement.</p>

<div style="page-break-after: always;"></div>

<h3 style="font-style:italic;font-weight:bold;">Exclusions</h3>
<p style="font-style:italic;font-size:9pt;">The following services are excluded from this Agreement:</p>
<ul class="contract-list" style="font-style:italic;font-size:9pt;">
    <li>Travel or accommodation costs for The Company or Client unless otherwise specified.</li>
    <li>Insurance for the event (Client will need to secure separate insurance coverage).</li>
    <li>Costs for any services or items not explicitly mentioned in this Agreement.</li>
</ul>

${goldLine}

<div class="avoid-break">
    <h2>Event Details</h2>
    <ul class="contract-list">
        <li><strong>Event Name:</strong> ${oppName}</li>
        <li><strong>Event Date:</strong> ${eventDate}</li>
        <li><strong>Event Location:</strong> ${venue}</li>
    </ul>
</div>

${goldLine}

<div class="avoid-break">
    <h2>Compensation and Payment Terms</h2>
    <h3>Fees</h3>
    <ul class="contract-list">
        <li>Flat Event Planning Fee: <strong>$${totalAmt}</strong> for all planning and coordination services.</li>
    </ul>
    <h3>Payment Schedule</h3>
    <ul class="contract-list">
        <li><strong>Deposit:</strong> ${depositString}</li>
        <li><strong>Final Payment:</strong> The remaining balance of <strong>$${balAmt}</strong> is due no later than the day of the event.</li>
    </ul>
    <ul class="contract-list" style="font-style:italic;color:#555;font-size:9.5pt;line-height:1.6;margin-top:15px;">
        <li>Fees are subject to Texas State &amp; Local Sales Tax (currently 8.25% in Cypress/Harris County). Tax will be itemized on the final invoice unless otherwise specified.</li>
        <li>Payments are accepted via Zelle, Cash, or Credit Card. Credit Card payments incur a 3% convenience fee.</li>
        <li><strong>Zelle payments should be directed to adornedbyveena@gmail.com with the Inv Ref: ${oppName} - ${eventDate} in the memo.</strong></li>
    </ul>
</div>

${goldLine}

<h2>Responsibilities of the Parties</h2>

<div class="avoid-break">
    <h3>The Company&apos;s Responsibilities</h3>
    <ul class="contract-list">
        <li>Provide event planning services as outlined in this Agreement.</li>
        <li>Coordinate and manage vendors, venue, and logistics for the event.</li>
        <li>Ensure all event-related activities are completed as scheduled.</li>
        <li>Maintain communication with Clients to ensure satisfaction and resolve any issues.</li>
        <li>Provide on-site event management to ensure smooth operations during the event.</li>
    </ul>
</div>

<div class="avoid-break">
    <h3>Client&apos;s Responsibilities</h3>
    <ul class="contract-list">
        <li><strong>Information Accuracy:</strong> Provide all event goals, themes, and budget constraints.</li>
        <li><strong>Decision-Making Authority:</strong> Client must designate one (1) primary point of contact with full authority to make binding decisions and approvals.</li>
        <li><strong>Financial Obligations:</strong> Ensure timely payments of planning fees and direct vendor invoices.</li>
        <li><strong>Approvals:</strong> Review and approve designs and contracts within 72 hours of receipt.</li>
        <li><strong>Venue Logistics:</strong> Provide all necessary access codes, loading-dock info, and permits.</li>
        <li><strong>Third-Party Agreements:</strong> Client shall sign and be solely responsible for all vendor contracts.</li>
        <li><strong>Conduct &amp; Liability:</strong> Client is responsible for guest behavior and any damages caused by attendees.</li>
        <li><strong>Proof of Insurance (COI):</strong> Client is responsible for obtaining &apos;Event Cancellation&apos; or &apos;Host Liability&apos; insurance if required by the venue.</li>
    </ul>
</div>

${goldLine}

<div class="avoid-break">
    <h2>Changes and Cancellations</h2>
    <h3>Changes to the Event Scope</h3>
    <p>If Client wishes to make significant changes to the event scope, such as increasing the number of attendees, adding services, or changing the event date, such changes will be documented and may result in additional charges. Changes must be communicated to The Company in writing and approved by both parties.</p>
    <h3>Event Cancellation</h3>
    <p>If the event is canceled by the Client:</p>
    <ul class="contract-list">
        <li><strong>More than 15 days prior to event date:</strong> Client will be responsible for paying 50% of the total fees (deposit and planning services).</li>
        <li><strong>Less than 15 days prior to event date:</strong> Client will be responsible for paying 100% of the total fees (deposit and planning services).</li>
    </ul>
    <h3>Force Majeure &amp; Limited Liability</h3>
    <ul class="contract-list">
        <li>If The Company is unable to perform due to circumstances beyond their reasonable control, including but not limited to hurricanes, tropical storms, regional power grid failures, or other Acts of God &mdash; the Company&apos;s liability shall be limited to refund of the unearned portion of the deposit.</li>
        <li>The Company shall be entitled to retain a prorated amount of the deposit to compensate for services already rendered (e.g., planning hours, site visits, and administrative costs) up to the date of the event. Neither party shall be liable for any further indirect, consequential, or damages.</li>
    </ul>
    <p>This Agreement is governed by the laws of the State of Texas. Any disputes shall be resolved via mandatory mediation in Harris County, Texas, prior to the filing of any lawsuit.</p>
</div>

${goldLine}

<div class="avoid-break">
    <h2>Confidentiality</h2>
    <ul class="contract-list">
        <li>Both parties agree to keep all sensitive information confidential, including but not limited to event details, pricing, and any proprietary business information disclosed during the term of this Agreement.</li>
        <li>This confidentiality obligation will survive the termination of this Agreement.</li>
    </ul>
    <h2>Governing Law</h2>
    <ul class="contract-list">
        <li>This Agreement shall be governed by and construed in accordance with the laws of the State of Texas.</li>
        <li>Any disputes arising from this Agreement will be resolved in the courts located in Harris County, Texas.</li>
    </ul>
</div>

<div style="page-break-before: always;"></div>

<div class="avoid-break">
    <h2>Miscellaneous Provisions</h2>
    <h3>Entire Agreement</h3>
    <ul class="contract-list">
        <li>This Agreement constitutes the full and complete understanding between the parties regarding the event planning services and supersedes all prior agreements or understandings, whether written or oral.</li>
    </ul>
    <h3>Amendments</h3>
    <ul class="contract-list">
        <li>Any amendments or modifications to this Agreement must be made in writing and signed by both parties.</li>
    </ul>
    <h3>Severability</h3>
    <ul class="contract-list">
        <li>If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.</li>
    </ul>
    <p style="margin: 15px 0 10px 0;">For any inquiries regarding this agreement, please contact <strong>Veena Boppana</strong> at <strong>veena@adornedbyveena.com</strong></p>
</div>

${goldLine}

<div class="avoid-break">
    <h2>Acknowledgement &amp; Acceptance</h2>
    <p>By signing below, the parties acknowledge that they have read, understood, and agree to the terms and conditions outlined in this Agreement.</p>
    <table class="sig-table" style="width:100%;margin-top:20px;">
        <tr>
            <td style="width:45%;vertical-align:bottom;">
                <div style="border-bottom:1px solid #020C1D;height:50px;"></div>
                <div style="font-size:10pt;margin-top:4px;">
                    <strong>Adorned by Veena, LLC</strong><br/>
                    Date: ${createdDate}
                </div>
            </td>
            <td style="width:10%;"></td>
            <td style="width:45%;vertical-align:bottom;text-align:right;">
                <div style="border-bottom:1px solid #020C1D;height:50px;"></div>
                <div style="font-size:10pt;margin-top:4px;text-align:right;">
                    <strong>${clientName}</strong><br/>
                    Date: ${createdDate}
                </div>
            </td>
        </tr>
    </table>
</div>`;
    }

    goBack() {
        if (this.currentStep === '4') { this.currentStep = '3'; }
        else if (this.currentStep === '3') { this.currentStep = '2'; this.pdfUrl = null; this.rawPdfBase64 = null; }
        else if (this.currentStep === '2') { this.currentStep = '1'; }
    }

    previewEmail() { this.currentStep = '4'; }

    closeAction() { this.dispatchEvent(new CloseActionScreenEvent()); }

    async saveAndSend() {
        this.isLoading = true;
        try {
            await sendContractEmail({
                recordId: this.recordId,
                pdfBase64: this.rawPdfBase64,
                fileName: this.pdfFileName,
                contractHtml: this.rawContractHtml
            });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Contract Sent',
                message: 'The contract has been sent to the client for signature.',
                variant: 'success'
            }));
            this.closeAction();
        } catch (e) {
            const msg = e?.body?.message || e?.message || 'Something went wrong. Please try again.';
            console.error('Send Error:', e);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({ title: 'Could not send contract', message: msg, variant: 'error', mode: 'sticky' }));
        }
    }
}