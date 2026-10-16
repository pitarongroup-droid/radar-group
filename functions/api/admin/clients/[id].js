// ============================================
// /api/admin/clients/:id — один клиент
// ⚠️ Проверяет role = admin
// ============================================

export async function onRequestGet({ params, request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

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
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestPut({ params, request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

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
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

export async function onRequestDelete({ params, request, env }) {
  try {
    const payload = getPayload(request);
    if (!payload || payload.role !== 'admin') {
      return Response.json(
        { ok: false, error: { ru: 'Доступ запрещён', en: 'Forbidden' } },
        { status: 403 }
      );
    }

    await env.radar_group_db.batch([
      env.radar_group_db.prepare('DELETE FROM settings WHERE client_id = ?').bind(params.id),
      env.radar_group_db.prepare('DELETE FROM users WHERE client_id = ?').bind(params.id),
      env.radar_group_db.prepare('DELETE FROM clients WHERE id = ?').bind(params.id)
    ]);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { ok: false, error: { ru: err.message, en: err.message } },
      { status: 500 }
    );
  }
}

function getPayload(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const p = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p));
  } catch (e) {
    return null;
  }
}