# MySimpleDesk for Windows

MySimpleDesk is a web app, so the Windows app is the same site in its own window. Nothing is rewritten: every fix you push to `main` reaches the Windows app too, because it opens https://mysimpledesk.co.uk.

There are two ways to get it onto Windows. Do the first one today. Do the second one when you want it in the Microsoft Store.

## 1. Install it from Edge or Chrome (works now, free)

1. On a Windows PC open https://mysimpledesk.co.uk in Microsoft Edge (or Chrome).
2. Edge: click `...` then **Apps** then **Install this site as an app**. Chrome: click the install icon at the right of the address bar.
3. It gets its own window, a Start menu entry and a taskbar icon. Testers can do this too.

## 2. Microsoft Store (an `.msix` package made by PWABuilder)

### What you need first (only you can do these)
- A **Microsoft Partner Center developer account** (individual, one-off fee of about US$19 at the time of writing; check the current price): https://partner.microsoft.com/dashboard
- In Partner Center, reserve the app name **MySimpleDesk**. Then open **Product identity** and note three values: *Package/Identity/Name*, *Package/Identity/Publisher* and *Publisher display name*.

### Make the package
1. Go to https://www.pwabuilder.com and enter `https://mysimpledesk.co.uk`.
2. Check the report. The manifest, service worker and screenshots are already set up for it (see `manifest.webmanifest`).
3. Choose **Package for stores**, then **Windows**, and fill in the three Partner Center values above. Keep the start URL `/?source=app`.
4. Download the zip. It contains an `.msixbundle` for the Store and a test package.

### Test it on a Windows PC before you submit
1. Install the test package (follow the `readme` inside the zip: it enables sideloading and installs a certificate).
2. **Sign in with a Microsoft account and check that you land back inside the app window.** This is the one thing I could not test from here. If the sign-in opens in a separate browser and does not return to the app, tell me what you see and I will change how sign-in hands back.
3. Check: add a client, add a note, book an appointment, make an invoice PDF, log out, log in.
4. Google sign-in is switched off in the app. If you switch it on later, test it separately: Google can refuse sign-in from inside an embedded window.

### Submit
1. Partner Center, **Apps and games**, **New product**, **MSIX or PWA app**, then upload the `.msixbundle`.
2. Fill in the listing from `store-listing.md` in this folder. Upload the five pictures from `screenshots/` (the three wide ones are right for Windows).
3. Privacy policy URL: https://mysimpledesk.co.uk/privacy. Support URL: https://mysimpledesk.co.uk/support.
4. Because the app needs a sign-in, put a **test account** (a spare Outlook.com address and its password) in *Notes for certification*, and say that the app asks the tester to sign in with Microsoft. Do not use your own account.
5. Age rating questionnaire: no violence, no chat, no purchases inside the app.
6. Submit. Review usually takes a few days.

### Updating later
Nothing to do for normal updates. Push to `main` as usual. Only repackage if you change the app name, icons or the way it starts.
