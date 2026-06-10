namespace SistemaTickets.Domain.Entities;

public class TicketSeguimiento
{
    public int Id { get; set; }
    public string Comentario { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;

    public int UsuarioId { get; set; }
    public Usuario Usuario { get; set; } = null!;
}
