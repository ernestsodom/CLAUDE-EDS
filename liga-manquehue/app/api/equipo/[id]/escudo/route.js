import { sql } from '@/lib/db';

export async function GET(_req, { params }) {
  const { id } = await params;
  const [t] = await sql`SELECT logo, logo_mime FROM teams WHERE id = ${Number(id) || 0}`;
  if (!t?.logo) return new Response('Sin escudo', { status: 404 });
  return new Response(Buffer.from(t.logo, 'base64'), {
    headers: { 'Content-Type': t.logo_mime, 'Cache-Control': 'public, max-age=3600' },
  });
}
