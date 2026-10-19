import { adminCat } from '@/lib/auth';
import { getPhotos } from '@/lib/data';
import { PhotoUpload, Delete } from '@/components/admin';
import { deletePhoto } from '../../actions';

export default async function AdminPhotos() {
  const cat = await adminCat();
  const photos = await getPhotos(cat);
  return (
    <>
      <h1 className="page-title">Fotos</h1>
      <section className="card">
        <h2>Subir fotos</h2>
        <PhotoUpload defaultCategory="" />
      </section>
      <div className="gallery">
        {photos.map((p) => (
          <figure key={p.id}>
            <img src={`/api/foto/${p.id}`} alt={p.caption || ''} loading="lazy" />
            <figcaption>
              <span>#{p.id} {p.caption}</span>
              <Delete action={deletePhoto} id={p.id} label="Borrar" question="¿Borrar esta foto?" />
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
