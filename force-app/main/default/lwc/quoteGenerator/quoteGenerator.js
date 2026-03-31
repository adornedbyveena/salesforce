import { LightningElement, api, wire, track } from 'lwc';
import { deleteRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { getRecord } from 'lightning/uiRecordApi';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import sendQuoteEmail from '@salesforce/apex/QuoteController.sendQuoteEmail';

import modalOverride from '@salesforce/resourceUrl/InvoiceModalStyle';
import JSPDF_LIB from '@salesforce/resourceUrl/jsPDF';
import AUTOTABLE_LIB from '@salesforce/resourceUrl/jsPDFAutoTable';
import { adornedByVeenaLogo } from './logoData';

const OPPORTUNITY_FIELDS = [
    'Opportunity.Name',
    'Opportunity.CloseDate',
    'Opportunity.AccountId',
    'Opportunity.Account.Name',
    'Opportunity.Total_Amount__c',
    'Opportunity.Deposit__c',
    'Opportunity.Balance_Due__c',
    'Opportunity.Deposit_Paid__c',
    'Opportunity.Client_Name_Formula__c',
    'Opportunity.Client_Email__c',
    'Opportunity.Venue__Street__s',
    'Opportunity.Venue__City__s',
    'Opportunity.Venue__StateCode__s',
    'Opportunity.Venue__PostalCode__s'
];

export default class QuoteGenerator extends LightningElement {
    @api recordId;
    @track currentStep = '1';
    @track isLoading = true;
    @track rows = [];
    @track pdfUrl;
    @track emailTo = '';
    @track emailSubject = '';
    @track emailClientName = '';
    @track emailEventName = '';
    @track pdfFileName = 'Quote.pdf';

    accountId; oppData; rawPdfBase64; rawQuoteHtml; jsPdfInitialized = false;
    saveCount = 0; totalForms = 0; wiredLineItemsResult;
    oppSaved = false; accSaved = false;
    oppRecordData = {}; accRecordData = {};

    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }
    get isStep4() { return this.currentStep === '4'; }

    renderedCallback() {
        if (this.jsPdfInitialized) return;
        this.jsPdfInitialized = true;
        loadStyle(this, modalOverride).catch(e => console.error('Error loading CSS:', e));
        Promise.all([loadScript(this, JSPDF_LIB)])
            .then(() => loadScript(this, AUTOTABLE_LIB))
            .then(() => { this.isLoading = false; })
            .catch(e => { console.error('Error loading PDF Scripts:', e); this.isLoading = false; });
    }

    @wire(getRecord, { recordId: '$recordId', fields: OPPORTUNITY_FIELDS })
    wiredOpp({ data }) {
        if (data) {
            this.oppData = data;
            this.accountId = data.fields.AccountId.value;
        }
    }

    @wire(getRelatedListRecords, {
        parentRecordId: '$recordId',
        relatedListId: 'Line_Items__r',
        fields: [
            'Line_Item__c.Id', 'Line_Item__c.Quantity__c', 'Line_Item__c.Sales_Price__c',
            'Line_Item__c.Discount__c', 'Line_Item__c.Description__c',
            'Line_Item__c.Product__c', 'Line_Item__c.Product__r.Name'
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

    // ── STEP 2: DETAILS ──
    saveStep2() {
        this.isLoading = true; this.oppSaved = false; this.accSaved = false;
        this.template.querySelector('lightning-record-edit-form[data-id="oppForm"]').submit();
        this.template.querySelector('lightning-record-edit-form[data-id="accForm"]').submit();
    }

    handleOppSuccess(event) { this.oppRecordData = event.detail.fields; this.oppSaved = true; this.checkStep2Done(); }
    handleAccSuccess(event) { this.accRecordData = event.detail.fields; this.accSaved = true; this.checkStep2Done(); }
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

    checkStep2Done() {
        if (this.oppSaved && this.accSaved) {
            this.generatePDF();
            this.currentStep = '3';
            this.isLoading = false;
        }
    }

    // ── STEP 3: PDF ──
    generatePDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F'); doc.setTextColor(2, 12, 29);

            // Header
            doc.setFontSize(26); doc.setFont("helvetica", "bold");
            doc.text("QUOTE", 196, 20, { align: "right" });
            doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.5); doc.line(14, 25, 196, 25);

            doc.addImage(adornedByVeenaLogo, 'PNG', 14, 30, 40, 32);

            const oppName         = this.oppRecordData.Name?.value || this.oppData?.fields?.Name?.value || 'Event';
            const eventDateRaw    = this.oppData?.fields?.CloseDate?.value;
            const eventDateFormatted = eventDateRaw ? new Date(eventDateRaw).toLocaleDateString() : '';
            const metadataStartY  = 40; const lineSpacing = 7;

            doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("Quote Reference:", 140, metadataStartY);
            doc.text(oppName, 196, metadataStartY, { align: "right" });
            doc.text("Issue Date:", 140, metadataStartY + lineSpacing);
            doc.text(new Date().toLocaleDateString(), 196, metadataStartY + lineSpacing, { align: "right" });
            if (eventDateFormatted) {
                doc.text("Event Date:", 140, metadataStartY + (lineSpacing * 2));
                doc.text(eventDateFormatted, 196, metadataStartY + (lineSpacing * 2), { align: "right" });
            }

            // Company / Client block
            let leftY = 75;
            doc.setFontSize(14); doc.setFont("helvetica", "bold");
            doc.text("Company", 14, leftY);
            const clientAreaX = 140; doc.text("Client", clientAreaX, leftY);

            leftY += 8; doc.setFontSize(10);
            doc.text("Adorned By Veena", 14, leftY);
            const accName  = this.accRecordData.Name?.value || this.oppData?.fields?.Account?.value?.fields?.Name?.value || '';
            const accEmail = this.accRecordData.PersonEmail?.value || '';
            const accPhone = this.accRecordData.Phone?.value || this.accRecordData.PersonMobilePhone?.value || '';
            const street   = this.oppData?.fields?.Venue__Street__s?.value || '';
            const city     = this.oppData?.fields?.Venue__City__s?.value || '';
            const state    = this.oppData?.fields?.Venue__StateCode__s?.value || '';
            const zip      = this.oppData?.fields?.Venue__PostalCode__s?.value || '';

            if (accName) doc.text(accName, clientAreaX, leftY);
            leftY += 5; doc.setFont("helvetica", "normal");
            doc.text("adornedbyveena.com", 14, leftY);
            doc.text("19730 Shinnery Ridge Ct", 14, leftY + 5);
            doc.text("Cypress, TX 77433", 14, leftY + 10);

            let rightY = leftY;
            if (accEmail) { doc.text(accEmail, clientAreaX, rightY); rightY += 5; }
            if (accPhone) { doc.text(accPhone, clientAreaX, rightY); rightY += 5; }
            if (street)   { doc.text(street,   clientAreaX, rightY); rightY += 5; }
            if (city)     { doc.text(`${city}, ${state} ${zip}`, clientAreaX, rightY); }

            // Line items table
            const dbLines = this.wiredLineItemsResult?.data?.records || [];
            let tGross = 0; let tDisc = 0; let tNet = 0;
            const tableData = [];

            const parseDescForPdf = html => {
                if (!html) return [];
                const processed = html
                    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_, _t, inner) =>
                        '\x01' + inner.replace(/(<([^>]+)>)/gi, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim() + '\x01')
                    .replace(/<li[^>]*>/gi, '\n\u2022 ').replace(/<\/li>/gi, '')
                    .replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<br\s*\/?>/gi, '\n')
                    .replace(/(<([^>]+)>)/gi, '')
                    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#10;/g, '\n')
                    .replace(/\r\n|\r/g, '\n');
                return processed.split('\n')
                    .map(line => line.trim()).filter(line => line.length > 0)
                    .map(line => ({ text: line.replace(/\x01/g, '').trim(), bold: line.includes('\x01') }))
                    .filter(item => item.text.length > 0);
            };

            dbLines.forEach(rec => {
                let productName = 'Service Item';
                if (rec.fields.Product__r?.value?.fields?.Name?.value) productName = rec.fields.Product__r.value.fields.Name.value;
                else if (rec.fields.Product__c?.displayValue) productName = rec.fields.Product__c.displayValue;
                const descItems = parseDescForPdf(rec.fields.Description__c?.value || '');
                const q     = parseFloat(rec.fields.Quantity__c?.value) || 0;
                const p     = parseFloat(rec.fields.Sales_Price__c?.value) || 0;
                const d     = parseFloat(rec.fields.Discount__c?.value) || 0;
                const gross = q * p;
                const net   = gross - d;
                tGross += gross; tDisc += d; tNet += net;
                tableData.push([
                    { content: productName, styles: { fontStyle: 'bold' } },
                    q,
                    `$${p.toFixed(2)}`,
                    `$${net.toFixed(2)}`
                ]);
                descItems.forEach(item => {
                    tableData.push([{ content: item.text, colSpan: 4, styles: { fontStyle: item.bold ? 'bold' : 'normal', textColor: [40, 40, 40] } }]);
                });
            });

            const tableStartY = Math.max(leftY + 15, rightY + 10);
            doc.autoTable({
                startY: tableStartY,
                head: [[
                    { content: 'Service / Product', styles: { halign: 'left'  } },
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
                margin: { left: 14, right: 14 }
            });

            // Totals
            const deposit = parseFloat(this.oppRecordData.Deposit__c?.value || this.oppData?.fields?.Deposit__c?.value || 0);
            let fY = doc.lastAutoTable.finalY;
            const totalsNeeded = 50 + (tDisc > 0 ? 7 : 0) + (deposit > 0 ? 7 : 0);
            if (fY + totalsNeeded > 277) {
                doc.addPage(); doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F');
                doc.setTextColor(2, 12, 29); fY = 15;
            }
            doc.setDrawColor(212, 175, 55); doc.line(110, fY + 10, 196, fY + 10);
            doc.setFontSize(10); doc.setFont("helvetica", "bold");
            doc.text("Subtotal", 110, fY + 17);
            doc.setFont("helvetica", "normal"); doc.text(`$${tGross.toFixed(2)}`, 196, fY + 17, { align: "right" });
            let nextY = fY + 17;
            if (tDisc > 0) {
                nextY += 7;
                doc.setFont("helvetica", "bold"); doc.text("Discount", 110, nextY);
                doc.setFont("helvetica", "normal"); doc.text(`-$${tDisc.toFixed(2)}`, 196, nextY, { align: "right" });
            }
            nextY += 7; doc.line(110, nextY + 3, 196, nextY + 3); nextY += 10;
            doc.setFont("helvetica", "bold");
            doc.text("Estimated Total", 110, nextY); doc.text(`$${tNet.toFixed(2)}`, 196, nextY, { align: "right" });

            if (deposit > 0) {
                nextY += 7;
                doc.setFont("helvetica", "bold"); doc.text("Deposit Required", 110, nextY);
                doc.setFont("helvetica", "normal"); doc.text(`$${deposit.toFixed(2)}`, 196, nextY, { align: "right" });
            }

            // Footer notes
            let footerY = nextY + 20;
            if (footerY > 250) {
                doc.addPage(); doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F');
                doc.setTextColor(2, 12, 29); footerY = 20;
            }
            doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.5); doc.line(14, footerY, 196, footerY);
            footerY += 10;
            doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Notes", 14, footerY);
            footerY += 6; doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("This quote is valid for 30 days from the issue date.", 14, footerY);
            footerY += 5; doc.text("Pricing is subject to change based on final event details.", 14, footerY);
            footerY += 5; doc.text("A signed contract and deposit are required to confirm your booking.", 14, footerY);

            footerY += 15;
            doc.setFont("helvetica", "italic"); doc.text("With appreciation,", 14, footerY);
            footerY += 6; doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Veena Boppana", 14, footerY);
            footerY += 5; doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("512-840-8811 ", 14, footerY);
            const phoneWidth = doc.getTextWidth("512-840-8811 ");
            doc.setTextColor(212, 175, 55); doc.text("|", 14 + phoneWidth, footerY);
            doc.setTextColor(2, 12, 29); doc.text(" veena@adornedbyveena.com", 14 + phoneWidth + doc.getTextWidth("| "), footerY);

            const pageHeight = doc.internal.pageSize.height || 297;
            doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(212, 175, 55);
            doc.text("Thank you for letting us adorn your special day!", 105, pageHeight - 15, { align: "center" });

            const pdfBlob = doc.output('blob');
            this.pdfUrl       = URL.createObjectURL(pdfBlob);
            this.rawPdfBase64 = btoa(doc.output());
            this.rawQuoteHtml = this.buildQuoteHtml(oppName, eventDateFormatted, accName, accEmail, accPhone, street, city, state, zip, dbLines, tGross, tDisc, tNet, deposit);

            // Email preview
            const formulaName = this.oppData?.fields?.Client_Name_Formula__c?.value;
            const clientName  = formulaName || this.accRecordData.Name?.value || 'Client';
            const oppName2    = this.oppRecordData.Name?.value || this.oppData?.fields?.Name?.value || 'Event';
            const dateStr     = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

            this.emailClientName = clientName;
            this.emailEventName  = oppName2;
            this.emailTo         = this.oppData?.fields?.Client_Email__c?.value || '';
            this.emailSubject    = `Your Quote - ${oppName2}`;
            this.pdfFileName     = `${clientName} - Quote - ${dateStr}.pdf`;

        } catch (e) {
            console.error('PDF Generation Error:', e);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({ title: 'Could not generate PDF', message: 'An error occurred while preparing the document. Please try again.', variant: 'error' }));
        }
    }

    buildQuoteHtml(oppName, eventDate, accName, accEmail, accPhone, street, city, state, zip, dbLines, tGross, tDisc, tNet, deposit) {
        const goldLine = '<p class="gold-line" style="display:block;width:100%;border-bottom:2pt solid #D4AF37;margin:15px 0;font-size:0;line-height:0;"></p>';
        const quoteDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const clientAddress = [street, city && state ? `${city}, ${state} ${zip}` : city].filter(Boolean).join('<br/>');

        const fmtDescHtml = t => t || '';

        const lineItemRows = dbLines.map(rec => {
            const name  = rec.fields.Product__r?.value?.fields?.Name?.value || rec.fields.Product__c?.displayValue || 'Service Item';
            const desc  = fmtDescHtml(rec.fields.Description__c?.value || '');
            const q     = parseFloat(rec.fields.Quantity__c?.value) || 0;
            const p     = parseFloat(rec.fields.Sales_Price__c?.value) || 0;
            const d     = parseFloat(rec.fields.Discount__c?.value) || 0;
            const net   = (q * p) - d;
            return `<tr>
                <td class="line-name">${name}${desc ? `<br/><span class="line-desc">${desc}</span>` : ''}</td>
                <td class="line-qty">${q}</td>
                <td class="line-price">$${p.toFixed(2)}</td>
                <td class="line-total">$${net.toFixed(2)}</td>
            </tr>`;
        }).join('');

        const discountRow = tDisc > 0
            ? `<tr><td style="padding:4px 8px;">Discount</td><td style="text-align:right;padding:4px 8px;color:#c62828;">-$${tDisc.toFixed(2)}</td></tr>`
            : '';

        const depositRow = deposit > 0
            ? `<tr class="summary-deposit"><td style="padding:4px 8px;">Deposit Required</td><td style="text-align:right;padding:4px 8px;">$${deposit.toFixed(2)}</td></tr>`
            : '';

        return `
${goldLine}
<div class="avoid-break">
<h2>Event Information</h2>
<table style="width:100%;margin-bottom:10px;border-collapse:collapse;">
    <tr><td style="width:30%;font-weight:bold;padding:4px 0;">Event:</td><td>${oppName}</td></tr>
    ${eventDate ? `<tr><td style="font-weight:bold;padding:4px 0;">Event Date:</td><td>${eventDate}</td></tr>` : ''}
    ${accName   ? `<tr><td style="font-weight:bold;padding:4px 0;">Client:</td><td>${accName}</td></tr>` : ''}
    ${accEmail  ? `<tr><td style="font-weight:bold;padding:4px 0;">Email:</td><td>${accEmail}</td></tr>` : ''}
    ${accPhone  ? `<tr><td style="font-weight:bold;padding:4px 0;">Phone:</td><td>${accPhone}</td></tr>` : ''}
    ${clientAddress ? `<tr><td style="font-weight:bold;padding:4px 0;vertical-align:top;">Event Location:</td><td>${clientAddress}</td></tr>` : ''}
    <tr><td style="font-weight:bold;padding:4px 0;">Quote Date:</td><td>${quoteDate}</td></tr>
</table>
</div>
${goldLine}
<h2>Services &amp; Pricing</h2>
<table class="line-items-table">
    <thead><tr>
        <th class="line-name" style="text-align:left;">Service</th>
        <th class="line-qty">Qty</th>
        <th class="line-price" style="text-align:right;">Unit Price</th>
        <th class="line-total" style="text-align:right;">Total</th>
    </tr></thead>
    <tbody>${lineItemRows}</tbody>
</table>
<div class="avoid-break">
<table class="summary-table">
    <tr><td style="padding:4px 8px;">Subtotal</td><td style="text-align:right;padding:4px 8px;">$${tGross.toFixed(2)}</td></tr>
    ${discountRow}
    <tr class="summary-total"><td style="padding:8px;border-top:2pt solid #D4AF37;font-weight:bold;">Estimated Total</td><td style="text-align:right;padding:8px;border-top:2pt solid #D4AF37;font-weight:bold;">$${tNet.toFixed(2)}</td></tr>
    ${depositRow}
</table>
</div>
${goldLine}
<div class="avoid-break">
<h2>Notes</h2>
<p class="payment-note">This quote is valid for 30 days from the issue date. Pricing is subject to change based on final event details. A signed contract and deposit payment are required to confirm your booking.</p>
</div>`;
    }

    // ── NAVIGATION ──
    goBack() {
        if      (this.currentStep === '2') { this.currentStep = '1'; }
        else if (this.currentStep === '3') { this.currentStep = '2'; this.pdfUrl = null; this.rawPdfBase64 = null; this.rawQuoteHtml = null; }
        else if (this.currentStep === '4') { this.currentStep = '3'; }
    }

    previewEmail() { this.currentStep = '4'; }
    closeAction()  { this.dispatchEvent(new CloseActionScreenEvent()); }

    async saveAndSend() {
        this.isLoading = true;
        try {
            await sendQuoteEmail({
                recordId:  this.recordId,
                pdfBase64: this.rawPdfBase64,
                fileName:  this.pdfFileName,
                quoteHtml: this.rawQuoteHtml
            });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Quote Sent',
                message: 'The quote has been sent to the client.',
                variant: 'success'
            }));
            this.closeAction();
        } catch (e) {
            const msg = e?.body?.message || e?.message || 'Something went wrong. Please try again.';
            console.error('Send Error:', e);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({ title: 'Could not send quote', message: msg, variant: 'error', mode: 'sticky' }));
        }
    }
}