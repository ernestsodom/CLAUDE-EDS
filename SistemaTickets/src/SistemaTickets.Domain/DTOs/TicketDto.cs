using SistemaTickets.Domain.Enums;

namespace SistemaTickets.Domain.DTOs;

public class TicketDto
{
    public int Id { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public EstadoTicket Estado { get; set; }
    public PrioridadTicket Prioridad { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaCierre { get; set; }
    public string ClienteNombre { get; set; } = string.Empty;
    public string CreadoPorNombre { get; set; } = string.Empty;
    public string? AsignadoANombre { get; set; }
}

public class CrearTicketDto
{
    public string Titulo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public PrioridadTicket Prioridad { get; set; } = PrioridadTicket.Media;
    public int ClienteId { get; set; }
    public int? AsignadoAId { get; set; }
}
