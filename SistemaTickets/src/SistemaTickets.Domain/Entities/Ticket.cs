using SistemaTickets.Domain.Enums;

namespace SistemaTickets.Domain.Entities;

public class Ticket
{
    public int Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public EstadoTicket Estado { get; set; } = EstadoTicket.Abierto;
    public PrioridadTicket Prioridad { get; set; } = PrioridadTicket.Media;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaCierre { get; set; }

    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;

    public int CreadoPorId { get; set; }
    public Usuario CreadoPor { get; set; } = null!;

    public int? AsignadoAId { get; set; }
    public Usuario? AsignadoA { get; set; }

    public ICollection<TicketSeguimiento> Seguimientos { get; set; } = [];
}
