import { bySlug } from '@/lib/categories';
import { getPhotos } from '@/lib/data';

export default async function PhotosPage({ params }) {
  const { cat } = await params;
  const category = bySlug(cat);
  const photos = await getPhotos(category.key);
  return (
    <>
      <h1 className="page-title">Fotos</h1>
      {photos.length ? (
        <div className="gallery">
          {photos.map((p) => (
            <a key={p.id} href={`/api/foto/${p.id}`} target="_blank" rel="noreferrer">
              <img src={`/api/foto/${p.id}`} alt={p.caption || 'Foto de la liga'} loading="lazy" />
              {p.caption && <span>{p.caption}</span>}
            </a>
          ))}
        </div>
      ) : (
        <p className="empty">Aún no hay fotos.</p>
      )}
    </>
  );
}
