/* Client Desk settings. Not secret: these IDs are safe to publish.
   clientId: the Application (client) ID from YOUR NEW Microsoft (Azure / Entra) app registration.
     Never reuse the Mortgage Desk client ID here, or both apps would share one OneDrive folder.
   googleClientId: the OAuth client ID from YOUR Google Cloud project (type "Web application").
     Leave it as it is to hide the Google option on the sign-in screen.
   tenant: 'consumers' = personal Microsoft accounts only; 'common' = personal and work/school (Microsoft 365) accounts.
   ownerName / ownerEmail: who provides the app, shown on the privacy policy page (privacy.html). Use a business contact address. */
window.MD_CONFIG = {
  appName: 'Client Desk',
  clientId: 'PASTE-NEW-CLIENT-ID-HERE',
  googleClientId: 'PASTE-GOOGLE-CLIENT-ID-HERE',
  tenant: 'consumers',
  ownerName: 'PASTE-YOUR-BUSINESS-NAME',
  ownerEmail: 'PASTE-CONTACT-EMAIL'
};
