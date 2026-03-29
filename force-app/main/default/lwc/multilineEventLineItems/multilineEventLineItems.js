import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from 'lightning/actions';

export default class MultilineEventLineItems extends LightningElement {
    @api recordId;
    @track rows = [];
    @track isSaving = false;
    
    saveCount = 0;
    totalForms = 0;

    connectedCallback() {
        this.addRow();
    }

    addRow() {
        this.rows = [...this.rows, { id: Date.now() + Math.random() }];
    }

    removeRow(event) {
        if (this.rows.length > 1) {
            const idToRemove = event.target.dataset.id;
            this.rows = this.rows.filter(row => row.id.toString() !== idToRemove.toString());
        }
    }

    saveAll() {
        const forms = this.template.querySelectorAll('lightning-record-edit-form');
        this.totalForms = forms.length;
        this.saveCount = 0;
        
        if (this.totalForms > 0) {
            this.isSaving = true;
            forms.forEach(form => {
                form.submit(); 
            });
        }
    }

    handleSuccess() {
        this.saveCount++;
        
        if (this.saveCount === this.totalForms) {
            // 1. Show Toast
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Line Items saved successfully!',
                    variant: 'success',
                })
            );

            // 2. Close the modal first
            this.dispatchEvent(new CloseActionScreenEvent());

            // 3. FORCE REFRESH AFTER A SHORT DELAY
            // This gives Salesforce a half-second to commit the data before reloading the page
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    }

    handleError(event) {
        this.isSaving = false;
        console.error('Save Error:', JSON.stringify(event.detail));
        const msg = event.detail?.detail || 'Could not save line items. Please check the values and try again.';
        this.dispatchEvent(new ShowToastEvent({ title: 'Save Failed', message: msg, variant: 'error' }));
    }
}