import { LightningElement, api, wire } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import DRIVE_FOLDER_URL from '@salesforce/schema/Opportunity.Drive_Folder_URL__c';

export default class DriveFolderLink extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: [DRIVE_FOLDER_URL] })
    opp;

    get folderUrl() {
        return this.opp?.data?.fields?.Drive_Folder_URL__c?.value;
    }
}
