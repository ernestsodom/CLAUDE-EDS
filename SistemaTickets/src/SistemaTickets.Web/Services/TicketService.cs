using SistemaTickets.Domain.DTOs;
using SistemaTickets.Domain.Entities;
using SistemaTickets.Domain.Enums;
using SistemaTickets.Infrastructure.Data;
using SistemaTickets.Infrastructure.Repositories;

namespace SistemaTickets.Web.Services;

public class TicketService(ITicketRepository ticketRepo, AppDbContext db)
{
    public Task<List<Ticket>> ObtenerTodosAsync() => ticketRepo.ObtenerTodosAsync();

    public Task<Ticket?> ObtenerPorIdAsync(int id) => ticketRepo.ObtenerPorIdAsync(id);

    public async Task<Ticket> CrearAsync(CrearTicketDto dto, int creadoPorId)
    {
        var ticket = new Ticket
        {
            Titulo = dto.Titulo,
            Descripcion = dto.Descripcion,
            Prioridad = dto.Prioridad,
            ClienteId = dto.ClienteId,
            CreadoPorId = creadoPorId,
            AsignadoAId = dto.AsignadoAId
        };
        return await ticketRepo.CrearAsync(ticket);
    }

    public async Task CambiarEstadoAsync(int id, EstadoTicket nuevoEstado)
    {
        var ticket = await ticketRepo.ObtenerPorIdAsync(id)
            ?? throw new InvalidOperationException($"Ticket {id} no encontrado.");

        ticket.Estado = nuevoEstado;
        if (nuevoEstado == EstadoTicket.Cerrado)
            ticket.FechaCierre = DateTime.UtcNow;

        await ticketRepo.ActualizarAsync(ticket);
    }

    public async Task AsignarAsync(int id, int? usuarioId)
    {
        var ticket = await ticketRepo.ObtenerPorIdAsync(id)
            ?? throw new InvalidOperationException($"Ticket {id} no encontrado.");

        ticket.AsignadoAId = usuarioId;
        await ticketRepo.ActualizarAsync(ticket);
    }

    public async Task AgregarSeguimientoAsync(int ticketId, string comentario, int usuarioId)
    {
        var seguimiento = new TicketSeguimiento
        {
            TicketId = ticketId,
            Comentario = comentario,
            UsuarioId = usuarioId
        };
        db.TicketSeguimientos.Add(seguimiento);
        await db.SaveChangesAsync();
    }

    public async Task<DashboardResumenDto> ObtenerResumenAsync()
    {
        return new DashboardResumenDto
        {
            Abiertos = await ticketRepo.ContarPorEstadoAsync(EstadoTicket.Abierto),
            EnProceso = await ticketRepo.ContarPorEstadoAsync(EstadoTicket.EnProceso),
            Resueltos = await ticketRepo.ContarPorEstadoAsync(EstadoTicket.Resuelto),
            Cerrados = await ticketRepo.ContarPorEstadoAsync(EstadoTicket.Cerrado)
        };
    }
}

public class DashboardResumenDto
{
    public int Abiertos { get; set; }
    public int EnProceso { get; set; }
    public int Resueltos { get; set; }
    public int Cerrados { get; set; }
    public int Total => Abiertos + EnProceso + Resueltos + Cerrados;
}
