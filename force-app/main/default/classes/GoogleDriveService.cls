public class GoogleDriveService {

    static final String NC = 'callout:Google_APIs';

    // Returns folder ID — creates folder if not found under parentId (null = My Drive root)
    static String getOrCreateFolder(String folderName, String parentId) {
        String q = 'name=\'' + folderName.replace('\'', '\\\'')
                 + '\' and mimeType=\'application/vnd.google-apps.folder\' and trashed=false';
        if (parentId != null) q += ' and \'' + parentId + '\' in parents';

        HttpRequest req = new HttpRequest();
        req.setEndpoint(NC + '/drive/v3/files?q=' + EncodingUtil.urlEncode(q, 'UTF-8') + '&fields=files(id)');
        req.setMethod('GET');
        HttpResponse res = new Http().send(req);

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> files = (List<Object>) body.get('files');
        if (files != null && !files.isEmpty()) {
            return (String) ((Map<String, Object>) files[0]).get('id');
        }

        // Create folder
        Map<String, Object> meta = new Map<String, Object>{
            'name'     => folderName,
            'mimeType' => 'application/vnd.google-apps.folder'
        };
        if (parentId != null) meta.put('parents', new List<String>{ parentId });

        HttpRequest cr = new HttpRequest();
        cr.setEndpoint(NC + '/drive/v3/files');
        cr.setMethod('POST');
        cr.setHeader('Content-Type', 'application/json');
        cr.setBody(JSON.serialize(meta));
        HttpResponse crRes = new Http().send(cr);

        if (crRes.getStatusCode() < 200 || crRes.getStatusCode() >= 300) {
            throw new CalloutException('Drive folder create failed: ' + crRes.getBody());
        }
        return (String) ((Map<String, Object>) JSON.deserializeUntyped(crRes.getBody())).get('id');
    }

    // Creates file metadata entry then uploads binary PDF content
    public static String uploadContract(String folderName, String fileName, Blob pdfBlob) {
        String rootId  = getOrCreateFolder('ABV Contracts and Invoices', null);
        String eventId = getOrCreateFolder(folderName, rootId);

        // Step 1 — create file metadata (gets a file ID back)
        Map<String, Object> meta = new Map<String, Object>{
            'name'     => fileName,
            'mimeType' => 'application/pdf',
            'parents'  => new List<String>{ eventId }
        };
        HttpRequest createReq = new HttpRequest();
        createReq.setEndpoint(NC + '/drive/v3/files');
        createReq.setMethod('POST');
        createReq.setHeader('Content-Type', 'application/json');
        createReq.setBody(JSON.serialize(meta));
        HttpResponse createRes = new Http().send(createReq);

        if (createRes.getStatusCode() < 200 || createRes.getStatusCode() >= 300) {
            throw new CalloutException('Drive file create failed: ' + createRes.getBody());
        }
        String fileId = (String) ((Map<String, Object>) JSON.deserializeUntyped(createRes.getBody())).get('id');

        // Step 2 — upload binary PDF content
        HttpRequest uploadReq = new HttpRequest();
        uploadReq.setEndpoint(NC + '/upload/drive/v3/files/' + fileId + '?uploadType=media');
        uploadReq.setMethod('PATCH');
        uploadReq.setHeader('Content-Type', 'application/pdf');
        uploadReq.setBodyAsBlob(pdfBlob);
        uploadReq.setTimeout(120000);
        HttpResponse uploadRes = new Http().send(uploadReq);

        if (uploadRes.getStatusCode() < 200 || uploadRes.getStatusCode() >= 300) {
            throw new CalloutException('Drive upload failed: ' + uploadRes.getBody());
        }

        return 'https://drive.google.com/drive/folders/' + eventId;
    }
}
