import { sql } from '@/lib/db';

export async function GET(_req, { params }) {
  const { id } = await params;
  const [photo] = await sql`SELECT mime, data FROM photos WHERE id = ${Number(id) || 0}`;
  if (!photo) return new Response('No encontrada', { status: 404 });
  return new Response(Buffer.from(photo.data, 'base64'), {
    headers: { 'Content-Type': photo.mime, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
