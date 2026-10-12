export async function onRequestGet(context) {
  const response = await context.next();
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}