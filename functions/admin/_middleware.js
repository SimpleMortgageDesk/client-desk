/* The admin page is protected by Cloudflare Access on mysimpledesk.co.uk and www.mysimpledesk.co.uk only. The project also answers on its
   free mysimpledesk.pages.dev address, which Access cannot cover, so the admin page shell would otherwise be visible there (the data
   behind it was already refused). Anything other than the real domain is sent to the real admin address instead. */
const OK = { 'mysimpledesk.co.uk': 1, 'www.mysimpledesk.co.uk': 1 };
export async function onRequest({ request, next }) {
  const host = new URL(request.url).hostname.toLowerCase();
  if (!OK[host]) return Response.redirect('https://mysimpledesk.co.uk/admin/', 302);
  return next();
}
