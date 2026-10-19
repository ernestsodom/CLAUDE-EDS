import { fmtShort } from '@/lib/format';

export default function Announcement({ a }) {
  return (
    <article className="card announcement">
      <small>{fmtShort(a.created_at)}</small>
      <h3>{a.title}</h3>
      <p>{a.body}</p>
    </article>
  );
}
