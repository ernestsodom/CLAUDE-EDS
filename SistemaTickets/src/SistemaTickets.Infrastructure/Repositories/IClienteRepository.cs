using SistemaTickets.Domain.Entities;

namespace SistemaTickets.Infrastructure.Repositories;

public interface IClienteRepository
{
    Task<List<Cliente>> ObtenerTodosAsync();
    Task<Cliente?> ObtenerPorIdAsync(int id);
    Task<Cliente> CrearAsync(Cliente cliente);
    Task ActualizarAsync(Cliente cliente);
}
