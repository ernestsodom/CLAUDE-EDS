import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container center">
      <h1>Página no encontrada</h1>
      <Link className="btn" href="/">Volver al inicio</Link>
    </main>
  );
}
