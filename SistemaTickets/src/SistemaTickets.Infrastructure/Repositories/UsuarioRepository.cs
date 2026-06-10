using Microsoft.EntityFrameworkCore;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Infrastructure.Data;

namespace SistemaTickets.Infrastructure.Repositories;

public class UsuarioRepository(AppDbContext db) : IUsuarioRepository
{
    public async Task<List<Usuario>> ObtenerTodosAsync() =>
        await db.Usuarios.OrderBy(u => u.Nombre).ToListAsync();

    public async Task<Usuario?> ObtenerPorIdAsync(int id) =>
        await db.Usuarios.FindAsync(id);

    public async Task<Usuario?> ObtenerPorCorreoAsync(string correo) =>
        await db.Usuarios.FirstOrDefaultAsync(u => u.Correo == correo.ToLower());

    public async Task<Usuario> CrearAsync(Usuario usuario)
    {
        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync();
        return usuario;
    }

    public async Task ActualizarAsync(Usuario usuario)
    {
        db.Usuarios.Update(usuario);
        await db.SaveChangesAsync();
    }
}
