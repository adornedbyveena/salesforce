import { LightningElement, api, wire, track } from 'lwc';
import { deleteRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { getRecord } from 'lightning/uiRecordApi';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import sendInvoiceEmail from '@salesforce/apex/InvoiceController.sendInvoiceEmail';

import modalOverride from '@salesforce/resourceUrl/InvoiceModalStyle';
import JSPDF_LIB from '@salesforce/resourceUrl/jsPDF';
import AUTOTABLE_LIB from '@salesforce/resourceUrl/jsPDFAutoTable';
import { adornedByVeenaLogo } from './logoData';

const OPPORTUNITY_FIELDS = [
    'Opportunity.Name',
    'Opportunity.Total_Amount__c',
    'Opportunity.AccountId',
    'Opportunity.Account.Name',
    'Opportunity.CloseDate',
    'Opportunity.Client_Name_Formula__c',
    'Opportunity.Client_Email__c',
    'Opportunity.Venue__Street__s',
    'Opportunity.Venue__City__s',
    'Opportunity.Venue__StateCode__s',
    'Opportunity.Venue__PostalCode__s'
];

export default class InvoiceGenerator extends LightningElement {
    @api recordId;
    @track currentStep = '1';
    @track isLoading = true;
    @track rows = [];
    @track uploadedImages = [];
    @track pdfUrl;
    @track emailTo = '';
    @track emailSubject = '';
    @track emailClientName = '';
    @track emailEventName = '';
    @track pdfFileName = 'Invoice.pdf';

    accountId; oppData; rawPdfBase64; jsPdfInitialized = false;
    saveCount = 0; totalForms = 0; wiredLineItemsResult;

    oppSaved = false; accSaved = false;
    oppRecordData = {}; accRecordData = {};

    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }
    get isStep4() { return this.currentStep === '4'; }
    get isStep5() { return this.currentStep === '5'; }

    get venueStreet()     { return this.oppData?.fields?.Venue__Street__s?.value    || ''; }
    get venueCity()       { return this.oppData?.fields?.Venue__City__s?.value      || ''; }
    get venueState()      { return this.oppData?.fields?.Venue__StateCode__s?.value || ''; }
    get venuePostalCode() { return this.oppData?.fields?.Venue__PostalCode__s?.value || ''; }
    get hasVenueAddress() { return !!(this.venueStreet || this.venueCity); }

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
        fields: ['Line_Item__c.Id', 'Line_Item__c.Quantity__c', 'Line_Item__c.Sales_Price__c', 'Line_Item__c.Discount__c', 'Line_Item__c.Description__c', 'Line_Item__c.Product__c', 'Line_Item__c.Product__r.Name']
    })
    wiredLineItems(result) {
        this.wiredLineItemsResult = result;
        if (result.data) {
            this.rows = result.data.records.map(rec => ({ id: rec.id, recordId: rec.id }));
            if (this.rows.length === 0) this.addRow();
        }
    }

    // --- STEP 1: LINE ITEMS ---
    addRow() { this.rows = [...this.rows, { id: Date.now() + Math.random(), recordId: null }]; }
    removeRow(e) {
        const id = e.target.dataset.id; const row = this.rows.find(r => r.id === id);
        if (row && row.recordId) deleteRecord(row.recordId);
        this.rows = this.rows.filter(r => r.id !== id);
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

    // --- STEP 2: HEADER ---
    saveStep2() {
        this.isLoading = true; this.oppSaved = false; this.accSaved = false;
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
            PersonEmail: 'Email', PersonMobilePhone: 'Mobile Phone',
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
            this.currentStep = '3';
            this.isLoading = false;
        }
    }

    // --- STEP 3: REFERENCE PICTURES ---
    async handleFileChange(event) {
        const files = event.target.files;
        const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'webp', 'avif', 'svg', 'eps'];

        for (let file of files) {
            const extension = file.name.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(extension)) {
                this.dispatchEvent(new ShowToastEvent({ title: 'Invalid File Type', message: `The file "${file.name}" is not a supported image format.`, variant: 'error' }));
                continue;
            }
            try {
                const originalBase64 = await this.readFileAsDataURL(file);
                const compressedData = await this.compressImage(originalBase64, 1024, 0.7);
                this.uploadedImages.push({
                    id: Date.now() + Math.random().toString(),
                    originalName: file.name,
                    customName: file.name.replace(/\.[^/.]+$/, ""),
                    base64: compressedData.dataUrl,
                    rawBase64: compressedData.dataUrl.split(',')[1],
                    extension: 'JPEG',
                    width: compressedData.width,
                    height: compressedData.height
                });
            } catch (error) {
                this.dispatchEvent(new ShowToastEvent({ title: 'Browser Rendering Limitation', message: `Could not process "${file.name}".`, variant: 'warning' }));
            }
        }
    }

    handleImageRename(event) {
        const id = event.target.dataset.id;
        const img = this.uploadedImages.find(i => i.id === id);
        if (img) img.customName = event.target.value;
    }

    removeImage(event) {
        const id = event.target.dataset.id;
        this.uploadedImages = this.uploadedImages.filter(i => i.id !== id);
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    compressImage(base64Str, maxWidth = 1024, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round((height *= maxWidth / width)); width = maxWidth; }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve({ dataUrl: compressedDataUrl, width: width, height: height });
            };
            img.onerror = (err) => reject(err);
            img.src = base64Str;
        });
    }

    saveStep3() {
        this.generatePDF();
        this.currentStep = '4';
    }

    // --- STEP 4: PDF ENGINE ---
    generatePDF() {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F'); doc.setTextColor(2, 12, 29);

            doc.setFontSize(26); doc.setFont("helvetica", "bold"); doc.text("INVOICE", 196, 20, { align: "right" });
            doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.5); doc.line(14, 25, 196, 25);

            doc.addImage(adornedByVeenaLogo, 'PNG', 14, 30, 40, 32);

            const oppName = this.oppRecordData.Name?.value || this.oppData?.fields?.Name?.value || 'Event';
            const eventDateRaw = this.oppData?.fields?.CloseDate?.value;
            const eventDateFormatted = eventDateRaw ? new Date(eventDateRaw).toLocaleDateString() : '';

            doc.setFontSize(10); doc.setFont("helvetica", "normal");
            const metadataStartY = 40; const lineSpacing = 7;

            doc.text("Invoice Reference:", 140, metadataStartY); doc.text(oppName, 196, metadataStartY, { align: "right" });
            doc.text("Issue Date:", 140, metadataStartY + lineSpacing); doc.text(new Date().toLocaleDateString(), 196, metadataStartY + lineSpacing, { align: "right" });
            if (eventDateFormatted) { doc.text("Event Date:", 140, metadataStartY + (lineSpacing * 2)); doc.text(eventDateFormatted, 196, metadataStartY + (lineSpacing * 2), { align: "right" }); }

            let leftY = 75;
            doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Company", 14, leftY);
            const clientAreaX = 140; doc.text("Client", clientAreaX, leftY);

            leftY += 8; doc.setFontSize(10); doc.text("Adorned By Veena", 14, leftY);

            const accName = this.accRecordData.Name?.value || this.oppData?.fields?.Account?.value?.fields?.Name?.value || '';
            const accEmail = this.accRecordData.PersonEmail?.value || this.accRecordData.Email?.value || '';
            const accPhone = this.accRecordData.PersonMobilePhone?.value || this.accRecordData.Phone?.value || '';
            const street = this.oppData?.fields?.Venue__Street__s?.value    || '';
            const city   = this.oppData?.fields?.Venue__City__s?.value      || '';
            const state  = this.oppData?.fields?.Venue__StateCode__s?.value || '';
            const zip    = this.oppData?.fields?.Venue__PostalCode__s?.value || '';

            if (accName) doc.text(accName, clientAreaX, leftY);

            leftY += 5; doc.setFont("helvetica", "normal");
            doc.text("adornedbyveena.com", 14, leftY); doc.text("19730 Shinnery Ridge Ct", 14, leftY + 5); doc.text("Cypress, TX 77433", 14, leftY + 10);

            let rightY = leftY;
            if(accEmail) { doc.text(accEmail, clientAreaX, rightY); rightY += 5; }
            if(accPhone) { doc.text(accPhone, clientAreaX, rightY); rightY += 5; }
            if(street) { doc.text(street, clientAreaX, rightY); rightY += 5; }
            if(city) { doc.text(`${city}, ${state} ${zip}`, clientAreaX, rightY); }

            const dbLines = this.wiredLineItemsResult?.data?.records || [];
            let tDisc = 0; let tNet = 0;
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
                const q = parseFloat(rec.fields.Quantity__c?.value) || 0;
                const p = parseFloat(rec.fields.Sales_Price__c?.value) || 0;
                const d = parseFloat(rec.fields.Discount__c?.value) || 0;
                const r = (q * p) - d; tDisc += d; tNet += r;
                tableData.push([ { content: productName, styles: { fontStyle: 'bold' } }, q, `$${r.toFixed(2)}` ]);
                descItems.forEach(item => {
                    tableData.push([{ content: item.text, colSpan: 3, styles: { fontStyle: item.bold ? 'bold' : 'normal', textColor: [40, 40, 40] } }]);
                });
            });

            const tableStartY = Math.max(leftY + 15, rightY + 10);
            doc.autoTable({
                startY: tableStartY,
                head: [[ { content: 'Service Line Items', styles: { halign: 'left' } }, { content: 'Quantity', styles: { halign: 'right' } }, { content: 'Price', styles: { halign: 'right' } } ]],
                body: tableData, theme: 'plain',
                headStyles: { fillColor: [247, 231, 206], textColor: [2, 12, 29], fontStyle: 'bold', lineWidth: { bottom: 1.5 }, lineColor: [212, 175, 55] },
                bodyStyles: { fillColor: [247, 231, 206], textColor: [2, 12, 29] },
                columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 36, halign: 'right' }, 2: { cellWidth: 36, halign: 'right' } },
                margin: { left: 14, right: 14 }
            });

            let fY = doc.lastAutoTable.finalY;
            if (fY + 65 > 277) {
                doc.addPage(); doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F');
                doc.setTextColor(2, 12, 29); fY = 15;
            }
            doc.setTextColor(2, 12, 29); doc.setDrawColor(212, 175, 55); doc.line(110, fY + 10, 196, fY + 10);
            doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Subtotal", 110, fY + 17);
            doc.setFont("helvetica", "normal"); doc.text(`$${(tNet + tDisc).toFixed(2)}`, 196, fY + 17, { align: "right" });
            if (tDisc > 0) {
                doc.text(`-$${tDisc.toFixed(2)}`, 196, fY + 24, { align: "right" });
                doc.setFontSize(9); doc.text("Discount included in subtotal", 110, fY + 24);
            }
            doc.line(110, fY + 30, 196, fY + 30);
            doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Due on effective date", 110, fY + 37);
            doc.text(`$${tNet.toFixed(2)}`, 196, fY + 37, { align: "right" });

            let footerY = fY + 50;
            if (footerY > 250) {
                doc.addPage(); doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F'); doc.setTextColor(2, 12, 29); footerY = 20;
            }

            doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.5); doc.line(14, footerY, 196, footerY);
            footerY += 10; doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.text("Terms", 14, footerY);
            footerY += 6; doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("Zelle payments should be directed to ", 14, footerY);
            let offset1 = doc.getTextWidth("Zelle payments should be directed to ");
            doc.setFont("helvetica", "bold"); doc.text("adornedbyveena@gmail.com", 14 + offset1, footerY);
            let offset2 = doc.getTextWidth("adornedbyveena@gmail.com");
            doc.setFont("helvetica", "normal"); doc.text(" with the Invoice ref. in the memo.", 14 + offset1 + offset2, footerY);
            doc.text("The total amount due on the effective date does not include any payments starting at a later date.", 14, footerY + 5);

            footerY += 18; doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.text("With appreciation,", 14, footerY);
            footerY += 6; doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Veena Boppana", 14, footerY);
            footerY += 5; doc.setFontSize(10); doc.setFont("helvetica", "normal");
            doc.text("512-840-8811 ", 14, footerY); let phoneWidth = doc.getTextWidth("512-840-8811 ");
            doc.setTextColor(212, 175, 55); doc.text("|", 14 + phoneWidth, footerY); let pipeWidth = doc.getTextWidth("| ");
            doc.setTextColor(2, 12, 29); doc.text(" veena@adornedbyveena.com", 14 + phoneWidth + pipeWidth, footerY);

            if (this.uploadedImages && this.uploadedImages.length > 0) {
                doc.addPage();
                doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F'); doc.setTextColor(2, 12, 29);
                doc.setFontSize(26); doc.setFont("helvetica", "bold"); doc.text("REFERENCE PICTURES", 196, 20, { align: "right" });
                doc.setDrawColor(212, 175, 55); doc.setLineWidth(0.5); doc.line(14, 25, 196, 25);
                let imgY = 40;
                this.uploadedImages.forEach((img) => {
                    const maxW = 150; const maxH = 100;
                    const ratio = Math.min(maxW / img.width, maxH / img.height);
                    const renderW = img.width * ratio; const renderH = img.height * ratio;
                    if (imgY + renderH + 20 > 280) {
                        doc.addPage();
                        doc.setFillColor(247, 231, 206); doc.rect(0, 0, 210, 297, 'F'); doc.setTextColor(2, 12, 29);
                        imgY = 20;
                    }
                    doc.setFontSize(12); doc.setFont("helvetica", "bold");
                    doc.text(img.customName, 105, imgY, { align: "center" });
                    const imgX = (210 - renderW) / 2;
                    doc.addImage(img.base64, img.extension.toUpperCase(), imgX, imgY + 5, renderW, renderH);
                    imgY += renderH + 25;
                });
            }

            const pageHeight = doc.internal.pageSize.height || 297;
            doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(212, 175, 55);
            doc.text("Thank you for letting us adorn your special day!", 105, pageHeight - 15, { align: "center" });

            const pdfBlob = doc.output('blob');
            this.pdfUrl = URL.createObjectURL(pdfBlob);
            this.rawPdfBase64 = btoa(doc.output());

            // Populate email preview
            const formulaName = this.oppData?.fields?.Client_Name_Formula__c?.value;
            const fallbackName = this.accRecordData.Name?.value || '';
            const clientName = formulaName || fallbackName || 'Client';
            const oppName2 = this.oppRecordData.Name?.value || this.oppData?.fields?.Name?.value || 'Event';
            const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

            this.emailClientName = clientName;
            this.emailEventName  = oppName2;
            this.emailTo         = this.oppData?.fields?.Client_Email__c?.value || '';
            this.emailSubject    = `Your Invoice - ${oppName2}`;
            this.pdfFileName     = `${clientName} - Invoice - ${dateStr}.pdf`;

        } catch (e) {
            console.error('PDF Generation Error:', e);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({ title: 'Could not generate PDF', message: 'An error occurred while preparing the document. Please try again.', variant: 'error' }));
        }
    }

    // --- NAVIGATION ---
    goBack() {
        if (this.currentStep === '2') { this.currentStep = '1'; }
        else if (this.currentStep === '3') { this.currentStep = '2'; }
        else if (this.currentStep === '4') { this.currentStep = '3'; this.pdfUrl = null; this.rawPdfBase64 = null; }
        else if (this.currentStep === '5') { this.currentStep = '4'; }
    }

    previewEmail() { this.currentStep = '5'; }

    closeAction() { this.dispatchEvent(new CloseActionScreenEvent()); }

    async saveAndSend() {
        this.isLoading = true;
        try {
            await sendInvoiceEmail({
                recordId: this.recordId,
                pdfBase64: this.rawPdfBase64,
                fileName: this.pdfFileName
            });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Invoice Sent',
                message: 'The invoice has been sent to the client.',
                variant: 'success'
            }));
            this.closeAction();
        } catch (e) {
            const msg = e?.body?.message || e?.message || 'Something went wrong. Please try again.';
            console.error('Send Error:', e);
            this.isLoading = false;
            this.dispatchEvent(new ShowToastEvent({ title: 'Could not send invoice', message: msg, variant: 'error', mode: 'sticky' }));
        }
    }
}