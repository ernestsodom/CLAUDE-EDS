using Microsoft.EntityFrameworkCore;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Infrastructure.Data;

namespace SistemaTickets.Infrastructure.Repositories;

public class ClienteRepository(AppDbContext db) : IClienteRepository
{
    public async Task<List<Cliente>> ObtenerTodosAsync() =>
        await db.Clientes.OrderBy(c => c.Nombre).ToListAsync();

    public async Task<Cliente?> ObtenerPorIdAsync(int id) =>
        await db.Clientes.FindAsync(id);

    public async Task<Cliente> CrearAsync(Cliente cliente)
    {
        db.Clientes.Add(cliente);
        await db.SaveChangesAsync();
        return cliente;
    }

    public async Task ActualizarAsync(Cliente cliente)
    {
        db.Clientes.Update(cliente);
        await db.SaveChangesAsync();
    }
}
