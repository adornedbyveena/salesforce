import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import DRIVE_FOLDER_URL from '@salesforce/schema/Opportunity.Drive_Folder_URL__c';
import getFilesInFolder from '@salesforce/apex/DriveFolderController.getFilesInFolder';

const MIME_ICONS = {
    'application/pdf'                          : 'doctype:pdf',
    'application/vnd.google-apps.document'     : 'doctype:gdoc',
    'application/vnd.google-apps.spreadsheet'  : 'doctype:gsheet',
    'application/vnd.google-apps.presentation' : 'doctype:gslides',
};

export default class DriveFolderLink extends LightningElement {
    @api recordId;
    @track files        = [];
    @track isLoading    = false;
    @track errorMessage = '';

    _folderUrl = null;

    @wire(getRecord, { recordId: '$recordId', fields: [DRIVE_FOLDER_URL] })
    wiredRecord({ data }) {
        if (data) {
            const url = data.fields.Drive_Folder_URL__c?.value;
            if (url && url !== this._folderUrl) {
                this._folderUrl = url;
                this.loadFiles(url);
            }
        }
    }

    get folderUrl()  { return this._folderUrl; }
    get hasFiles()   { return this.files.length > 0; }
    get showEmpty()  { return !this.isLoading && !this.errorMessage && !this.hasFiles && !!this._folderUrl; }

    loadFiles(folderUrl) {
        this.isLoading    = true;
        this.errorMessage = '';
        getFilesInFolder({ folderUrl })
            .then(result => {
                this.isLoading = false;
                this.files = (result || []).map((f, i) => ({
                    ...f,
                    key          : i,
                    icon         : MIME_ICONS[f.mimeType] || 'doctype:attachment',
                    formattedDate: f.modified
                        ? new Date(f.modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : ''
                }));
            })
            .catch(e => {
                this.isLoading    = false;
                this.errorMessage = e.body?.message || 'Could not load files.';
            });
    }
}
