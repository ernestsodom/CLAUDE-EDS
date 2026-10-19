'use client';
import { useFormStatus } from 'react-dom';
import { useActionState, useState } from 'react';
import { login, addPhoto } from '@/app/admin/actions';

export function Submit({ children = 'Guardar', className = 'btn' }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? 'Guardando…' : children}
    </button>
  );
}

// Botón de borrar con confirmación
export function Delete({ action, id, label = 'Eliminar', question = '¿Seguro que quieres eliminar?' }) {
  return (
    <form action={action} onSubmit={(e) => !confirm(question) && e.preventDefault()}>
      <input type="hidden" name="id" value={id} />
      <button className="btn-danger" title={label}>{label}</button>
    </form>
  );
}

// Formulario que pide confirmación antes de enviarse
export function ConfirmForm({ action, question, children, className }) {
  return (
    <form action={action} className={className} onSubmit={(e) => !confirm(question) && e.preventDefault()}>
      {children}
    </form>
  );
}

export function LoginForm() {
  const [error, action] = useActionState(login, null);
  return (
    <form action={action} className="stack">
      <label>
        Clave de administrador
        <input type="password" name="password" required autoFocus />
      </label>
      {error && <p className="error">{error}</p>}
      <Submit>Entrar</Submit>
    </form>
  );
}

// Reduce la imagen en el navegador antes de subirla
function compress(file, max = 1600, type = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL(type, 0.82));
    };
    img.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

export function PhotoUpload({ defaultCategory }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const files = [...form.files.files];
    if (!files.length) return;
    setBusy(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setStatus(`Subiendo ${i + 1} de ${files.length}…`);
        await addPhoto({ category: form.category.value, caption: form.caption.value, dataUrl: await compress(files[i]) });
      }
      setStatus(`✔ ${files.length} foto(s) subida(s)`);
      form.reset();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label>
        Fotos (puedes elegir varias)
        <input type="file" name="files" accept="image/*" multiple required />
      </label>
      <label>
        Descripción (opcional)
        <input name="caption" placeholder="Ej: Fecha 7 — Cóndores vs Pumas" />
      </label>
      <label>
        Mostrar en
        <select name="category" defaultValue={defaultCategory}>
          <option value="">Ambas categorías</option>
          <option value="tc">Todo Competidor</option>
          <option value="senior">Senior</option>
        </select>
      </label>
      <button className="btn" disabled={busy}>{busy ? 'Subiendo…' : 'Subir fotos'}</button>
      {status && <p className="muted">{status}</p>}
    </form>
  );
}

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

// Campo de archivo dentro de un formulario normal: deja el archivo listo (y reducido si es imagen)
// en un campo oculto para la acción del servidor.
export function FileField({ name, label, accept = 'image/*', max = 1600, type = 'image/jpeg', required = false }) {
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');

  async function onChange(e) {
    const file = e.target.files[0];
    setValue('');
    if (!file) return setMsg('');
    try {
      if (file.type.startsWith('image/')) {
        setValue(await compress(file, max, type));
        setMsg('✔ Lista para guardar');
      } else if (file.size > 3 * 1024 * 1024) {
        setMsg('El archivo pesa más de 3 MB. Intenta con uno más liviano.');
        e.target.value = '';
      } else {
        setValue(await readDataUrl(file));
        setMsg('✔ Listo para guardar');
      }
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    }
  }

  return (
    <label>
      {label}
      <input type="file" accept={accept} onChange={onChange} required={required} />
      <input type="hidden" name={name} value={value} />
      {msg && <span className="muted small">{msg}</span>}
    </label>
  );
}
