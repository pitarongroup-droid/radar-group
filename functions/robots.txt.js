export async function onRequestGet(context) {
  const response = await context.next();
  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}