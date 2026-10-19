import { sql } from '@/lib/db';

export async function GET(_req, { params }) {
  const { id } = await params;
  const [t] = await sql`SELECT photo, photo_mime FROM teams WHERE id = ${Number(id) || 0}`;
  if (!t?.photo) return new Response('Sin foto', { status: 404 });
  return new Response(Buffer.from(t.photo, 'base64'), {
    headers: { 'Content-Type': t.photo_mime, 'Cache-Control': 'public, max-age=3600' },
  });
}
