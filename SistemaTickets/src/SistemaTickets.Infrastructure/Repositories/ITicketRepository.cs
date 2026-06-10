using SistemaTickets.Domain.Entities;
using SistemaTickets.Domain.Enums;

namespace SistemaTickets.Infrastructure.Repositories;

public interface ITicketRepository
{
    Task<List<Ticket>> ObtenerTodosAsync();
    Task<Ticket?> ObtenerPorIdAsync(int id);
    Task<List<Ticket>> ObtenerPorEstadoAsync(EstadoTicket estado);
    Task<List<Ticket>> ObtenerPorClienteAsync(int clienteId);
    Task<Ticket> CrearAsync(Ticket ticket);
    Task ActualizarAsync(Ticket ticket);
    Task<int> ContarPorEstadoAsync(EstadoTicket estado);
}
