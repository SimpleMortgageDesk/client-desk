/* MySimpleDesk settings. Not secret: these IDs are safe to publish.
   clientId: the Application (client) ID from YOUR NEW Microsoft (Azure / Entra) app registration.
     Never reuse the Mortgage Desk client ID here, or both apps would share one OneDrive folder.
   googleClientId: the OAuth client ID from YOUR Google Cloud project (type "Web application").
     Leave it as it is to hide the Google option on the sign-in screen.
   tenant: 'consumers' = personal Microsoft accounts only; 'common' = personal and work/school (Microsoft 365) accounts.
   ownerName / ownerEmail: who provides the app, shown on the privacy policy page (privacy.html). Use a business contact address.
   signupUrl: '/api/signup' = the sign-up list built into the Cloudflare Pages site (functions/api/signup.js + a D1 database).
     A Google Sheet web app address also works. It is off on the old github.io address. When on, the app sends the account
     holder's own name, email, mobile, business and kind of work when they register, and a short 'last active' note at most
     once a day. Never their tenants', clients' or properties' details. Leave it as it is to keep the list switched off. */
window.MD_CONFIG = {
  appName: 'MySimpleDesk',
  /* the folder name records use in OneDrive (Apps › …) and Google Drive. Keep 'Client Desk' so existing users keep their records */
  driveFolder: 'Client Desk',
  clientId: 'e47f8292-11f2-469c-ad6b-0af918c885e1',
  googleClientId: 'PASTE-GOOGLE-CLIENT-ID-HERE',
  tenant: 'consumers',
  ownerName: 'MySimpleDesk',
  ownerEmail: 'support@mysimpledesk.co.uk',
  signupUrl: '/api/signup'
};
