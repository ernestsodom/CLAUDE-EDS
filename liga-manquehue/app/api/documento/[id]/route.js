import { sql } from '@/lib/db';

export async function GET(_req, { params }) {
  const { id } = await params;
  const [doc] = await sql`SELECT title, mime, data FROM documents WHERE id = ${Number(id) || 0}`;
  if (!doc) return new Response('No encontrado', { status: 404 });
  const filename = `${doc.title.normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}.pdf`;
  return new Response(Buffer.from(doc.data, 'base64'), {
    headers: {
      'Content-Type': doc.mime,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
