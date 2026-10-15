// ============================================
// /api/admin/clients/:id — один клиент
// GET / PUT / DELETE
// ============================================

// GET /api/admin/clients/cli_xxx — получить клиента
export async function onRequestGet({ params, env }) {
  try {
    const client = await env.radar_group_db.prepare(
      'SELECT * FROM clients WHERE id = ?'
    ).bind(params.id).first();

    if (!client) {
      return Response.json(
        { ok: false, error: { ru: 'Клиент не найден', en: 'Client not found' } },
        { status: 404 }
      );
    }
    return Response.json({ ok: true, client });
  } catch (err) {
    console.error('Client GET error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/clients/cli_xxx — обновить клиента
export async function onRequestPut({ params, request, env }) {
  try {
    const b = await request.json();

    await env.radar_group_db.prepare(
      `UPDATE clients SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         site_url = COALESCE(?, site_url),
         language = COALESCE(?, language),
         currency = COALESCE(?, currency),
         plan = COALESCE(?, plan),
         status = COALESCE(?, status),
         updated_at = unixepoch()
       WHERE id = ?`
    ).bind(
      b.name || null,
      b.email ? b.email.toLowerCase() : null,
      b.phone || null,
      b.company || null,
      b.site_url || null,
      b.language || null,
      b.currency || null,
      b.plan || null,
      b.status || null,
      params.id
    ).run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Client PUT error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/clients/cli_xxx — удалить клиента
export async function onRequestDelete({ params, env }) {
  try {
    await env.radar_group_db.batch([
      env.radar_group_db.prepare('DELETE FROM settings WHERE client_id = ?').bind(params.id),
      env.radar_group_db.prepare('DELETE FROM users WHERE client_id = ?').bind(params.id),
      env.radar_group_db.prepare('DELETE FROM clients WHERE id = ?').bind(params.id)
    ]);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('Client DELETE error:', err);
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}