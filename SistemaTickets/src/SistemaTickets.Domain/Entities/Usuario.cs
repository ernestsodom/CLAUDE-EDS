using SistemaTickets.Domain.Enums;

namespace SistemaTickets.Domain.Entities;

public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Correo { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public RolUsuario Rol { get; set; } = RolUsuario.Desarrollador;
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;

    public ICollection<Ticket> TicketsAsignados { get; set; } = [];
    public ICollection<Ticket> TicketsCreados { get; set; } = [];
    public ICollection<TicketSeguimiento> Seguimientos { get; set; } = [];
}
