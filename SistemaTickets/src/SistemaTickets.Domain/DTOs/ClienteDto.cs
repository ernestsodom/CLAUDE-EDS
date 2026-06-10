namespace SistemaTickets.Domain.DTOs;

public class ClienteDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Correo { get; set; }
    public string? Telefono { get; set; }
    public string? Empresa { get; set; }
    public bool Activo { get; set; }
    public int TotalTickets { get; set; }
}

public class CrearClienteDto
{
    public string Nombre { get; set; } = string.Empty;
    public string? Correo { get; set; }
    public string? Telefono { get; set; }
    public string? Empresa { get; set; }
}
