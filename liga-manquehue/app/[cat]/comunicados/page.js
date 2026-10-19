import Announcement from '@/components/Announcement';
import { bySlug } from '@/lib/categories';
import { getAnnouncements } from '@/lib/data';

export default async function NewsPage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const news = await getAnnouncements(category.key);
  return (
    <>
      <h1 className="page-title">Comunicados</h1>
      {news.length ? news.map((a) => <Announcement key={a.id} a={a} />) : <p className="empty">Sin comunicados por ahora.</p>}
    </>
  );
}
