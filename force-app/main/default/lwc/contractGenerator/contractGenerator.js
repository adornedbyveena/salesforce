import { LightningElement, api, wire, track } from 'lwc';
import { updateRecord, createRecord } from 'lightning/uiRecordApi';
import { getRecord } from 'lightning/uiRecordApi';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { loadScript, loadStyle } from 'lightning/platformResourceLoader';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import modalOverride from '@salesforce/resourceUrl/InvoiceModalStyle';
import JSPDF_LIB from '@salesforce/resourceUrl/jsPDF';
import AUTOTABLE_LIB from '@salesforce/resourceUrl/jsPDFAutoTable';
import ABV_LOGO from '@salesforce/resourceUrl/ABVLogo512';
import ABV_FONTS from '@salesforce/resourceUrl/ABVFonts'; // The new Font Static Resource

const OPPORTUNITY_FIELDS = [
    'Opportunity.Name',
    'Opportunity.Total_Amount__c',
    'Opportunity.Deposit__c',
    'Opportunity.Balance_Due__c',
    'Opportunity.Deposit_Paid__c',
    'Opportunity.AccountId',
    'Opportunity.Account.Name',
    'Opportunity.CloseDate',
    'Opportunity.Client_Name_Formula__c'
];

export default class ContractGenerator extends LightningElement {
    @api recordId;
    @track currentStep = '1'; 
    @track isLoading = true; 
    @track pdfUrl; 
    @track flowVariables = [];
    
    accountId; oppData; rawPdfBase64; jsPdfInitialized = false; 
    oppSaved = false; accSaved = false;
    oppRecordData = {}; accRecordData = {};
    wiredLineItemsResult;

    get isStep1() { return this.currentStep === '1'; }
    get isStep2() { return this.currentStep === '2'; }
    get isStep3() { return this.currentStep === '3'; }

    renderedCallback() {
        if (this.jsPdfInitialized) return;
        this.jsPdfInitialized = true;
        
        loadStyle(this, modalOverride).catch(e => console.error('Error loading CSS:', e));

        // Load fonts alongside jsPDF
        Promise.all([
            loadScript(this, JSPDF_LIB),
            loadScript(this, ABV_FONTS)
        ])
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

    @wire(getRelatedListRecords, { parentRecordId: '$recordId', relatedListId: 'Line_Items__r', fields: ['Line_Item__c.Product__c', 'Line_Item__c.Product__r.Name', 'Line_Item__c.Description__c'] })
    wiredLineItems(result) { this.wiredLineItemsResult = result; }

    loadImage(url) {
        return new Promise((resolve) => {
            let img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => resolve(img);
            img.src = url;
        });
    }

    saveStep1() { 
        this.isLoading = true; this.oppSaved = false; this.accSaved = false;
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
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // --- FONT INTEGRATION (MONTSERRAT) ---
            if (window.montserratRegular && window.montserratBold) {
                doc.addFileToVFS("Montserrat-Regular.ttf", window.montserratRegular);
                doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");
                
                doc.addFileToVFS("Montserrat-Bold.ttf", window.montserratBold);
                doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
                
                doc.addFileToVFS("Montserrat-Italic.ttf", window.montserratItalic);
                doc.addFont("Montserrat-Italic.ttf", "Montserrat", "italic");
            }
            const primaryFont = window.montserratRegular ? "Montserrat" : "helvetica";

            // --- BRANDING COLORS ---
            const hexBg = '#F7E7CE';
            const hexText = '#020C1D';
            const hexAccent = '#D4AF37';
            
            // --- DATA EXTRACTION ---
            const oppName = this.oppRecordData.Name?.value || this.oppData?.fields?.Name?.value || 'Event';
            const totalAmt = parseFloat(this.oppRecordData.Total_Amount__c?.value || this.oppData?.fields?.Total_Amount__c?.value || 0).toFixed(2);
            const depAmt = parseFloat(this.oppRecordData.Deposit__c?.value || this.oppData?.fields?.Deposit__c?.value || 0).toFixed(2);
            const balAmt = parseFloat(this.oppRecordData.Balance_Due__c?.value || this.oppData?.fields?.Balance_Due__c?.value || 0).toFixed(2);
            const vStreet = this.oppRecordData.Venue__Street__s?.value || this.oppData?.fields?.Venue__Street__s?.value || '';
            const vCity = this.oppRecordData.Venue__City__s?.value || this.oppData?.fields?.Venue__City__s?.value || '';
            const vState = this.oppRecordData.Venue__State__s?.value || this.oppData?.fields?.Venue__State__s?.value || '';
            const vZip = this.oppRecordData.Venue__PostalCode__s?.value || this.oppData?.fields?.Venue__PostalCode__s?.value || '';

            // Stitch them together and strip trailing commas if some fields are blank
            let venue = `${vStreet}, ${vCity}, ${vState} ${vZip}`.replace(/^[,\s]+|[,\s]+$/g, '').trim();
            if (!venue) venue = 'TBD';

            // Dynamic Deposit Logic
            const isDepositPaid = this.oppRecordData.Deposit_Paid__c?.value || this.oppData?.fields?.Deposit_Paid__c?.value || false;
            const depositString = isDepositPaid 
                ? `A non-refundable deposit of $${depAmt} was paid prior to this Agreement.` 
                : `A non-refundable deposit of $${depAmt} is due upon signing this Agreement.`;

            const eventDateRaw = this.oppRecordData.CloseDate?.value || this.oppData?.fields?.CloseDate?.value;
            const eventDateFormatted = eventDateRaw ? new Date(eventDateRaw).toLocaleDateString() : 'TBD';
            const createdDateFormatted = new Date().toLocaleDateString();
            
            const accName = this.accRecordData.Name?.value || this.oppData?.fields?.Account?.value?.fields?.Name?.value || 'Client';
            const clientFormula = this.oppData?.fields?.Client_Name_Formula__c?.value || accName;
            
            const street = this.accRecordData.BillingStreet?.value || '';
            const city = this.accRecordData.BillingCity?.value || '';
            const state = this.accRecordData.BillingState?.value || '';
            const zip = this.accRecordData.BillingPostalCode?.value || '';
            const address = `${street}, ${city}, ${state} ${zip}`.replace(/^[,\s]+|[,\s]+$/g, '');

            let currentY = 20;
            const margin = 14;
            const contentWidth = 210 - (margin * 2);
            const pageHeight = doc.internal.pageSize.height || 297;

            // --- PAGE BREAK & BRANDING ENGINE ---
            const applyPageBranding = () => {
                doc.setFillColor(hexBg); 
                doc.rect(0, 0, 210, 297, 'F'); 
                doc.setTextColor(hexText);
            };

            const drawSeparator = (yPos) => {
                doc.setDrawColor(hexAccent);
                doc.setLineWidth(0.5);
                doc.line(margin, yPos, 210 - margin, yPos);
            };

            const checkPageBreak = (addedHeight) => {
                if (currentY + addedHeight >= pageHeight - 20) {
                    doc.addPage();
                    applyPageBranding();
                    currentY = 20;
                    return true;
                }
                return false;
            };

            // --- BUILD DOCUMENT ---
            applyPageBranding();
            
            const imgData = await this.loadImage(ABV_LOGO);
            doc.addImage(imgData, 'PNG', 156, 10, 40, 32); 
            
            doc.setFontSize(16); 
            doc.setFont(primaryFont, "bold");
            doc.text("EVENT PLANNING & DÉCOR CONTRACT", margin, currentY);
            currentY += 15;
            
            // --- SECTION: INTRODUCTION ---
            doc.setFontSize(12); doc.setFont(primaryFont, "bold");
            doc.text("INTRODUCTION", margin, currentY); currentY += 6;
            
            doc.setFontSize(10); doc.setFont(primaryFont, "normal");
            const introText = `This Event Planning/ Decor Contract Agreement ("Agreement") is entered into on ${createdDateFormatted} by and between:\n\n` +
                              `• Adorned By Veena, LLC, a limited liability company organized and existing under the laws of the State of Texas, with its principal office located at 19730 Shinnery Ridge Ct, Cypress, TX 77433, represented by Veena Boppana, Principal Designer (the "Company")\n\n` +
                              `• ${clientFormula}, an individual residing at ${address} ("the Client").\n\n` +
                              `The parties hereby agree as follows:`;
            
            const splitIntro = doc.splitTextToSize(introText, contentWidth);
            doc.text(splitIntro, margin, currentY);
            currentY += (splitIntro.length * 5) + 5;

            drawSeparator(currentY); currentY += 10;

            // --- SECTION: SCOPE OF SERVICES ---
            checkPageBreak(30);
            doc.setFontSize(12); doc.setFont(primaryFont, "bold");
            doc.text("SCOPE OF SERVICES", margin, currentY); currentY += 6;

            doc.setFontSize(10); doc.setFont(primaryFont, "bold");
            doc.text("Event Planning Services", margin, currentY); currentY += 5;
            
            doc.setFont(primaryFont, "normal");
            doc.text("The Company agrees to provide the services for the event hosted by the Client as detailed here:", margin + 5, currentY); currentY += 5;

            const dbLines = this.wiredLineItemsResult?.data?.records || [];
            dbLines.forEach(rec => {
                let pName = rec.fields.Product__r?.value?.fields?.Name?.value || 'Decor Item';
                doc.text(`• ${pName}`, margin + 10, currentY); currentY += 5;
            });
            
            doc.text("These services will be provided in accordance with the terms outlined in this Agreement.", margin + 5, currentY); currentY += 8;

            doc.setFont(primaryFont, "bold");
            doc.text("Exclusions", margin, currentY); currentY += 5;
            doc.setFont(primaryFont, "normal");
            const exclusionText = "The following services are excluded from this Agreement:\n" +
                                  "• Travel or accommodation costs for The Company or Client unless otherwise specified.\n" +
                                  "• Insurance for the event (Client will need to secure separate insurance coverage).\n" +
                                  "• Costs for any services or items not explicitly mentioned in this Agreement.";
            const splitExclusions = doc.splitTextToSize(exclusionText, contentWidth - 5);
            doc.text(splitExclusions, margin + 5, currentY);
            currentY += (splitExclusions.length * 5) + 5;

            drawSeparator(currentY); currentY += 10;

            // --- SECTION: EVENT DETAILS ---
            checkPageBreak(25);
            doc.setFontSize(12); doc.setFont(primaryFont, "bold");
            doc.text("EVENT DETAILS", margin, currentY); currentY += 6;
            
            doc.setFontSize(10); doc.text("Event Description", margin, currentY); currentY += 5;
            doc.setFont(primaryFont, "normal");
            doc.text(`• Event Name: ${oppName}`, margin + 5, currentY); currentY += 5;
            doc.text(`• Event Date: ${eventDateFormatted}`, margin + 5, currentY); currentY += 5;
            doc.text(`• Event Location: ${venue}`, margin + 5, currentY); currentY += 10;

            drawSeparator(currentY); currentY += 10;

            // --- SECTION: COMPENSATION AND PAYMENT TERMS ---
            checkPageBreak(45);
            doc.setFontSize(12); doc.setFont(primaryFont, "bold");
            doc.text("COMPENSATION AND PAYMENT TERMS", margin, currentY); currentY += 6;
            
            doc.setFontSize(10); doc.text("Fees", margin, currentY); currentY += 5;
            doc.setFont(primaryFont, "normal");
            doc.text(`• Flat Event Planning Fee: $${totalAmt} for all planning and coordination services.`, margin + 5, currentY); currentY += 8;

            doc.setFont(primaryFont, "bold"); doc.text("Payment Schedule", margin, currentY); currentY += 5;
            
            doc.setFont(primaryFont, "bold"); doc.text("Deposit:", margin + 5, currentY); currentY += 5;
            doc.setFont(primaryFont, "normal"); doc.text(`• ${depositString}`, margin + 10, currentY); currentY += 6;
            
            doc.setFont(primaryFont, "bold"); doc.text("Final Payment:", margin + 5, currentY); currentY += 5;
            doc.setFont(primaryFont, "normal"); doc.text(`• The remaining balance of $${balAmt} is due no later than day of the event.`, margin + 10, currentY); currentY += 8;

            doc.setFont(primaryFont, "italic");
            const feeDisclaimer = "Fees are subject to Texas State & Local Sales Tax (currently 8.25% in Cypress/Harris County). Tax will be itemized on the final invoice unless otherwise specified.\n" +
                                  "Payments are accepted via Zelle, Cash, or Credit Card. Credit Card payments incur a 3% convenience fee.\n" +
                                  "Zelle payments should be directed to adornedbyveena@gmail.com with the Inv Ref: in the memo.";
            const splitFeeDisclaimer = doc.splitTextToSize(feeDisclaimer, contentWidth);
            doc.text(splitFeeDisclaimer, margin, currentY);
            currentY += (splitFeeDisclaimer.length * 5) + 5;

            drawSeparator(currentY); currentY += 10;

            // --- THE REMAINING STATIC SECTIONS ---
            const terms = [
                { title: "RESPONSIBILITIES OF THE PARTIES", text: "**The Company's Responsibilities**\n• Provide event planning services as outlined in this Agreement.\n• Coordinate and manage vendors, venue, and logistics for the event.\n• Ensure all event-related activities are completed as scheduled.\n• Maintain communication with Clients to ensure satisfaction and resolve any issues.\n• Provide on-site event management to ensure smooth operations during the event.\n\n**Client's Responsibilities**\n• Information Accuracy: Provide all event goals, themes, and budget constraints.\n• Decision-Making Authority: Client must designate one (1) primary point of contact with full authority to make binding decisions and approvals.\n• Financial Obligations: Ensure timely payments of planning fees and direct vendor invoices.\n• Approvals: Review and approve designs and contracts within 72 hours of receipt.\n• Venue Logistics: Provide all necessary access codes, loading-dock info, and permits.\n• Third-Party Agreements: Client shall sign and be solely responsible for all vendor contracts.\n• Conduct & Liability: Client is responsible for guest behavior and any damages caused by attendees.\n• Proof of Insurance (COI): Client is responsible for obtaining 'Event Cancellation' or 'Host Liability' insurance if required by the venue." },
                { title: "CHANGES AND CANCELLATIONS", text: "**Changes to the Event Scope**\nIf Client wishes to make significant changes to the event scope, such as increasing the number of attendees, adding services, or changing the event date, such changes will be documented and may result in additional charges. Changes must be communicated to The Company in writing and approved by both parties.\n\n**Event Cancellation**\nIf the event is canceled by the Client:\n• More than 15 days prior to event date: Client will be responsible for paying 50% of the total fees (deposit and planning services).\n• Less than 15 days prior to event date: Client will be responsible for paying 100% of the total fees (deposit and planning services).\n\n**Force Majeure & Limited Liability:**\n• If The Company is unable to perform due to circumstances beyond their reasonable control, including but not limited to hurricanes, tropical storms, regional power grid failures, or other Acts of God—the Company's liability shall be limited to refund of the unearned portion of the deposit.\n• The Company shall be entitled to retain prorated amount of the deposit to compensate for services already rendered (e.g., planning hours, site visits, and administrative costs) up to the date of the event. Neither party shall be liable for any further indirect, consequential, or 'lost magic' damages.\n\nThis Agreement is governed by the laws of the State of Texas. Any disputes shall be resolved via mandatory mediation in Harris County, Texas, prior to the filing of any lawsuit." },
                { title: "CONFIDENTIALITY", text: "• Both parties agree to keep all sensitive information confidential, including but not limited to event details, pricing, and any proprietary business information disclosed during the term of this Agreement.\n• This confidentiality obligation will survive the termination of this Agreement." },
                { title: "GOVERNING LAW", text: "• This Agreement shall be governed by and construed in accordance with the laws of the State of Texas.\n• Any disputes arising from this Agreement will be resolved in the courts located in Harris County, Texas." },
                { title: "MISCELLANEOUS PROVISIONS", text: "**Entire Agreement**\n• This Agreement constitutes the full and complete understanding between the parties regarding the event planning services and supersedes all prior agreements or understandings, whether written or oral.\n\n**Amendments**\n• Any amendments or modifications to this Agreement must be made in writing and signed by both parties.\n\n**Severability**\n• If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect." }
            ];

            terms.forEach((section, index) => {
                checkPageBreak(15);
                doc.setFontSize(12); doc.setFont(primaryFont, "bold");
                doc.text(section.title, margin, currentY);
                currentY += 6;
                
                doc.setFontSize(10); 
                const lines = section.text.split('\n');
                lines.forEach(line => {
                    checkPageBreak(6);
                    if (line.startsWith('**') && line.endsWith('**')) {
                        doc.setFont(primaryFont, "bold");
                        doc.text(line.replace(/\*\*/g, ''), margin, currentY);
                    } else {
                        doc.setFont(primaryFont, "normal");
                        const splitLine = doc.splitTextToSize(line, contentWidth);
                        doc.text(splitLine, margin + 5, currentY);
                        currentY += (splitLine.length - 1) * 5; 
                    }
                    currentY += 5;
                });
                currentY += 5; 
                
                if (index === 1) { 
                    drawSeparator(currentY); currentY += 10;
                }
            });

            // Contact Disclaimer
            checkPageBreak(15);
            doc.setFont(primaryFont, "italic"); doc.setFontSize(10); doc.setTextColor(hexAccent);
            doc.text("For any inquiries regarding this agreement, please contact Veena Boppana at veena@adornedbyveena.com", margin, currentY);
            currentY += 10; doc.setTextColor(hexText);
            drawSeparator(currentY); currentY += 15;

            // --- SIGNATURES ---
            checkPageBreak(40);
            doc.setDrawColor(hexText); doc.setLineWidth(0.2);
            
            doc.line(margin, currentY, 90, currentY);
            doc.setFont(primaryFont, "bold"); doc.text("Adorned by Veena", margin, currentY + 5);
            doc.setFont(primaryFont, "normal"); doc.text("Date: _________________", margin, currentY + 12);

            doc.line(110, currentY, 196, currentY);
            doc.setFont(primaryFont, "bold"); doc.text(clientFormula, 110, currentY + 5);
            doc.setFont(primaryFont, "normal"); doc.text("Date: _________________", 110, currentY + 12);

            // Output
            const pdfBlob = doc.output('blob');
            this.pdfUrl = URL.createObjectURL(pdfBlob);
            this.rawPdfBase64 = btoa(doc.output()); 
            
            this.currentStep = '2';
            this.isLoading = false;

        } catch (e) { 
            console.error('PDF Generation Error:', e); 
            this.isLoading = false; 
        }
    }

    goBack() {
        if (this.currentStep === '2') {
            this.currentStep = '1';
            this.pdfUrl = null;
            this.rawPdfBase64 = null;
        }
    }

    closeAction() { this.dispatchEvent(new CloseActionScreenEvent()); }

    async saveAndSend() {
        this.isLoading = true;
        try {
            const dateStr = new Date().toLocaleDateString('en-CA'); 
            const formulaName = this.oppData?.fields?.Client_Name_Formula__c?.value;
            const fallbackName = this.accRecordData.Name?.value || this.oppData?.fields?.Account?.value?.fields?.Name?.value || 'Client';
            const clientName = formulaName ? formulaName : fallbackName;
            const finalTitle = `${clientName} - Contract - ${dateStr}`;
            
            const cvRecord = await createRecord({ 
                apiName: 'ContentVersion', 
                fields: { 
                    Title: finalTitle, 
                    PathOnClient: `${finalTitle}.pdf`, 
                    VersionData: this.rawPdfBase64, 
                    FirstPublishLocationId: this.recordId 
                } 
            });
            
            await updateRecord({ fields: { Id: this.recordId, StageName: 'Contract Sent' } });

            this.flowVariables = [
                { name: 'recordId', type: 'String', value: this.recordId },
                { name: 'contentVersionId', type: 'String', value: cvRecord.id },
                { name: 'documentType', type: 'String', value: 'Contract' } 
            ];

            this.currentStep = '3';
            this.isLoading = false;

        } catch (e) { console.error('Save/Send Error:', e); this.isLoading = false; }
    }

    handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED' || event.detail.status === 'FINISHED_SCREEN') {
            this.dispatchEvent(new ShowToastEvent({ title: 'Success', message: 'Contract sent!', variant: 'success' }));
            this.closeAction();
        }
    }
}