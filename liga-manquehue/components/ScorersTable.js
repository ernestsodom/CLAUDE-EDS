export default function ScorersTable({ rows }) {
  if (!rows.length) return <p className="empty">Aún no hay goles registrados.</p>;
  return (
    <div className="table-wrap">
      <table className="standings scorers">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Jugador</th>
            <th className="left">Equipo</th>
            <th>Goles</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td>{i > 0 && rows[i - 1].goals === r.goals ? '' : i + 1}</td>
              <td className="left team">{i === 0 && '👟 '}{r.name}</td>
              <td className="left muted">{r.team_name}</td>
              <td className="pts">{r.goals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
