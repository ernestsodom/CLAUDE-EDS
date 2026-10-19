import { Fragment } from 'react';

// Formato simple para las páginas editables:
//   ## Título        - elemento de lista        **negrita**
//   [texto](enlace)  ![descripción](/api/foto/12)
function inline(text, key) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={`${key}-${m.index}`}>{m[1]}</strong>);
    else {
      const external = /^https?:/.test(m[3]);
      parts.push(
        <a key={`${key}-${m.index}`} href={m[3]} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{m[2]}</a>
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function RichText({ text }) {
  const blocks = (text || '').replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className="rich">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter((l) => l.trim());
        const out = [];
        let list = [];
        const flush = () => {
          if (list.length) out.push(<ul key={`ul${out.length}`}>{list.map((l, j) => <li key={j}>{inline(l, `${i}-${j}`)}</li>)}</ul>);
          list = [];
        };
        lines.forEach((line, j) => {
          const img = line.match(/^!\[(.*?)\]\((.+?)\)$/);
          if (line.startsWith('- ')) return list.push(line.slice(2));
          flush();
          if (line.startsWith('## ')) out.push(<h2 key={j}>{line.slice(3)}</h2>);
          else if (img) out.push(<img key={j} src={img[2]} alt={img[1]} loading="lazy" />);
          else out.push(<p key={j}>{inline(line, `${i}-${j}`)}</p>);
        });
        flush();
        return <Fragment key={i}>{out}</Fragment>;
      })}
    </div>
  );
}
