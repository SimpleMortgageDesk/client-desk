/* Client Desk settings. Not secret: the client ID is safe to publish.
   clientId: paste the Application (client) ID from YOUR NEW Azure app registration.
   Never reuse the Mortgage Desk client ID here, or both apps would share one OneDrive folder. */
window.MD_CONFIG = {
  appName: 'Client Desk',
  clientId: 'PASTE-NEW-CLIENT-ID-HERE',
  tenant: 'consumers'
};
