export default function StandingsTable({ rows }) {
  if (!rows.length) return <p className="empty">Aún no hay equipos en esta categoría.</p>;
  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Equipo</th>
            <th>PTS</th>
            <th>PJ</th>
            <th>PG</th>
            <th>PE</th>
            <th>PP</th>
            <th>GF</th>
            <th>GC</th>
            <th>DIF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>{i + 1}</td>
              <td className="left team">
                {r.has_logo && <img className="crest" src={`/api/equipo/${r.id}/escudo`} alt="" />}
                {r.name}
                {r.desc > 0 && <span className="minus" title="Descuento de puntos del Tribunal">-{r.desc}</span>}
              </td>
              <td className="pts">{r.pts}</td>
              <td>{r.pj}</td>
              <td>{r.pg}</td>
              <td>{r.pe}</td>
              <td>{r.pp}</td>
              <td>{r.gf}</td>
              <td>{r.gc}</td>
              <td>{r.dif > 0 ? `+${r.dif}` : r.dif}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
