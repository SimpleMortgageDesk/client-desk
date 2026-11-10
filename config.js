/* Client Desk settings. Not secret: these IDs are safe to publish.
   clientId: the Application (client) ID from YOUR NEW Microsoft (Azure / Entra) app registration.
     Never reuse the Mortgage Desk client ID here, or both apps would share one OneDrive folder.
   googleClientId: the OAuth client ID from YOUR Google Cloud project (type "Web application").
     Leave it as it is to hide the Google option on the sign-in screen.
   tenant: 'consumers' = personal Microsoft accounts only; 'common' = personal and work/school (Microsoft 365) accounts.
   ownerName / ownerEmail: who provides the app, shown on the privacy policy page (privacy.html). Use a business contact address.
   signupUrl: the web app address of YOUR Google Sheet sign-up list (see the setup guide). When set, the app sends the account
     holder's own name, email, mobile, business and kind of work when they register, and a short 'last active' note at most
     once a day. Never their tenants', clients' or properties' details. Leave it as it is to keep the list switched off. */
window.MD_CONFIG = {
  appName: 'Client Desk',
  clientId: 'e47f8292-11f2-469c-ad6b-0af918c885e1',
  googleClientId: 'PASTE-GOOGLE-CLIENT-ID-HERE',
  tenant: 'consumers',
  ownerName: 'PASTE-YOUR-BUSINESS-NAME',
  ownerEmail: 'PASTE-CONTACT-EMAIL',
  signupUrl: 'PASTE-SIGNUP-URL-HERE'
};
