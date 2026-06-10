using Microsoft.EntityFrameworkCore;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Domain.Enums;
using SistemaTickets.Infrastructure.Data;

namespace SistemaTickets.Infrastructure.Repositories;

public class TicketRepository(AppDbContext db) : ITicketRepository
{
    public async Task<List<Ticket>> ObtenerTodosAsync() =>
        await db.Tickets
            .Include(t => t.Cliente)
            .Include(t => t.CreadoPor)
            .Include(t => t.AsignadoA)
            .OrderByDescending(t => t.FechaCreacion)
            .ToListAsync();

    public async Task<Ticket?> ObtenerPorIdAsync(int id) =>
        await db.Tickets
            .Include(t => t.Cliente)
            .Include(t => t.CreadoPor)
            .Include(t => t.AsignadoA)
            .Include(t => t.Seguimientos)
                .ThenInclude(s => s.Usuario)
            .FirstOrDefaultAsync(t => t.Id == id);

    public async Task<List<Ticket>> ObtenerPorEstadoAsync(EstadoTicket estado) =>
        await db.Tickets
            .Include(t => t.Cliente)
            .Include(t => t.AsignadoA)
            .Where(t => t.Estado == estado)
            .OrderByDescending(t => t.FechaCreacion)
            .ToListAsync();

    public async Task<List<Ticket>> ObtenerPorClienteAsync(int clienteId) =>
        await db.Tickets
            .Where(t => t.ClienteId == clienteId)
            .OrderByDescending(t => t.FechaCreacion)
            .ToListAsync();

    public async Task<Ticket> CrearAsync(Ticket ticket)
    {
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync();
        return ticket;
    }

    public async Task ActualizarAsync(Ticket ticket)
    {
        db.Tickets.Update(ticket);
        await db.SaveChangesAsync();
    }

    public async Task<int> ContarPorEstadoAsync(EstadoTicket estado) =>
        await db.Tickets.CountAsync(t => t.Estado == estado);
}
